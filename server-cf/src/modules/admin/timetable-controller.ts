import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { v4 as uuid } from "uuid";
import { nowISO } from "../../lib/utils";
import { eq, and, sql, inArray } from "drizzle-orm";
import { adminAuth } from "../../middleware/admin-auth";
import { institutions, staff, classes } from "../../schema/admin";
import { gradeBooks, chapters } from "../../schema/books";
import { timetableEntries, periodConfigs } from "../../schema/settings";
import {
  periodConfigWorkingDays,
  timetableTopicsCovered,
  classTeacherIds,
  institutionCurriculumAccess,
  institutionAccessibleGradebooks,
} from "../../schema/junction";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";
import {
  generateMonthlyReportDocx,
  type ReportRow,
} from "../../lib/monthly-report-docx";

const timetableController = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Apply auth to all routes
timetableController.use("*", adminAuth);

// ─── Helpers ───────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function resolveInstitutionId(user: Record<string, any>): string {
  const institutionId =
    typeof user.institutionId === "object"
      ? (user.institutionId as any)._id?.toString()
      : user.institutionId?.toString();
  if (!institutionId) throw new BadRequestError("Institution ID is required");
  return institutionId;
}

/** Fetch working days for an institution (defaults to Mon-Fri). */
async function getWorkingDays(db: any, institutionId: string): Promise<number[]> {
  const [pc] = await db
    .select({ id: periodConfigs.id })
    .from(periodConfigs)
    .where(and(eq(periodConfigs.institutionId, institutionId), eq(periodConfigs.isDeleted, 0)))
    .limit(1);

  if (!pc) return [1, 2, 3, 4, 5];

  const rows = await db
    .select({ day: periodConfigWorkingDays.day })
    .from(periodConfigWorkingDays)
    .where(eq(periodConfigWorkingDays.periodConfigId, pc.id));

  return rows.length > 0 ? rows.map((r: any) => r.day) : [1, 2, 3, 4, 5];
}

/** Build month summary dates from recurring + one-off entries. */
function buildMonthSummary(
  recurringEntries: any[],
  oneOffEntries: any[],
  workingDays: number[],
  year: number,
  month: number,
  topicsCoveredMap: Map<string, string[]>,
) {
  const endDate = new Date(year, month, 0); // last day of month
  const daysInMonth = endDate.getDate();
  const dates: Record<string, { entryCount: number; hasCompleted: boolean }> = {};

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    if (!workingDays.includes(dow)) continue;

    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    // Recurring entries for this day of week
    const recurringForDay = recurringEntries.filter(
      (e) => e.dayOfWeek === dow,
    );

    // One-off entries for this specific date
    const oneOffForDate = oneOffEntries.filter((e) => {
      if (!e.specificDate) return false;
      const sd = new Date(e.specificDate);
      return (
        sd.getFullYear() === year &&
        sd.getMonth() === month - 1 &&
        sd.getDate() === d
      );
    });

    // Merge: one-off overrides recurring for same periodNumber
    const overriddenPeriods = new Set(oneOffForDate.map((e: any) => e.periodNumber));
    const merged = [
      ...recurringForDay.filter((e: any) => !overriddenPeriods.has(e.periodNumber)),
      ...oneOffForDate,
    ];

    if (merged.length > 0) {
      dates[dateStr] = {
        entryCount: merged.length,
        hasCompleted: merged.some((e: any) => e.status === "completed"),
      };
    }
  }

  return dates;
}

// ─── GET /my-month — teacher's month view ──────────

timetableController.get("/my-month", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const staffId = user.id;
  const institutionId = resolveInstitutionId(user);
  const year = Number(c.req.query("year"));
  const month = Number(c.req.query("month"));
  const db = getDb(c.env.DB);

  const workingDays = await getWorkingDays(db, institutionId);

  // Get all recurring entries for this teacher
  const recurringEntries = await db
    .select()
    .from(timetableEntries)
    .where(
      and(
        eq(timetableEntries.staffId, staffId),
        eq(timetableEntries.isRecurring, 1),
        eq(timetableEntries.isDeleted, 0),
      ),
    );

  // Date range for the month
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

  // Get one-off entries in this month
  const oneOffEntries = await db
    .select()
    .from(timetableEntries)
    .where(
      and(
        eq(timetableEntries.staffId, staffId),
        eq(timetableEntries.isRecurring, 0),
        eq(timetableEntries.isDeleted, 0),
        sql`${timetableEntries.specificDate} >= ${startDate}`,
        sql`${timetableEntries.specificDate} <= ${endDate}`,
      ),
    );

  const dates = buildMonthSummary(recurringEntries, oneOffEntries, workingDays, year, month, new Map());

  return c.json({ success: true, data: { dates } });
});

// ─── GET /my-day — teacher's day entries ───────────

timetableController.get("/my-day", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const staffId = user.id;
  const institutionId = resolveInstitutionId(user);
  const dateStr = c.req.query("date")!;
  const date = new Date(dateStr);
  const dow = date.getDay();
  const db = getDb(c.env.DB);

  // Get period config
  const [pc] = await db
    .select()
    .from(periodConfigs)
    .where(and(eq(periodConfigs.institutionId, institutionId), eq(periodConfigs.isDeleted, 0)))
    .limit(1);

  // Get recurring entries for this day of week
  const recurringEntries = await db
    .select()
    .from(timetableEntries)
    .where(
      and(
        eq(timetableEntries.staffId, staffId),
        eq(timetableEntries.dayOfWeek, dow),
        eq(timetableEntries.isRecurring, 1),
        eq(timetableEntries.isDeleted, 0),
      ),
    );

  // Get one-off entries for this specific date
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const oneOffEntries = await db
    .select()
    .from(timetableEntries)
    .where(
      and(
        eq(timetableEntries.staffId, staffId),
        eq(timetableEntries.isRecurring, 0),
        eq(timetableEntries.isDeleted, 0),
        sql`${timetableEntries.specificDate} >= ${dayStart.toISOString()}`,
        sql`${timetableEntries.specificDate} <= ${dayEnd.toISOString()}`,
      ),
    );

  // Merge: one-off overrides recurring for same periodNumber
  const overriddenPeriods = new Set(oneOffEntries.map((e) => e.periodNumber));
  const allEntries = [
    ...recurringEntries.filter((e) => !overriddenPeriods.has(e.periodNumber)),
    ...oneOffEntries,
  ].sort((a, b) => (a.periodNumber ?? 0) - (b.periodNumber ?? 0));

  // Populate class and gradeBook info for each entry
  const enriched = await Promise.all(
    allEntries.map(async (entry) => {
      let classInfo = null;
      let gradeBookInfo = null;

      if (entry.classId) {
        const [cls] = await db
          .select({ id: classes.id, grade: classes.grade, section: classes.section, year: classes.year })
          .from(classes)
          .where(eq(classes.id, entry.classId))
          .limit(1);
        classInfo = cls || null;
      }

      if (entry.gradeBookId) {
        const [gb] = await db
          .select({ id: gradeBooks.id, bookTitle: gradeBooks.bookTitle, grade: gradeBooks.grade })
          .from(gradeBooks)
          .where(eq(gradeBooks.id, entry.gradeBookId))
          .limit(1);
        gradeBookInfo = gb || null;
      }

      // Get topics covered for this entry
      const topics = await db
        .select({ topic: timetableTopicsCovered.topic })
        .from(timetableTopicsCovered)
        .where(eq(timetableTopicsCovered.timetableEntryId, entry.id));

      return {
        ...entry,
        classId: classInfo,
        gradeBookId: gradeBookInfo,
        topicsCovered: topics.map((t: any) => t.topic),
      };
    }),
  );

  return c.json({ success: true, data: { entries: enriched, periodConfig: pc || null } });
});

// ─── GET /my-classes-list — teacher's assigned classes ─

timetableController.get("/my-classes-list", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const staffId = user.id;
  const db = getDb(c.env.DB);

  // Find classes through the classTeacherIds junction
  const junctionRows = await db
    .select({ classId: classTeacherIds.classId })
    .from(classTeacherIds)
    .where(eq(classTeacherIds.staffId, staffId));

  if (junctionRows.length === 0) {
    return c.json({ success: true, data: [] });
  }

  const classIds = junctionRows.map((r: any) => r.classId);
  const result = await db
    .select({ id: classes.id, grade: classes.grade, section: classes.section, year: classes.year })
    .from(classes)
    .where(
      and(
        inArray(classes.id, classIds),
        eq(classes.isDeleted, 0),
        eq(classes.isActive, 1),
      ),
    );

  return c.json({ success: true, data: result });
});

// ─── GET /gradebooks — gradebooks matching a grade ─

timetableController.get("/gradebooks", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const institutionId = resolveInstitutionId(user);
  const grade = Number(c.req.query("grade"));
  const db = getDb(c.env.DB);

  // Get institution's accessible gradebooks
  const accessRows = await db
    .select({ id: institutionCurriculumAccess.id })
    .from(institutionCurriculumAccess)
    .where(eq(institutionCurriculumAccess.institutionId, institutionId));

  let accessibleGradeBookIds: string[] = [];
  if (accessRows.length > 0) {
    const accessIds = accessRows.map((a: any) => a.id);
    const gbRows = await db
      .select({ gradeBookId: institutionAccessibleGradebooks.gradeBookId })
      .from(institutionAccessibleGradebooks)
      .where(inArray(institutionAccessibleGradebooks.accessId, accessIds));
    accessibleGradeBookIds = gbRows.map((r: any) => r.gradeBookId);
  }

  let result;
  if (accessibleGradeBookIds.length > 0) {
    result = await db
      .select({ id: gradeBooks.id, bookTitle: gradeBooks.bookTitle, grade: gradeBooks.grade, curriculumId: gradeBooks.curriculumId })
      .from(gradeBooks)
      .where(
        and(
          eq(gradeBooks.grade, grade),
          eq(gradeBooks.isPublished, 1),
          inArray(gradeBooks.id, accessibleGradeBookIds),
        ),
      );
  } else {
    result = await db
      .select({ id: gradeBooks.id, bookTitle: gradeBooks.bookTitle, grade: gradeBooks.grade, curriculumId: gradeBooks.curriculumId })
      .from(gradeBooks)
      .where(
        and(eq(gradeBooks.grade, grade), eq(gradeBooks.isPublished, 1)),
      );
  }

  return c.json({ success: true, data: result });
});

// ─── POST / — create timetable entry ──────────────

timetableController.post("/", async (c) => {
  const body = await c.req.json();
  const user = c.get("user") as Record<string, any>;
  const staffId = user.id;
  const institutionId = resolveInstitutionId(user);
  const db = getDb(c.env.DB);

  // Conflict check: teacher already has this slot
  const teacherConflictConditions = [
    eq(timetableEntries.staffId, staffId),
    eq(timetableEntries.dayOfWeek, body.dayOfWeek),
    eq(timetableEntries.periodNumber, body.periodNumber),
    eq(timetableEntries.isRecurring, body.isRecurring ? 1 : 0),
    eq(timetableEntries.isDeleted, 0),
  ];
  if (!body.isRecurring && body.specificDate) {
    teacherConflictConditions.push(
      eq(timetableEntries.specificDate, new Date(body.specificDate).toISOString()),
    );
  }

  const [teacherConflict] = await db
    .select({ id: timetableEntries.id })
    .from(timetableEntries)
    .where(and(...teacherConflictConditions))
    .limit(1);

  if (teacherConflict) {
    throw new BadRequestError("You already have a class scheduled for this period");
  }

  // Conflict check: class already has a teacher at this slot
  const classConflictConditions = [
    eq(timetableEntries.classId, body.classId),
    eq(timetableEntries.dayOfWeek, body.dayOfWeek),
    eq(timetableEntries.periodNumber, body.periodNumber),
    eq(timetableEntries.isRecurring, body.isRecurring ? 1 : 0),
    eq(timetableEntries.isDeleted, 0),
  ];
  if (!body.isRecurring && body.specificDate) {
    classConflictConditions.push(
      eq(timetableEntries.specificDate, new Date(body.specificDate).toISOString()),
    );
  }

  const [classConflict] = await db
    .select({ id: timetableEntries.id })
    .from(timetableEntries)
    .where(and(...classConflictConditions))
    .limit(1);

  if (classConflict) {
    throw new BadRequestError("This class already has a teacher assigned for this period");
  }

  const id = uuid();
  const now = nowISO();

  await db.insert(timetableEntries).values({
    id,
    institutionId,
    staffId,
    classId: body.classId,
    gradeBookId: body.gradeBookId || null,
    periodNumber: body.periodNumber,
    dayOfWeek: body.dayOfWeek,
    isRecurring: body.isRecurring ? 1 : 0,
    specificDate: !body.isRecurring && body.specificDate ? new Date(body.specificDate).toISOString() : null,
    notes: body.notes || null,
    status: "scheduled",
    isDeleted: 0,
    createdAt: now,
    updatedAt: now,
  });

  // Fetch the created entry with populated class/gradeBook info
  const [entry] = await db.select().from(timetableEntries).where(eq(timetableEntries.id, id)).limit(1);

  let classInfo = null;
  if (entry.classId) {
    const [cls] = await db
      .select({ id: classes.id, grade: classes.grade, section: classes.section, year: classes.year })
      .from(classes)
      .where(eq(classes.id, entry.classId))
      .limit(1);
    classInfo = cls || null;
  }

  let gradeBookInfo = null;
  if (entry.gradeBookId) {
    const [gb] = await db
      .select({ id: gradeBooks.id, bookTitle: gradeBooks.bookTitle, grade: gradeBooks.grade })
      .from(gradeBooks)
      .where(eq(gradeBooks.id, entry.gradeBookId))
      .limit(1);
    gradeBookInfo = gb || null;
  }

  return c.json(
    { success: true, data: { ...entry, classId: classInfo, gradeBookId: gradeBookInfo } },
    201,
  );
});

// ─── PATCH /:id — update timetable entry ──────────

timetableController.patch("/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const db = getDb(c.env.DB);

  const [entry] = await db
    .select()
    .from(timetableEntries)
    .where(and(eq(timetableEntries.id, id), eq(timetableEntries.isDeleted, 0)))
    .limit(1);

  if (!entry) {
    throw new BadRequestError("Timetable entry not found");
  }

  const updates: Record<string, any> = { updatedAt: nowISO() };
  if (body.classId) updates.classId = body.classId;
  if (body.gradeBookId) updates.gradeBookId = body.gradeBookId;
  if (body.notes !== undefined) updates.notes = body.notes;

  await db.update(timetableEntries).set(updates).where(eq(timetableEntries.id, id));

  // Fetch updated entry with populated info
  const [updated] = await db.select().from(timetableEntries).where(eq(timetableEntries.id, id)).limit(1);

  let classInfo = null;
  if (updated.classId) {
    const [cls] = await db
      .select({ id: classes.id, grade: classes.grade, section: classes.section, year: classes.year })
      .from(classes)
      .where(eq(classes.id, updated.classId))
      .limit(1);
    classInfo = cls || null;
  }

  let gradeBookInfo = null;
  if (updated.gradeBookId) {
    const [gb] = await db
      .select({ id: gradeBooks.id, bookTitle: gradeBooks.bookTitle, grade: gradeBooks.grade })
      .from(gradeBooks)
      .where(eq(gradeBooks.id, updated.gradeBookId))
      .limit(1);
    gradeBookInfo = gb || null;
  }

  return c.json({ success: true, data: { ...updated, classId: classInfo, gradeBookId: gradeBookInfo } });
});

// ─── PATCH /:id/complete — mark entry completed ───

timetableController.patch("/:id/complete", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const db = getDb(c.env.DB);

  const [entry] = await db
    .select()
    .from(timetableEntries)
    .where(and(eq(timetableEntries.id, id), eq(timetableEntries.isDeleted, 0)))
    .limit(1);

  if (!entry) {
    throw new BadRequestError("Timetable entry not found");
  }

  const now = nowISO();
  const updates: Record<string, any> = {
    status: "completed",
    completedAt: now,
    updatedAt: now,
  };
  if (body.notes !== undefined) updates.notes = body.notes;

  await db.update(timetableEntries).set(updates).where(eq(timetableEntries.id, id));

  // Insert topics covered into junction table
  if (body.topicsCovered && Array.isArray(body.topicsCovered)) {
    // Remove existing topics first
    await db.delete(timetableTopicsCovered).where(eq(timetableTopicsCovered.timetableEntryId, id));

    for (const topic of body.topicsCovered) {
      await db.insert(timetableTopicsCovered).values({
        id: uuid(),
        timetableEntryId: id,
        topic,
      });
    }
  }

  // Fetch updated entry with populated info
  const [updated] = await db.select().from(timetableEntries).where(eq(timetableEntries.id, id)).limit(1);

  let classInfo = null;
  if (updated.classId) {
    const [cls] = await db
      .select({ id: classes.id, grade: classes.grade, section: classes.section, year: classes.year })
      .from(classes)
      .where(eq(classes.id, updated.classId))
      .limit(1);
    classInfo = cls || null;
  }

  let gradeBookInfo = null;
  if (updated.gradeBookId) {
    const [gb] = await db
      .select({ id: gradeBooks.id, bookTitle: gradeBooks.bookTitle, grade: gradeBooks.grade })
      .from(gradeBooks)
      .where(eq(gradeBooks.id, updated.gradeBookId))
      .limit(1);
    gradeBookInfo = gb || null;
  }

  const topics = await db
    .select({ topic: timetableTopicsCovered.topic })
    .from(timetableTopicsCovered)
    .where(eq(timetableTopicsCovered.timetableEntryId, id));

  return c.json({
    success: true,
    data: {
      ...updated,
      classId: classInfo,
      gradeBookId: gradeBookInfo,
      topicsCovered: topics.map((t: any) => t.topic),
    },
  });
});

// ─── DELETE /:id — soft delete ─────────────────────

timetableController.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const db = getDb(c.env.DB);

  const [entry] = await db
    .select()
    .from(timetableEntries)
    .where(and(eq(timetableEntries.id, id), eq(timetableEntries.isDeleted, 0)))
    .limit(1);

  if (!entry) {
    throw new BadRequestError("Timetable entry not found");
  }

  await db
    .update(timetableEntries)
    .set({ isDeleted: 1, updatedAt: nowISO() })
    .where(eq(timetableEntries.id, id));

  return c.json({ success: true, message: "Timetable entry deleted" });
});

// ═══ Admin endpoints ═══════════════════════════════

// ─── GET /staff-list — admin: list staff ──────────

timetableController.get("/staff-list", async (c) => {
  const user = c.get("user") as Record<string, any>;
  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new BadRequestError("Only admin/super_admin can access this");
  }

  let institutionId = c.req.query("institutionId");
  if (!institutionId && user.role === "admin") {
    institutionId = resolveInstitutionId(user);
  }
  if (!institutionId) throw new BadRequestError("Institution ID is required");

  const db = getDb(c.env.DB);

  const staffList = await db
    .select({
      id: staff.id,
      name: staff.name,
      email: staff.email,
      type: staff.type,
    })
    .from(staff)
    .where(
      and(
        eq(staff.institutionId, institutionId),
        eq(staff.isDeleted, 0),
        eq(staff.isActive, 1),
      ),
    );

  return c.json({ success: true, data: staffList });
});

// ─── GET /staff-month — admin: month view for a teacher ─

timetableController.get("/staff-month", async (c) => {
  const user = c.get("user") as Record<string, any>;
  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new BadRequestError("Only admin/super_admin can access this");
  }

  const staffId = c.req.query("staffId");
  const institutionId = c.req.query("institutionId");
  if (!staffId || !institutionId) {
    throw new BadRequestError("staffId and institutionId are required");
  }

  const year = Number(c.req.query("year"));
  const month = Number(c.req.query("month"));
  const db = getDb(c.env.DB);

  const workingDays = await getWorkingDays(db, institutionId);

  const recurringEntries = await db
    .select()
    .from(timetableEntries)
    .where(
      and(
        eq(timetableEntries.staffId, staffId),
        eq(timetableEntries.isRecurring, 1),
        eq(timetableEntries.isDeleted, 0),
      ),
    );

  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

  const oneOffEntries = await db
    .select()
    .from(timetableEntries)
    .where(
      and(
        eq(timetableEntries.staffId, staffId),
        eq(timetableEntries.isRecurring, 0),
        eq(timetableEntries.isDeleted, 0),
        sql`${timetableEntries.specificDate} >= ${startDate}`,
        sql`${timetableEntries.specificDate} <= ${endDate}`,
      ),
    );

  const dates = buildMonthSummary(recurringEntries, oneOffEntries, workingDays, year, month, new Map());

  return c.json({ success: true, data: { dates } });
});

// ─── GET /staff-day — admin: day entries for a teacher ─

timetableController.get("/staff-day", async (c) => {
  const user = c.get("user") as Record<string, any>;
  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new BadRequestError("Only admin/super_admin can access this");
  }

  const staffId = c.req.query("staffId");
  const institutionId = c.req.query("institutionId");
  if (!staffId || !institutionId) {
    throw new BadRequestError("staffId and institutionId are required");
  }

  const dateStr = c.req.query("date")!;
  const date = new Date(dateStr);
  const dow = date.getDay();
  const db = getDb(c.env.DB);

  // Get period config
  const [pc] = await db
    .select()
    .from(periodConfigs)
    .where(and(eq(periodConfigs.institutionId, institutionId), eq(periodConfigs.isDeleted, 0)))
    .limit(1);

  const recurringEntries = await db
    .select()
    .from(timetableEntries)
    .where(
      and(
        eq(timetableEntries.staffId, staffId),
        eq(timetableEntries.dayOfWeek, dow),
        eq(timetableEntries.isRecurring, 1),
        eq(timetableEntries.isDeleted, 0),
      ),
    );

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const oneOffEntries = await db
    .select()
    .from(timetableEntries)
    .where(
      and(
        eq(timetableEntries.staffId, staffId),
        eq(timetableEntries.isRecurring, 0),
        eq(timetableEntries.isDeleted, 0),
        sql`${timetableEntries.specificDate} >= ${dayStart.toISOString()}`,
        sql`${timetableEntries.specificDate} <= ${dayEnd.toISOString()}`,
      ),
    );

  const overriddenPeriods = new Set(oneOffEntries.map((e) => e.periodNumber));
  const allEntries = [
    ...recurringEntries.filter((e) => !overriddenPeriods.has(e.periodNumber)),
    ...oneOffEntries,
  ].sort((a, b) => (a.periodNumber ?? 0) - (b.periodNumber ?? 0));

  // Populate class and gradeBook info
  const enriched = await Promise.all(
    allEntries.map(async (entry) => {
      let classInfo = null;
      let gradeBookInfo = null;

      if (entry.classId) {
        const [cls] = await db
          .select({ id: classes.id, grade: classes.grade, section: classes.section, year: classes.year })
          .from(classes)
          .where(eq(classes.id, entry.classId))
          .limit(1);
        classInfo = cls || null;
      }

      if (entry.gradeBookId) {
        const [gb] = await db
          .select({ id: gradeBooks.id, bookTitle: gradeBooks.bookTitle, grade: gradeBooks.grade })
          .from(gradeBooks)
          .where(eq(gradeBooks.id, entry.gradeBookId))
          .limit(1);
        gradeBookInfo = gb || null;
      }

      const topics = await db
        .select({ topic: timetableTopicsCovered.topic })
        .from(timetableTopicsCovered)
        .where(eq(timetableTopicsCovered.timetableEntryId, entry.id));

      return {
        ...entry,
        classId: classInfo,
        gradeBookId: gradeBookInfo,
        topicsCovered: topics.map((t: any) => t.topic),
      };
    }),
  );

  return c.json({ success: true, data: { entries: enriched, periodConfig: pc || null } });
});

// ═══ Monthly Report endpoints ═════════════════════

async function buildMonthlyReport(
  db: any,
  staffId: string,
  institutionId: string,
  year: number,
  month: number,
): Promise<Uint8Array> {
  const workingDays = await getWorkingDays(db, institutionId);

  // Fetch all needed data in parallel
  const [staffRow, institutionRow, recurringEntries, oneOffEntries] = await Promise.all([
    db
      .select({ id: staff.id, name: staff.name, salutation: staff.salutation })
      .from(staff)
      .where(eq(staff.id, staffId))
      .limit(1)
      .then((r: any[]) => r[0] || null),
    db
      .select({ id: institutions.id, name: institutions.name })
      .from(institutions)
      .where(eq(institutions.id, institutionId))
      .limit(1)
      .then((r: any[]) => r[0] || null),
    db
      .select()
      .from(timetableEntries)
      .where(
        and(
          eq(timetableEntries.staffId, staffId),
          eq(timetableEntries.isRecurring, 1),
          eq(timetableEntries.isDeleted, 0),
        ),
      ),
    db
      .select()
      .from(timetableEntries)
      .where(
        and(
          eq(timetableEntries.staffId, staffId),
          eq(timetableEntries.isRecurring, 0),
          eq(timetableEntries.isDeleted, 0),
          sql`${timetableEntries.specificDate} >= ${new Date(year, month - 1, 1).toISOString()}`,
          sql`${timetableEntries.specificDate} <= ${new Date(year, month, 0, 23, 59, 59).toISOString()}`,
        ),
      ),
  ]);

  // Get all entry IDs for topics lookup
  const allEntryIds = [...recurringEntries, ...oneOffEntries].map((e: any) => e.id);

  // Batch fetch topics covered
  const topicsRows = allEntryIds.length > 0
    ? await db
        .select()
        .from(timetableTopicsCovered)
        .where(inArray(timetableTopicsCovered.timetableEntryId, allEntryIds))
    : [];

  const topicsMap = new Map<string, string[]>();
  for (const row of topicsRows) {
    const existing = topicsMap.get(row.timetableEntryId) || [];
    existing.push(row.topic);
    topicsMap.set(row.timetableEntryId, existing);
  }

  // Batch fetch class and gradeBook info
  const classIds = [...new Set([...recurringEntries, ...oneOffEntries].map((e: any) => e.classId).filter(Boolean))];
  const gbIds = [...new Set([...recurringEntries, ...oneOffEntries].map((e: any) => e.gradeBookId).filter(Boolean))];

  const classMap = new Map<string, any>();
  if (classIds.length > 0) {
    const classRows = await db
      .select({ id: classes.id, grade: classes.grade, section: classes.section, year: classes.year })
      .from(classes)
      .where(inArray(classes.id, classIds));
    for (const cls of classRows) classMap.set(cls.id, cls);
  }

  const gbMap = new Map<string, any>();
  if (gbIds.length > 0) {
    const gbRows = await db
      .select({ id: gradeBooks.id, bookTitle: gradeBooks.bookTitle, grade: gradeBooks.grade })
      .from(gradeBooks)
      .where(inArray(gradeBooks.id, gbIds));
    for (const gb of gbRows) gbMap.set(gb.id, gb);
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const monthName = MONTH_NAMES[month - 1];
  const trainerName = staffRow
    ? `${staffRow.salutation || ""}${staffRow.salutation ? "." : ""}${staffRow.name || ""}`
    : "";

  const rows: ReportRow[] = [];
  const classSet = new Set<string>();
  const subjectSet = new Set<string>();
  let completedCount = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    if (!workingDays.includes(dow)) continue;

    const recurringForDay = recurringEntries.filter((e: any) => e.dayOfWeek === dow);
    const oneOffForDate = oneOffEntries.filter((e: any) => {
      if (!e.specificDate) return false;
      const sd = new Date(e.specificDate);
      return sd.getFullYear() === year && sd.getMonth() === month - 1 && sd.getDate() === d;
    });

    const overriddenPeriods = new Set(oneOffForDate.map((e: any) => e.periodNumber));
    const merged = [
      ...recurringForDay.filter((e: any) => !overriddenPeriods.has(e.periodNumber)),
      ...oneOffForDate,
    ].sort((a: any, b: any) => (a.periodNumber ?? 0) - (b.periodNumber ?? 0));

    for (const entry of merged) {
      const classObj = classMap.get(entry.classId);
      const bookObj = gbMap.get(entry.gradeBookId);

      const grade = classObj?.grade || "";
      const section = classObj?.section || "";
      const bookTitle = bookObj?.bookTitle || "";

      if (grade) classSet.add(`${grade}${section ? "," + section : ""}`);
      if (bookTitle) subjectSet.add(bookTitle);
      if (entry.status === "completed") completedCount++;

      const entryTopics = topicsMap.get(entry.id) || [];

      rows.push({
        date: `${d} ${monthName} ${year}`,
        className: grade,
        section,
        chapterName: bookTitle,
        topicName: entryTopics.join(", "),
        remarks: "",
      });
    }
  }

  const buffer = await generateMonthlyReportDocx({
    monthName,
    year,
    staffNames: [trainerName],
    schoolName: institutionRow?.name || "",
    classesLabel: Array.from(classSet).join(", ") || "\u2014",
    subjectLabel: Array.from(subjectSet).join(", ") || "\u2014",
    sessionsPlanned: rows.length,
    sessionsCompleted: completedCount,
    rows,
  });

  return buffer;
}

// ─── GET /my-monthly-report — teacher's DOCX ──────

timetableController.get("/my-monthly-report", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    const staffId = user.id;
    const institutionId = resolveInstitutionId(user);
    const year = Number(c.req.query("year"));
    const month = Number(c.req.query("month"));
    const db = getDb(c.env.DB);

    const buffer = await buildMonthlyReport(db, staffId, institutionId, year, month);
    const monthName = MONTH_NAMES[month - 1];

    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="Monthly_Report_${monthName}_${year}.docx"`,
      },
    });
  } catch (err) {
    console.error("Monthly report error:", err);
    return c.json({ success: false, message: "Failed to generate report" }, 500);
  }
});

// ─── GET /staff-monthly-report — admin's DOCX ─────

timetableController.get("/staff-monthly-report", async (c) => {
  const user = c.get("user") as Record<string, any>;
  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new BadRequestError("Only admin/super_admin can access this");
  }

  const staffId = c.req.query("staffId");
  const institutionId = c.req.query("institutionId");
  if (!staffId || !institutionId) {
    throw new BadRequestError("staffId and institutionId are required");
  }

  const year = Number(c.req.query("year"));
  const month = Number(c.req.query("month"));
  const db = getDb(c.env.DB);

  const buffer = await buildMonthlyReport(db, staffId, institutionId, year, month);
  const monthName = MONTH_NAMES[month - 1];

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="Monthly_Report_${monthName}_${year}.docx"`,
    },
  });
});

export { timetableController };
