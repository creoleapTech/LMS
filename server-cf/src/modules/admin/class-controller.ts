import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { v4 as uuid } from "uuid";
import { nowISO } from "../../lib/utils";
import { eq, and, count } from "drizzle-orm";
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

const classController = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Apply auth to all routes
classController.use("*", adminAuth);

// ─── CREATE Class ──────────────────────────────────
classController.post("/", async (c) => {
  const body = await c.req.json();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  // Verify institution
  const [inst] = await db
    .select()
    .from(institutions)
    .where(
      and(eq(institutions.id, body.institutionId), eq(institutions.isDeleted, 0))
    )
    .limit(1);

  if (!inst) {
    throw new BadRequestError("Institution not found");
  }

  if (user.role !== "super_admin" && inst.id !== user.institutionId) {
    throw new ForbiddenError("Access denied");
  }

  if (inst.type === "college" && !body.departmentId) {
    throw new BadRequestError("departmentId is required for colleges");
  }

  // Validate grade against enabled curriculum grades
  if (body.grade) {
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
        if (uniqueGrades.length > 0 && !uniqueGrades.includes(body.grade)) {
          throw new BadRequestError(
            `Grade "${body.grade}" is not enabled for this institution`
          );
        }
      }
    }
  }

  const classId = uuid();
  const now = nowISO();

  const [newClass] = await db
    .insert(classes)
    .values({
      id: classId,
      grade: body.grade,
      section: body.section,
      year: body.year,
      institutionId: body.institutionId,
      departmentId: body.departmentId,
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

  const conditions: any[] = [eq(classes.isDeleted, 0)];

  if (institutionId) {
    conditions.push(eq(classes.institutionId, institutionId));
  } else if (user.role !== "super_admin") {
    conditions.push(eq(classes.institutionId, user.institutionId));
  }

  if (academicYear) {
    conditions.push(eq(classes.year, academicYear));
  }

  const classRows = await db
    .select()
    .from(classes)
    .where(and(...conditions));

  // Enrich each class with department, institution info, and student count
  const enriched = await Promise.all(
    classRows.map(async (cls) => {
      // Department info
      let department: any = null;
      if (cls.departmentId) {
        const [dept] = await db
          .select({ id: departments.id, name: departments.name })
          .from(departments)
          .where(eq(departments.id, cls.departmentId))
          .limit(1);
        department = dept || null;
      }

      // Institution info
      let institution: any = null;
      if (cls.institutionId) {
        const [inst] = await db
          .select({
            id: institutions.id,
            name: institutions.name,
            type: institutions.type,
          })
          .from(institutions)
          .where(eq(institutions.id, cls.institutionId))
          .limit(1);
        institution = inst || null;
      }

      // Student count
      const [countResult] = await db
        .select({ count: count() })
        .from(students)
        .where(
          and(eq(students.classId, cls.id), eq(students.isDeleted, 0))
        );

      return {
        ...cls,
        departmentId: department || cls.departmentId,
        institutionId: institution || cls.institutionId,
        studentCount: countResult?.count ?? 0,
      };
    })
  );

  return c.json({ success: true, data: enriched }, 200);
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

  const updateData: Record<string, any> = { updatedAt: nowISO() };
  const allowedFields = ["grade", "section", "year", "capacity", "isActive"] as const;

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
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
