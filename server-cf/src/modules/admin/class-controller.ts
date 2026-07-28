import { Hono } from "hono";
import { z } from "zod";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { v4 as uuid } from "uuid";
import { nowISO } from "../../lib/utils";
import { eq, and, count, inArray, sql } from "drizzle-orm";
import { adminAuth } from "../../middleware/admin-auth";
import {
  classes,
  institutions,
  departments,
  students,
} from "../../schema/admin";
import {
  classStudentIds,
  classTeacherIds,
  institutionCurriculumAccess,
  institutionAccessibleGradebooks,
} from "../../schema/junction";
import { gradeBooks } from "../../schema/books";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";
import { TEXT_LIMITS } from "../../lib/validation/text";

const classController = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Apply auth to all routes
classController.use("*", adminAuth);

const classCreateSchema = z.object({
  grade: z.string().trim().min(1, "Grade is required").max(TEXT_LIMITS.classGrade, "Grade too long"),
  section: z.string().trim().min(1, "Section is required").max(TEXT_LIMITS.classSection, "Section too long"),
  year: z.string().trim().max(TEXT_LIMITS.classYear, "Year too long").regex(/^\d{4}(-\d{4})?$/, "Enter a valid year (e.g. 2024 or 2024-2025)").optional().or(z.literal("")),
  institutionId: z.string().min(1, "Institution is required"),
  departmentId: z.string().optional(),
  capacity: z.coerce.number().int().positive().optional(),
  isActive: z.union([z.literal(1), z.literal(0)]).optional(),
});

// ─── CREATE Class ──────────────────────────────────
classController.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = classCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(", "));
  }
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  // Verify institution
  const [inst] = await db
    .select()
    .from(institutions)
    .where(
      and(eq(institutions.id, parsed.data.institutionId), eq(institutions.isDeleted, 0))
    )
    .limit(1);

  if (!inst) {
    throw new BadRequestError("Institution not found");
  }

  if (user.role !== "super_admin" && inst.id !== user.institutionId) {
    throw new ForbiddenError("Access denied");
  }

  if (inst.type === "college" && !parsed.data.departmentId) {
    throw new BadRequestError("departmentId is required for colleges");
  }

  // Validate grade against enabled curriculum grades
  if (parsed.data.grade) {
    // Get curriculum access entries for this institution
    const accessRows = await db
      .select({ id: institutionCurriculumAccess.id })
      .from(institutionCurriculumAccess)
      .where(
        eq(institutionCurriculumAccess.institutionId, body.institutionId)
      );

    if (accessRows.length > 0) {
      // Get accessible gradebook IDs
      const accessIds = accessRows.map((a) => a.id);
      const gbRows = await db
        .select({ gradeBookId: institutionAccessibleGradebooks.gradeBookId })
        .from(institutionAccessibleGradebooks)
        .where(
          accessIds.length === 1
            ? eq(institutionAccessibleGradebooks.accessId, accessIds[0])
            : // For multiple accesses, we query one at a time to avoid needing inArray import overhead
              eq(institutionAccessibleGradebooks.accessId, accessIds[0])
        );

      // For multiple access entries, query each
      let allGbIds: string[] = [];
      for (const access of accessRows) {
        const gbs = await db
          .select({ gradeBookId: institutionAccessibleGradebooks.gradeBookId })
          .from(institutionAccessibleGradebooks)
          .where(eq(institutionAccessibleGradebooks.accessId, access.id));
        allGbIds.push(...gbs.map((g) => g.gradeBookId));
      }
      allGbIds = [...new Set(allGbIds)];

      if (allGbIds.length > 0) {
        // Fetch grades from grade_books
        const allowedGrades: string[] = [];
        for (const gbId of allGbIds) {
          const [gb] = await db
            .select({ grade: gradeBooks.grade })
            .from(gradeBooks)
            .where(eq(gradeBooks.id, gbId))
            .limit(1);
          if (gb && gb.grade !== null) {
            allowedGrades.push(String(gb.grade));
          }
        }

        const uniqueGrades = [...new Set(allowedGrades)];
        if (uniqueGrades.length > 0 && !uniqueGrades.includes(parsed.data.grade)) {
          throw new BadRequestError(
            `Grade "${parsed.data.grade}" is not enabled for this institution`
          );
        }
      }
    }
  }

  const classId = uuid();
  const now = nowISO();

  // Check for duplicate section (case-insensitive) within same institution + grade
  const normalizedSection = parsed.data.section.trim().toUpperCase();

  const existingSections = await db
    .select({ section: classes.section })
    .from(classes)
    .where(
      and(
        eq(classes.institutionId, parsed.data.institutionId),
        eq(classes.grade, parsed.data.grade || ""),
        eq(classes.isDeleted, 0)
      )
    );

  const sectionExists = existingSections.some(
    (row) => row.section.trim().toUpperCase() === normalizedSection
  );

  if (sectionExists) {
    throw new BadRequestError(
      `Class already exists: Grade ${parsed.data.grade || "N/A"} Section "${parsed.data.section}" is already created for this institution`
    );
  }

  const [newClass] = await db
    .insert(classes)
    .values({
      id: classId,
      grade: parsed.data.grade,
      section: parsed.data.section,
      year: parsed.data.year,
      institutionId: parsed.data.institutionId,
      departmentId: parsed.data.departmentId,
      capacity: parsed.data.capacity ?? null,
      isActive: 1,
      isDeleted: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json({ success: true, data: newClass }, 201);
});

// ─── GET All Classes ───────────────────────────────
classController.get("/", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const institutionId = c.req.query("institutionId");
  const academicYear = c.req.query("academicYear");
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "50", 10)));
  const offset = (page - 1) * limit;

  const conditions: any[] = [eq(classes.isDeleted, 0)];

  if (institutionId) {
    conditions.push(eq(classes.institutionId, institutionId));
  } else if (user.role !== "super_admin") {
    conditions.push(eq(classes.institutionId, user.institutionId));
  }

  if (academicYear) {
    conditions.push(eq(classes.year, academicYear));
  }

  const [totalRow] = await db
    .select({ count: count() })
    .from(classes)
    .where(and(...conditions));

  const classRows = await db
    .select()
    .from(classes)
    .where(and(...conditions))
    .orderBy(sql`CAST(${classes.grade} AS INTEGER)`, classes.section)
    .limit(limit)
    .offset(offset);

  const classIds = classRows.map((c) => c.id);
  const departmentIds = [...new Set(classRows.map((c) => c.departmentId).filter(Boolean))];
  const institutionIds = [...new Set(classRows.map((c) => c.institutionId).filter(Boolean))];

  // Batch fetch departments
  const departmentMap = new Map<string, any>();
  if (departmentIds.length > 0) {
    const deptRows = await db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(inArray(departments.id, departmentIds as string[]));
    for (const d of deptRows) departmentMap.set(d.id, d);
  }

  // Batch fetch institutions
  const institutionMap = new Map<string, any>();
  if (institutionIds.length > 0) {
    const instRows = await db
      .select({ id: institutions.id, name: institutions.name, type: institutions.type })
      .from(institutions)
      .where(inArray(institutions.id, institutionIds as string[]));
    for (const i of instRows) institutionMap.set(i.id, i);
  }

  // Batch fetch student counts
  const studentCountMap = new Map<string, number>();
  if (classIds.length > 0) {
    const countRows = await db
      .select({ classId: students.classId, count: count() })
      .from(students)
      .where(and(inArray(students.classId, classIds), eq(students.isDeleted, 0)))
      .groupBy(students.classId);
    for (const r of countRows) studentCountMap.set(r.classId!, r.count);
  }

  const enriched = classRows.map((cls) => ({
    ...cls,
    departmentId: (cls.departmentId && departmentMap.get(cls.departmentId)) || cls.departmentId,
    institutionId: (cls.institutionId && institutionMap.get(cls.institutionId)) || cls.institutionId,
    studentCount: studentCountMap.get(cls.id) ?? 0,
  }));

  return c.json({ success: true, data: enriched, meta: { total: totalRow?.count ?? 0, page, limit } }, 200);
});

// ─── GET Single Class ──────────────────────────────
classController.get("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const [classData] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, id), eq(classes.isDeleted, 0)))
    .limit(1);

  if (!classData) {
    throw new BadRequestError("Class not found");
  }

  if (
    user.role !== "super_admin" &&
    classData.institutionId !== user.institutionId
  ) {
    throw new ForbiddenError("Access denied");
  }

  // Department info
  let department: any = null;
  if (classData.departmentId) {
    const [dept] = await db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(eq(departments.id, classData.departmentId))
      .limit(1);
    department = dept || null;
  }

  // Institution info
  let institution: any = null;
  if (classData.institutionId) {
    const [inst] = await db
      .select({
        id: institutions.id,
        name: institutions.name,
        type: institutions.type,
      })
      .from(institutions)
      .where(eq(institutions.id, classData.institutionId))
      .limit(1);
    institution = inst || null;
  }

  // Student count
  const [countResult] = await db
    .select({ count: count() })
    .from(students)
    .where(and(eq(students.classId, id), eq(students.isDeleted, 0)));

  return c.json(
    {
      success: true,
      data: {
        ...classData,
        departmentId: department || classData.departmentId,
        institutionId: institution || classData.institutionId,
        studentCount: countResult?.count ?? 0,
      },
    },
    200
  );
});

// ─── UPDATE Class ──────────────────────────────────
classController.patch("/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const [classData] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, id), eq(classes.isDeleted, 0)))
    .limit(1);

  if (!classData) {
    throw new BadRequestError("Class not found");
  }

  if (
    user.role !== "super_admin" &&
    classData.institutionId !== user.institutionId
  ) {
    throw new ForbiddenError("Access denied");
  }

  const parsed = classCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const updateData: Record<string, any> = { updatedAt: nowISO() };
  const allowedFields = ["grade", "section", "year", "capacity", "isActive"] as const;

  for (const field of allowedFields) {
    if (parsed.data[field] !== undefined) {
      updateData[field] = parsed.data[field];
    }
  }

  await db.update(classes).set(updateData).where(eq(classes.id, id));

  const [updated] = await db
    .select()
    .from(classes)
    .where(eq(classes.id, id))
    .limit(1);

  return c.json({ success: true, data: updated }, 200);
});

// ─── DELETE Class (Soft Delete) ────────────────────
classController.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const [classData] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, id), eq(classes.isDeleted, 0)))
    .limit(1);

  if (!classData) {
    throw new BadRequestError("Class not found");
  }

  if (
    user.role !== "super_admin" &&
    classData.institutionId !== user.institutionId
  ) {
    throw new ForbiddenError("Access denied");
  }

  // Check if class has active students
  const [countResult] = await db
    .select({ count: count() })
    .from(students)
    .where(and(eq(students.classId, id), eq(students.isDeleted, 0)));

  const studentCount = countResult?.count ?? 0;

  if (studentCount > 0) {
    throw new BadRequestError(
      `Cannot delete class with ${studentCount} active students`
    );
  }

  // Soft delete
  await db
    .update(classes)
    .set({ isDeleted: 1, isActive: 0, updatedAt: nowISO() })
    .where(eq(classes.id, id));

  return c.json({ success: true, message: "Class deleted successfully" }, 200);
});

export { classController };
