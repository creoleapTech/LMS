import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { v4 as uuid } from "uuid";
import { nowISO } from "../../lib/utils";
import { eq, and, count, like, sql } from "drizzle-orm";
import { adminAuth } from "../../middleware/admin-auth";
import { examinations, examinationColumns, examinationCells } from "../../schema/examinations";
import { students, classes } from "../../schema/admin";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";

const examinationController = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Apply auth to all routes
examinationController.use("*", adminAuth);

// ─── GET / — List examinations ─────────────────────
examinationController.get("/", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const institutionId = c.req.query("institutionId");
  const search = c.req.query("search");
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "10", 10)));
  const offset = (page - 1) * limit;

  const conditions: any[] = [eq(examinations.isDeleted, 0)];

  if (user.role === "student") {
    // Students see examinations for their institution
    conditions.push(eq(examinations.institutionId, user.institutionId as string));
  } else if (user.role === "teacher") {
    conditions.push(eq(examinations.institutionId, user.institutionId as string));
  } else if (user.role === "admin") {
    conditions.push(eq(examinations.institutionId, user.institutionId as string));
  } else if (user.role === "super_admin") {
    if (institutionId) {
      conditions.push(eq(examinations.institutionId, institutionId));
    }
  }

  if (search) {
    conditions.push(like(examinations.name, `%${search}%`));
  }

  const [totalRow] = await db
    .select({ count: count() })
    .from(examinations)
    .where(and(...conditions));

  const rows = await db
    .select()
    .from(examinations)
    .where(and(...conditions))
    .orderBy(examinations.createdAt)
    .limit(limit)
    .offset(offset);

  // Fetch student counts per class for the institution in a single query,
  // then sum in memory — avoids inArray with potentially hundreds of IDs.
  const effectiveInstitutionId =
    user.role === "super_admin" ? (institutionId ?? null) : (user.institutionId as string);

  let studentCountByClass = new Map<string, number>();
  if (effectiveInstitutionId) {
    const countRows = await db
      .select({ classId: students.classId, cnt: count() })
      .from(students)
      .where(
        and(
          eq(students.institutionId, effectiveInstitutionId),
          eq(students.isDeleted, 0),
          eq(students.isActive, 1)
        )
      )
      .groupBy(students.classId);
    for (const row of countRows) {
      studentCountByClass.set(row.classId, row.cnt);
    }
  }

  const enriched = rows.map((exam) => {
    const classIds: string[] = JSON.parse(exam.selectedClassIds || "[]");
    const studentCount = classIds.reduce(
      (sum, cid) => sum + (studentCountByClass.get(cid) ?? 0),
      0
    );
    return {
      ...exam,
      studentCount,
      selectedClassIds: classIds,
    };
  });

  return c.json(
    {
      success: true,
      data: enriched,
      meta: { total: totalRow?.count ?? 0, page, limit },
    },
    200
  );
});

// ─── POST / — Create examination ───────────────────
examinationController.post("/", async (c) => {
  const body = await c.req.json();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    throw new BadRequestError("name is required");
  }
  if (body.name.trim().length > 200) {
    throw new BadRequestError("name must be 200 characters or fewer");
  }

  // Case-insensitive duplicate check within the same institution
  const trimmedName = body.name.trim();
  const [existing] = await db
    .select({ id: examinations.id })
    .from(examinations)
    .where(
      and(
        eq(examinations.institutionId, user.institutionId as string),
        eq(examinations.isDeleted, 0),
        sql`LOWER(${examinations.name}) = LOWER(${trimmedName})`
      )
    )
    .limit(1);

  if (existing) {
    throw new BadRequestError(`An examination named "${trimmedName}" already exists`);
  }

  const id = uuid();
  const now = nowISO();

  const [newExam] = await db
    .insert(examinations)
    .values({
      id,
      name: body.name.trim(),
      createdBy: user.id as string,
      institutionId: user.institutionId as string,
      selectedClassIds: JSON.stringify(body.selectedClassIds ?? []),
      isDeleted: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json({ success: true, data: { ...newExam, selectedClassIds: JSON.parse(newExam?.selectedClassIds || "[]") } }, 201);
});

// ─── GET /:id — Get examination with columns + cells ─
examinationController.get("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const [exam] = await db
    .select()
    .from(examinations)
    .where(and(eq(examinations.id, id), eq(examinations.isDeleted, 0)))
    .limit(1);

  if (!exam) {
    throw new BadRequestError("Examination not found");
  }

  // Visibility check
  if (user.role !== "super_admin" && exam.institutionId !== user.institutionId) {
    throw new ForbiddenError("Access denied");
  }

  // Fetch columns
  const columns = await db
    .select()
    .from(examinationColumns)
    .where(eq(examinationColumns.examinationId, id))
    .orderBy(examinationColumns.order);

  // Fetch students from selected classes — use a raw SQL approach to avoid
  // inArray variable limits. Join students → classes and filter by institution.
  const classIds: string[] = JSON.parse(exam.selectedClassIds || "[]");
  let studentRows: any[] = [];
  if (classIds.length > 0) {
    // Fetch all students for the institution, then filter in memory
    const allStudents = await db
      .select({
        studentId: students.id,
        name: students.name,
        classId: students.classId,
      })
      .from(students)
      .where(
        and(
          eq(students.institutionId, exam.institutionId),
          eq(students.isDeleted, 0),
          eq(students.isActive, 1)
        )
      );

    const classIdSet = new Set(classIds);
    const filteredStudents = allStudents.filter((s) => classIdSet.has(s.classId));

    // Fetch class info for grade/section
    const allClasses = await db
      .select({ id: classes.id, grade: classes.grade, section: classes.section })
      .from(classes)
      .where(eq(classes.institutionId, exam.institutionId));

    const classMap = new Map<string, { grade: string; section: string }>();
    for (const cls of allClasses) {
      classMap.set(cls.id, { grade: cls.grade ?? "", section: cls.section });
    }

    studentRows = filteredStudents
      .map((s) => ({
        studentId: s.studentId,
        name: s.name ?? "",
        classId: s.classId,
        grade: classMap.get(s.classId)?.grade ?? "",
        section: classMap.get(s.classId)?.section ?? "",
      }))
      .sort((a, b) => {
        const ga = Number(a.grade) || 0;
        const gb = Number(b.grade) || 0;
        if (ga !== gb) return ga - gb;
        const sc = a.section.localeCompare(b.section);
        if (sc !== 0) return sc;
        return a.name.localeCompare(b.name);
      });
  }

  // Fetch cells
  const cells = await db
    .select()
    .from(examinationCells)
    .where(eq(examinationCells.examinationId, id));

  const cellData = cells.map((cell) => ({
    studentId: cell.studentId,
    columnId: cell.columnId,
    value: cell.value,
  }));

  return c.json(
    {
      success: true,
      data: {
        ...exam,
        selectedClassIds: JSON.parse(exam.selectedClassIds || "[]"),
        columns,
        students: studentRows,
        cells: cellData,
      },
    },
    200
  );
});

// ─── PATCH /:id — Update examination (name / selectedClassIds) ─
examinationController.patch("/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  if (user.role === "student") {
    throw new ForbiddenError("Students cannot edit examinations");
  }

  const [exam] = await db
    .select()
    .from(examinations)
    .where(and(eq(examinations.id, id), eq(examinations.isDeleted, 0)))
    .limit(1);

  if (!exam) {
    throw new BadRequestError("Examination not found");
  }

  if (user.role !== "super_admin" && exam.institutionId !== user.institutionId) {
    throw new ForbiddenError("Access denied");
  }

  const updateData: Record<string, any> = { updatedAt: nowISO() };

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      throw new BadRequestError("name must be a non-empty string");
    }
    // Case-insensitive duplicate check (exclude the current exam)
    const trimmedName = body.name.trim();
    const [duplicate] = await db
      .select({ id: examinations.id })
      .from(examinations)
      .where(
        and(
          eq(examinations.institutionId, exam.institutionId),
          eq(examinations.isDeleted, 0),
          sql`LOWER(${examinations.name}) = LOWER(${trimmedName})`,
          sql`${examinations.id} != ${id}`
        )
      )
      .limit(1);
    if (duplicate) {
      throw new BadRequestError(`An examination named "${trimmedName}" already exists`);
    }
    updateData.name = trimmedName;
  }

  if (body.selectedClassIds !== undefined) {
    if (!Array.isArray(body.selectedClassIds)) {
      throw new BadRequestError("selectedClassIds must be an array");
    }
    updateData.selectedClassIds = JSON.stringify(body.selectedClassIds);
  }

  await db.update(examinations).set(updateData).where(eq(examinations.id, id));

  const [updated] = await db
    .select()
    .from(examinations)
    .where(eq(examinations.id, id))
    .limit(1);

  return c.json({ success: true, data: { ...updated, selectedClassIds: JSON.parse(updated?.selectedClassIds || "[]") } }, 200);
});

// ─── DELETE /:id — Soft-delete examination ──────────
examinationController.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new ForbiddenError("Only admins can delete examinations");
  }

  const [exam] = await db
    .select()
    .from(examinations)
    .where(and(eq(examinations.id, id), eq(examinations.isDeleted, 0)))
    .limit(1);

  if (!exam) {
    throw new BadRequestError("Examination not found");
  }

  if (user.role === "admin" && exam.institutionId !== user.institutionId) {
    throw new ForbiddenError("Access denied");
  }

  await db
    .update(examinations)
    .set({ isDeleted: 1, updatedAt: nowISO() })
    .where(eq(examinations.id, id));

  return c.json({ success: true, message: "Examination deleted successfully" }, 200);
});

// ─── PUT /:id/columns — Replace all columns ─────────
examinationController.put("/:id/columns", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  if (user.role === "student") {
    throw new ForbiddenError("Students cannot modify columns");
  }

  const [exam] = await db
    .select()
    .from(examinations)
    .where(and(eq(examinations.id, id), eq(examinations.isDeleted, 0)))
    .limit(1);

  if (!exam) {
    throw new BadRequestError("Examination not found");
  }

  if (user.role !== "super_admin" && exam.institutionId !== user.institutionId) {
    throw new ForbiddenError("Access denied");
  }

  if (!Array.isArray(body.columns)) {
    throw new BadRequestError("columns must be an array");
  }

  const now = nowISO();

  // Get currently stored column IDs
  const existingCols = await db
    .select({ id: examinationColumns.id })
    .from(examinationColumns)
    .where(eq(examinationColumns.examinationId, id));

  const existingIds = new Set(existingCols.map((c) => c.id));
  const incomingIds = new Set(
    (body.columns as any[]).filter((c) => c.id).map((c) => c.id as string)
  );

  // Delete only columns that are no longer in the incoming list,
  // and their associated cells first (FK constraint)
  const toDelete = [...existingIds].filter((cid) => !incomingIds.has(cid));
  if (toDelete.length > 0) {
    for (const colId of toDelete) {
      await db
        .delete(examinationCells)
        .where(
          and(
            eq(examinationCells.examinationId, id),
            eq(examinationCells.columnId, colId)
          )
        );
      await db
        .delete(examinationColumns)
        .where(eq(examinationColumns.id, colId));
    }
  }

  // Upsert each incoming column
  const savedColumns: any[] = [];
  for (const col of body.columns as any[]) {
    const colId = col.id ?? uuid();
    if (existingIds.has(colId)) {
      // Update existing column
      const [updated] = await db
        .update(examinationColumns)
        .set({
          name: col.name,
          type: col.type,
          formula: col.formula ?? null,
          order: col.order ?? 0,
          updatedAt: now,
        })
        .where(eq(examinationColumns.id, colId))
        .returning();
      savedColumns.push(updated);
    } else {
      // Insert new column
      const [inserted] = await db
        .insert(examinationColumns)
        .values({
          id: colId,
          examinationId: id,
          name: col.name,
          type: col.type,
          formula: col.formula ?? null,
          order: col.order ?? 0,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      savedColumns.push(inserted);
    }
  }

  return c.json({ success: true, data: savedColumns }, 200);
});

// ─── PATCH /:id/cells — Bulk upsert cell values ─────
examinationController.patch("/:id/cells", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  if (user.role === "student") {
    throw new ForbiddenError("Students cannot edit cell data");
  }

  const [exam] = await db
    .select()
    .from(examinations)
    .where(and(eq(examinations.id, id), eq(examinations.isDeleted, 0)))
    .limit(1);

  if (!exam) {
    throw new BadRequestError("Examination not found");
  }

  if (user.role !== "super_admin" && exam.institutionId !== user.institutionId) {
    throw new ForbiddenError("Access denied");
  }

  if (!Array.isArray(body.cells)) {
    throw new BadRequestError("cells must be an array");
  }

  const now = nowISO();
  const savedCells: any[] = [];

  for (const cell of body.cells) {
    if (!cell.studentId || !cell.columnId) continue;

    // Check if cell already exists
    const [existing] = await db
      .select()
      .from(examinationCells)
      .where(
        and(
          eq(examinationCells.examinationId, id),
          eq(examinationCells.studentId, cell.studentId),
          eq(examinationCells.columnId, cell.columnId)
        )
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(examinationCells)
        .set({ value: cell.value ?? "", updatedAt: now })
        .where(eq(examinationCells.id, existing.id))
        .returning();
      savedCells.push(updated);
    } else {
      const [inserted] = await db
        .insert(examinationCells)
        .values({
          id: uuid(),
          examinationId: id,
          studentId: cell.studentId,
          columnId: cell.columnId,
          value: cell.value ?? "",
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      savedCells.push(inserted);
    }
  }

  return c.json({ success: true, data: savedCells }, 200);
});

export { examinationController };
