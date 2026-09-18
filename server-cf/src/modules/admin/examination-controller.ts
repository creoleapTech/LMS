import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { v4 as uuid } from "uuid";
import { nowISO } from "../../lib/utils";
import { eq, and, count, inArray, like, sql } from "drizzle-orm";
import { adminAuth } from "../../middleware/admin-auth";
import { examinations, examinationColumns, examinationCells } from "../../schema/examinations";
import { students, classes } from "../../schema/admin";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";
import { TEXT_LIMITS } from "../../lib/validation/text";

// ─── Helpers ─────────────────────────────────────────
// Each grade in an examination owns an independent set of columns.
// All sections of the same grade share that grade's columns.

/** Map class IDs → grade strings for classes in the given institution. */
async function getGradesForClassIds(
  db: ReturnType<typeof getDb>,
  institutionId: string,
  classIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (classIds.length === 0) return map;
  // Chunk to stay clear of SQLite variable limits
  for (let i = 0; i < classIds.length; i += 50) {
    const chunk = classIds.slice(i, i + 50);
    const rows = await db
      .select({ id: classes.id, grade: classes.grade })
      .from(classes)
      .where(
        and(
          eq(classes.institutionId, institutionId),
          inArray(classes.id, chunk)
        )
      );
    for (const row of rows) {
      map.set(row.id, row.grade ?? "");
    }
  }
  return map;
}

/**
 * Self-healing migration for pre-grade columns (grade === "").
 * - 0–1 distinct grades: stamp legacy columns with that grade.
 * - N distinct grades: clone the legacy column set per grade (new IDs) and
 *   remap each grade's students' cells to their grade's clone, then drop legacy.
 * Idempotent — a second call finds no legacy columns and is a no-op.
 */
async function healLegacyColumns(
  db: ReturnType<typeof getDb>,
  examinationId: string,
  institutionId: string,
  classIds: string[]
): Promise<void> {
  const legacy = await db
    .select()
    .from(examinationColumns)
    .where(
      and(
        eq(examinationColumns.examinationId, examinationId),
        eq(examinationColumns.grade, "")
      )
    );
  if (legacy.length === 0) return;

  const gradeByClass = await getGradesForClassIds(db, institutionId, classIds);
  const distinctGrades = [...new Set([...gradeByClass.values()].filter((g) => g !== ""))];

  const now = nowISO();

  if (distinctGrades.length <= 1) {
    const grade = distinctGrades[0] ?? "";
    await db
      .update(examinationColumns)
      .set({ grade, updatedAt: now })
      .where(
        and(
          eq(examinationColumns.examinationId, examinationId),
          eq(examinationColumns.grade, "")
        )
      );
    return;
  }

  // Multi-grade exam: duplicate the shared legacy set once per grade.
  const legacyCells = await db
    .select()
    .from(examinationCells)
    .where(eq(examinationCells.examinationId, examinationId));

  const cellsByOldColumn = new Map<string, typeof legacyCells>();
  for (const cell of legacyCells) {
    const list = cellsByOldColumn.get(cell.columnId) ?? [];
    list.push(cell);
    cellsByOldColumn.set(cell.columnId, list);
  }

  // classId → grade lookup for routing cells to the right clone
  const studentGrade = new Map<string, string>();
  const examStudents = await db
    .select({ id: students.id, classId: students.classId })
    .from(students)
    .where(
      and(
        eq(students.institutionId, institutionId),
        eq(students.isDeleted, 0)
      )
    );
  const classIdSet = new Set(classIds);
  for (const s of examStudents) {
    if (classIdSet.has(s.classId)) {
      studentGrade.set(s.id, gradeByClass.get(s.classId) ?? "");
    }
  }

  for (const grade of distinctGrades) {
    const idMap = new Map<string, string>();
    for (const col of [...legacy].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
      const newId = uuid();
      idMap.set(col.id, newId);
      await db.insert(examinationColumns).values({
        id: newId,
        examinationId,
        grade,
        name: col.name,
        type: col.type as "number" | "text" | "formula",
        formula: col.formula,
        maxMarks: col.maxMarks,
        order: col.order ?? 0,
        createdAt: now,
        updatedAt: now,
      });
    }
    // Remap this grade's students' cells onto the clones
    for (const [oldColumnId, newColumnId] of idMap) {
      const oldCells = cellsByOldColumn.get(oldColumnId) ?? [];
      for (const cell of oldCells) {
        if (studentGrade.get(cell.studentId) !== grade) continue;
        await db.insert(examinationCells).values({
          id: uuid(),
          examinationId,
          studentId: cell.studentId,
          columnId: newColumnId,
          value: cell.value ?? "",
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  // Drop the legacy shared set and its cells
  const legacyIds = legacy.map((c) => c.id);
  for (let i = 0; i < legacyIds.length; i += 50) {
    const chunk = legacyIds.slice(i, i + 50);
    await db
      .delete(examinationCells)
      .where(
        and(
          eq(examinationCells.examinationId, examinationId),
          inArray(examinationCells.columnId, chunk)
        )
      );
  }
  await db
    .delete(examinationColumns)
    .where(
      and(
        eq(examinationColumns.examinationId, examinationId),
        eq(examinationColumns.grade, "")
      )
    );
}

/** Delete every column + cell belonging to the given grades of an examination. */
async function deleteGradesData(
  db: ReturnType<typeof getDb>,
  examinationId: string,
  grades: string[]
): Promise<void> {
  if (grades.length === 0) return;
  const cols = await db
    .select({ id: examinationColumns.id })
    .from(examinationColumns)
    .where(
      and(
        eq(examinationColumns.examinationId, examinationId),
        inArray(examinationColumns.grade, grades)
      )
    );
  const colIds = cols.map((c) => c.id);
  for (let i = 0; i < colIds.length; i += 50) {
    const chunk = colIds.slice(i, i + 50);
    await db
      .delete(examinationCells)
      .where(
        and(
          eq(examinationCells.examinationId, examinationId),
          inArray(examinationCells.columnId, chunk)
        )
      );
  }
  await db
    .delete(examinationColumns)
    .where(
      and(
        eq(examinationColumns.examinationId, examinationId),
        inArray(examinationColumns.grade, grades)
      )
    );
}

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
    if (!user.institutionId) throw new ForbiddenError("No institution associated with this account");
    conditions.push(eq(examinations.institutionId, user.institutionId));
  } else if (user.role === "teacher") {
    if (!user.institutionId) throw new ForbiddenError("No institution associated with this account");
    conditions.push(eq(examinations.institutionId, user.institutionId));
  } else if (user.role === "admin") {
    if (!user.institutionId) throw new ForbiddenError("No institution associated with this account");
    conditions.push(eq(examinations.institutionId, user.institutionId));
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
    user.role === "super_admin" ? (institutionId ?? null) : user.institutionId;

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

  if (!user.id || !user.institutionId) {
    throw new ForbiddenError("No institution associated with this account");
  }

  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    throw new BadRequestError("name is required");
  }


  // Case-insensitive duplicate check within the same institution
  const trimmedName = body.name.trim();
  if (trimmedName.length > TEXT_LIMITS.examinationName) {
    throw new BadRequestError(`name must be at most ${TEXT_LIMITS.examinationName} characters`);
  }
  const [existing] = await db
    .select({ id: examinations.id })
    .from(examinations)
    .where(
      and(
        eq(examinations.institutionId, user.institutionId),
        eq(examinations.isDeleted, 0),
        sql`LOWER(${examinations.name}) = LOWER(${trimmedName})`
      )
    )
    .limit(1);

  if (existing) {
    throw new BadRequestError(`An examination named "${trimmedName}" already exists`);
  }

  // New examinations start with a single grade: every selected section must
  // belong to the same grade (sections of one grade share columns).
  // Additional grades can be added later from the examination page.
  const initialClassIds: string[] = Array.isArray(body.selectedClassIds)
    ? body.selectedClassIds
    : [];
  if (initialClassIds.length > 0) {
    const gradeByClass = await getGradesForClassIds(db, user.institutionId, initialClassIds);
    const missing = initialClassIds.filter((cid) => !gradeByClass.has(cid));
    if (missing.length > 0) {
      throw new BadRequestError("One or more selected classes do not exist in this institution");
    }
    const distinctGrades = [...new Set([...gradeByClass.values()])];
    if (distinctGrades.length > 1) {
      throw new BadRequestError(
        "Select sections from only one grade when creating an assessment. You can add more grades later from the assessment page."
      );
    }
  }

  const id = uuid();
  const now = nowISO();

  const [newExam] = await db
    .insert(examinations)
    .values({
      id,
      name: body.name.trim(),
      createdBy: user.id,
      institutionId: user.institutionId,
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

  // One-time self-healing: split pre-grade shared columns into per-grade sets
  const selectedIds: string[] = JSON.parse(exam.selectedClassIds || "[]");
  await healLegacyColumns(db, id, exam.institutionId, selectedIds);

  // Fetch columns (each scoped to its grade)
  const columns = await db
    .select()
    .from(examinationColumns)
    .where(eq(examinationColumns.examinationId, id))
    .orderBy(examinationColumns.grade, examinationColumns.order);

  // Fetch students from selected classes — use a raw SQL approach to avoid
  // inArray variable limits. Join students → classes and filter by institution.
  const classIds: string[] = selectedIds;
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
    if (trimmedName.length > TEXT_LIMITS.examinationName) {
      throw new BadRequestError(`name must be at most ${TEXT_LIMITS.examinationName} characters`);
    }
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
    const nextIds: string[] = body.selectedClassIds;
    const prevIds: string[] = JSON.parse(exam.selectedClassIds || "[]");

    // Validate that every selected class belongs to this institution
    if (nextIds.length > 0) {
      const gradeByClass = await getGradesForClassIds(db, exam.institutionId, nextIds);
      const missing = nextIds.filter((cid) => !gradeByClass.has(cid));
      if (missing.length > 0) {
        throw new BadRequestError("One or more selected classes do not exist in this institution");
      }
    }

    // Clean up columns + cells for grades that lost their last section
    const prevGrades = await getGradesForClassIds(db, exam.institutionId, prevIds);
    const nextGrades = await getGradesForClassIds(db, exam.institutionId, nextIds);
    const removedGrades = [...new Set([...prevGrades.values()])].filter(
      (g) => g !== "" && ![...nextGrades.values()].includes(g)
    );
    if (removedGrades.length > 0) {
      await deleteGradesData(db, id, removedGrades);
      // Also drop orphaned cells of removed sections (students may have moved,
      // but cells keyed to removed sections' students are no longer reachable)
      const removedClassSet = new Set(prevIds.filter((cid) => !nextIds.includes(cid)));
      if (removedClassSet.size > 0) {
        const orphanStudents = await db
          .select({ id: students.id, classId: students.classId })
          .from(students)
          .where(eq(students.institutionId, exam.institutionId));
        const orphanIds = orphanStudents
          .filter((s) => removedClassSet.has(s.classId))
          .map((s) => s.id);
        for (let i = 0; i < orphanIds.length; i += 50) {
          const chunk = orphanIds.slice(i, i + 50);
          await db
            .delete(examinationCells)
            .where(
              and(
                eq(examinationCells.examinationId, id),
                inArray(examinationCells.studentId, chunk)
              )
            );
        }
      }
    }

    updateData.selectedClassIds = JSON.stringify(nextIds);
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

// ─── PUT /:id/columns — Replace a single grade's columns ──
// Columns are independent per grade: this endpoint replaces ONLY the
// columns of `body.grade`. Other grades are untouched.
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

  const grade: string =
    typeof body.grade === "string" ? body.grade.trim() : "";
  if (!grade) {
    throw new BadRequestError("grade is required");
  }

  // The grade must be part of this examination's selection
  const selectedIds: string[] = JSON.parse(exam.selectedClassIds || "[]");
  const gradeByClass = await getGradesForClassIds(db, exam.institutionId, selectedIds);
  if (![...gradeByClass.values()].includes(grade)) {
    throw new BadRequestError(`Grade ${grade} is not part of this examination`);
  }

  // Per-grade column-name uniqueness (case-insensitive)
  const seenNames = new Set<string>();
  for (const col of body.columns as any[]) {
    if (typeof col.name !== "string" || col.name.trim().length === 0) {
      throw new BadRequestError("Every column must have a non-empty name");
    }
    if (col.name.trim().length > TEXT_LIMITS.examinationColumnName) {
      throw new BadRequestError(`Column name must be at most ${TEXT_LIMITS.examinationColumnName} characters`);
    }
    if (!["number", "text", "formula"].includes(col.type)) {
      throw new BadRequestError(`Invalid column type "${col.type}"`);
    }
    if (col.type === "formula" && !(typeof col.formula === "string" && col.formula.trim().length > 0)) {
      throw new BadRequestError(`Formula is required for formula column "${col.name}"`);
    }
    if (col.formula && col.formula.length > TEXT_LIMITS.examinationFormula) {
      throw new BadRequestError(`Formula must be at most ${TEXT_LIMITS.examinationFormula} characters`);
    }
    const lower = col.name.trim().toLowerCase();
    if (seenNames.has(lower)) {
      throw new BadRequestError(`Duplicate column name "${col.name}" in Grade ${grade}`);
    }
    seenNames.add(lower);
  }

  const now = nowISO();

  // Get currently stored column IDs for THIS grade only
  const existingCols = await db
    .select({ id: examinationColumns.id })
    .from(examinationColumns)
    .where(
      and(
        eq(examinationColumns.examinationId, id),
        eq(examinationColumns.grade, grade)
      )
    );

  const existingIds = new Set(existingCols.map((c) => c.id));
  const incomingIds = new Set(
    (body.columns as any[]).filter((c) => c.id).map((c) => c.id as string)
  );

  // Delete only this grade's columns that are no longer in the incoming list,
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

  // Upsert each incoming column (scoped to this grade)
  const savedColumns: any[] = [];
  for (const col of body.columns as any[]) {
    const colId = col.id ?? uuid();
    if (existingIds.has(colId)) {
      // Update existing column — also guard it actually belongs to this grade+exam
      const [owned] = await db
        .select({ id: examinationColumns.id })
        .from(examinationColumns)
        .where(
          and(
            eq(examinationColumns.id, colId),
            eq(examinationColumns.examinationId, id),
            eq(examinationColumns.grade, grade)
          )
        )
        .limit(1);
      if (!owned) {
        throw new BadRequestError(`Column "${col.name}" does not belong to Grade ${grade} in this examination`);
      }
      const [updated] = await db
        .update(examinationColumns)
        .set({
          name: col.name.trim(),
          type: col.type,
          formula: col.formula ?? null,
          maxMarks: col.type === "number" ? (col.maxMarks ?? null) : null,
          order: col.order ?? 0,
          updatedAt: now,
        })
        .where(eq(examinationColumns.id, colId))
        .returning();
      savedColumns.push(updated);
    } else {
      // Insert new column (scoped to this grade)
      const [inserted] = await db
        .insert(examinationColumns)
        .values({
          id: colId,
          examinationId: id,
          grade,
          name: col.name.trim(),
          type: col.type,
          formula: col.formula ?? null,
          maxMarks: col.type === "number" ? (col.maxMarks ?? null) : null,
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

  // Preload columns (grade scope) + students (grade scope) for cross-grade validation
  const allColumns = await db
    .select({ id: examinationColumns.id, grade: examinationColumns.grade })
    .from(examinationColumns)
    .where(eq(examinationColumns.examinationId, id));
  const columnGrade = new Map(allColumns.map((c) => [c.id, c.grade ?? ""]));

  const selectedIds: string[] = JSON.parse(exam.selectedClassIds || "[]");
  const studentRows = await db
    .select({ id: students.id, classId: students.classId })
    .from(students)
    .where(
      and(
        eq(students.institutionId, exam.institutionId),
        eq(students.isDeleted, 0)
      )
    );
  const selectedSet = new Set(selectedIds);
  const studentClass = new Map<string, string>();
  for (const s of studentRows) {
    if (selectedSet.has(s.classId)) studentClass.set(s.id, s.classId);
  }
  const gradeByClass = await getGradesForClassIds(db, exam.institutionId, selectedIds);

  for (const cell of body.cells) {
    if (!cell.studentId || !cell.columnId) continue;

    // Column must belong to this examination
    if (!columnGrade.has(cell.columnId)) continue;

    // Student must belong to the examination's selection, and the student's
    // grade must match the column's grade (no cross-grade writes)
    const classId = studentClass.get(cell.studentId);
    if (!classId) continue;
    const colGrade = columnGrade.get(cell.columnId) ?? "";
    const stuGrade = gradeByClass.get(classId) ?? "";
    if (colGrade && stuGrade && colGrade !== stuGrade) {
      throw new BadRequestError(
        `Column does not belong to the student's grade (Grade ${stuGrade})`
      );
    }

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
