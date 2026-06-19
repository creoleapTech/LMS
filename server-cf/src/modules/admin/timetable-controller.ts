import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { v4 as uuid } from "uuid";
import { nowISO } from "../../lib/utils";
import { eq, and, sql, inArray } from "drizzle-orm";
import { adminAuth } from "../../middleware/admin-auth";
import { institutions, staff, classes } from "../../schema/admin";
import { gradeBooks, chapters, chapterContents } from "../../schema/books";
import { timetableEntries, periodConfigs } from "../../schema/settings";
import { classSessions } from "../../schema/staff";
import { classSessionTopics } from "../../schema/junction";
import {
  periodConfigPeriods,
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

function toDateKey(value: string | Date): string {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestError("Invalid date");
  // Use IST (UTC+5:30) calendar date, not UTC
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`;
}

function dateKeyToISOString(dateKey: string): string {
  // IST midnight in UTC = previous day 18:30 UTC
  return new Date(`${dateKey}T00:00:00+05:30`).toISOString();
}

function dateKeyEndISOString(dateKey: string): string {
  return new Date(`${dateKey}T23:59:59.999+05:30`).toISOString();
}

function isSameDateKey(value: string | null | undefined, dateKey: string): boolean {
  return !!value && toDateKey(value) === dateKey;
}

function recurringEntryForDate(entry: any, dateKey: string) {
  if (entry.status !== "completed") return entry;
  if (isSameDateKey(entry.completedAt, dateKey)) return entry;
  return { ...entry, status: "scheduled", completedAt: null, __omitTopicsCovered: true };
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

/** Batch-enrich timetable entries with class, gradeBook and topics. */
async function batchEnrichTimetableEntries(db: any, entries: any[]) {
  const allClassIds = [
    ...new Set(entries.flatMap((e) => [e.classId, e.additionalClassId].filter(Boolean))),
  ];
  const gbIds = [...new Set(entries.map((e) => e.gradeBookId).filter(Boolean))];
  const entryIds = entries.map((e) => e.id);

  const classMap = new Map<string, any>();
  if (allClassIds.length > 0) {
    const rows = await db
      .select({ id: classes.id, grade: classes.grade, section: classes.section, year: classes.year })
      .from(classes)
      .where(inArray(classes.id, allClassIds as string[]));
    for (const r of rows) classMap.set(r.id, r);
  }

  const gbMap = new Map<string, any>();
  if (gbIds.length > 0) {
    const rows = await db
      .select({ id: gradeBooks.id, bookTitle: gradeBooks.bookTitle, grade: gradeBooks.grade })
      .from(gradeBooks)
      .where(inArray(gradeBooks.id, gbIds));
    for (const r of rows) gbMap.set(r.id, r);
  }

  const topicsMap = new Map<string, string[]>();
  if (entryIds.length > 0) {
    const rows = await db
      .select({ timetableEntryId: timetableTopicsCovered.timetableEntryId, topic: timetableTopicsCovered.topic })
      .from(timetableTopicsCovered)
      .where(inArray(timetableTopicsCovered.timetableEntryId, entryIds));
    for (const r of rows) {
      const arr = topicsMap.get(r.timetableEntryId) || [];
      arr.push(r.topic);
      topicsMap.set(r.timetableEntryId, arr);
    }
  }

  return entries.map((entry) => {
    const { __omitTopicsCovered, ...entryWithoutInternalFields } = entry;
    return {
      ...entryWithoutInternalFields,
      classId: entry.classId ? classMap.get(entry.classId) || null : null,
      additionalClassId: entry.additionalClassId ? classMap.get(entry.additionalClassId) || null : null,
      gradeBookId: entry.gradeBookId ? gbMap.get(entry.gradeBookId) || null : null,
      topicsCovered: __omitTopicsCovered ? [] : topicsMap.get(entry.id) || [],
    };
  });
}

/** Build month summary dates from recurring + one-off entries. */
function buildMonthSummary(
  recurringEntries: any[],
  oneOffEntries: any[],
  workingDays: number[],
  year: number,
  month: number,
  topicsCoveredMap: Map<string, string[]>,
  cancelledEntries: any[] = [],
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
    const recurringForDay = recurringEntries
      .filter((e) => e.dayOfWeek === dow)
      .map((e) => recurringEntryForDate(e, dateStr));

    // One-off entries for this specific date
    const oneOffForDate = oneOffEntries.filter((e) => {
      if (!e.specificDate) return false;
      return toDateKey(e.specificDate) === dateStr;
    });

    // Cancelled periods for this specific date
    const cancelledPeriods = new Set(
      cancelledEntries
        .filter((e) => e.specificDate && toDateKey(e.specificDate) === dateStr)
        .map((e) => e.periodNumber),
    );

    // Merge: one-off overrides recurring for same periodNumber; cancelled periods excluded
    const overriddenPeriods = new Set(oneOffForDate.map((e: any) => e.periodNumber));
    const merged = [
      ...recurringForDay.filter((e: any) => !overriddenPeriods.has(e.periodNumber) && !cancelledPeriods.has(e.periodNumber)),
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
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const startDate = dateKeyToISOString(`${monthKey}-01`);
  const endDate = dateKeyEndISOString(`${monthKey}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`);

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

  // Get cancelled (deleted for specific day) entries in this month
  const cancelledEntries = await db
    .select({ periodNumber: timetableEntries.periodNumber, specificDate: timetableEntries.specificDate })
    .from(timetableEntries)
    .where(
      and(
        eq(timetableEntries.staffId, staffId),
        eq(timetableEntries.isRecurring, 0),
        eq(timetableEntries.isDeleted, 1),
        eq(timetableEntries.status, "cancelled"),
        sql`${timetableEntries.specificDate} >= ${startDate}`,
        sql`${timetableEntries.specificDate} <= ${endDate}`,
      ),
    );

  const dates = buildMonthSummary(recurringEntries, oneOffEntries, workingDays, year, month, new Map(), cancelledEntries);

  return c.json({ success: true, data: { dates } });
});

// ─── GET /my-day — teacher's day entries ───────────

timetableController.get("/my-day", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const staffId = user.id;
  const institutionId = resolveInstitutionId(user);
  const dateStr = c.req.query("date")!;
  const dateKey = toDateKey(dateStr);
  const dow = new Date(`${dateKey}T12:00:00+05:30`).getUTCDay();
  const db = getDb(c.env.DB);

  // Get period config
  const [pc] = await db
    .select()
    .from(periodConfigs)
    .where(and(eq(periodConfigs.institutionId, institutionId), eq(periodConfigs.isDeleted, 0)))
    .limit(1);

  let periodConfig: Record<string, any> | null = null;
  if (pc) {
    const [periods, workingDayRows] = await Promise.all([
      db
        .select({
          id: periodConfigPeriods.id,
          periodNumber: periodConfigPeriods.periodNumber,
          label: periodConfigPeriods.label,
          startTime: periodConfigPeriods.startTime,
          endTime: periodConfigPeriods.endTime,
          isBreak: periodConfigPeriods.isBreak,
        })
        .from(periodConfigPeriods)
        .where(eq(periodConfigPeriods.periodConfigId, pc.id)),
      db
        .select({ day: periodConfigWorkingDays.day })
        .from(periodConfigWorkingDays)
        .where(eq(periodConfigWorkingDays.periodConfigId, pc.id)),
    ]);

    periodConfig = {
      ...pc,
      periods,
      workingDays: workingDayRows.map((r: any) => r.day),
    };
  }

  // Get recurring entries for this day of week
  const rawRecurringEntries = await db
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
  const recurringEntries = rawRecurringEntries.map((entry: any) => recurringEntryForDate(entry, dateKey));

  // Get one-off entries for this specific date
  const dayStart = dateKeyToISOString(dateKey);
  const dayEnd = dateKeyEndISOString(dateKey);

  const oneOffEntries = await db
    .select()
    .from(timetableEntries)
    .where(
      and(
        eq(timetableEntries.staffId, staffId),
        eq(timetableEntries.isRecurring, 0),
        eq(timetableEntries.isDeleted, 0),
        sql`${timetableEntries.specificDate} >= ${dayStart}`,
        sql`${timetableEntries.specificDate} <= ${dayEnd}`,
      ),
    );

  // Query cancelled (deleted for this day) one-off entries to exclude those periods
  const cancelledEntries = await db
    .select({ periodNumber: timetableEntries.periodNumber })
    .from(timetableEntries)
    .where(
      and(
        eq(timetableEntries.staffId, staffId),
        eq(timetableEntries.isRecurring, 0),
        eq(timetableEntries.isDeleted, 1),
        eq(timetableEntries.status, "cancelled"),
        sql`${timetableEntries.specificDate} >= ${dayStart}`,
        sql`${timetableEntries.specificDate} <= ${dayEnd}`,
      ),
    );
  const cancelledPeriods = new Set(cancelledEntries.map((e) => e.periodNumber));

  // Merge: one-off overrides recurring for same periodNumber; cancelled periods excluded
  const overriddenPeriods = new Set(oneOffEntries.map((e) => e.periodNumber));
  const allEntries = [
    ...recurringEntries.filter((e) => !overriddenPeriods.has(e.periodNumber) && !cancelledPeriods.has(e.periodNumber)),
    ...oneOffEntries,
  ].sort((a, b) => (a.periodNumber ?? 0) - (b.periodNumber ?? 0));

  const enriched = await batchEnrichTimetableEntries(db, allEntries);

  return c.json({ success: true, data: { entries: enriched, periodConfig } });
});

// ─── GET /my-classes-list — teacher's classes (assigned or all in institution) ─

timetableController.get("/my-classes-list", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const staffId = user.id;
  const institutionId = user.institutionId;
  const db = getDb(c.env.DB);

  // First try: classes explicitly assigned to this teacher
  const junctionRows = await db
    .select({ classId: classTeacherIds.classId })
    .from(classTeacherIds)
    .where(eq(classTeacherIds.staffId, staffId));

  if (junctionRows.length > 0) {
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
  }

  // Fallback: return all active classes for the teacher's institution
  const result = await db
    .select({ id: classes.id, grade: classes.grade, section: classes.section, year: classes.year })
    .from(classes)
    .where(
      and(
        eq(classes.institutionId, institutionId),
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
    additionalClassId: body.additionalClassId || null,
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
  if (body.additionalClassId !== undefined) updates.additionalClassId = body.additionalClassId;
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
  const targetDateSource = body.date || entry.specificDate || now;
  const targetDateKey = toDateKey(targetDateSource);
  const targetSpecificDate = dateKeyToISOString(targetDateKey);

  if (!entry.staffId || !entry.classId || entry.periodNumber === null || entry.periodNumber === undefined) {
    throw new BadRequestError("Timetable entry must have staff, class and period assigned");
  }
  const entryStaffId = entry.staffId;
  const entryClassId = entry.classId;
  const entryPeriodNumber = entry.periodNumber;

  // ── Copy-on-complete for recurring entries ──
  // Create a one-off instance so completing one date doesn't affect all recurring dates
  const isRecurringInstance = entry.isRecurring === 1;
  let targetId = id;

  if (isRecurringInstance) {
    const [existingOneOff] = await db
      .select()
      .from(timetableEntries)
      .where(
        and(
          eq(timetableEntries.staffId, entryStaffId),
          eq(timetableEntries.periodNumber, entryPeriodNumber),
          eq(timetableEntries.isRecurring, 0),
          eq(timetableEntries.isDeleted, 0),
          sql`${timetableEntries.specificDate} >= ${targetDateKey}`,
          sql`${timetableEntries.specificDate} <= ${dateKeyEndISOString(targetDateKey)}`,
        ),
      )
      .limit(1);

    targetId = existingOneOff?.id || uuid();

    const completedValues = {
      institutionId: entry.institutionId,
      staffId: entryStaffId,
      classId: entryClassId,
      additionalClassId: body.additionalClassId !== undefined ? body.additionalClassId : entry.additionalClassId,
      gradeBookId: entry.gradeBookId,
      periodNumber: entry.periodNumber,
      dayOfWeek: entry.dayOfWeek,
      isRecurring: 0,
      specificDate: targetSpecificDate,
      notes: body.notes !== undefined ? body.notes : entry.notes,
      status: "completed" as const,
      completedAt: now,
      updatedAt: now,
    };

    if (existingOneOff) {
      await db.update(timetableEntries).set(completedValues).where(eq(timetableEntries.id, targetId));
    } else {
      await db.insert(timetableEntries).values({
        id: targetId,
        ...completedValues,
        isDeleted: 0,
        createdAt: now,
      });
    }

    await db
      .update(timetableEntries)
      .set({ status: "scheduled", completedAt: null, updatedAt: now })
      .where(eq(timetableEntries.id, id));
  } else {
    const updates: Record<string, any> = {
      status: "completed",
      completedAt: now,
      specificDate: targetSpecificDate,
      updatedAt: now,
    };
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.additionalClassId !== undefined) updates.additionalClassId = body.additionalClassId;
    await db.update(timetableEntries).set(updates).where(eq(timetableEntries.id, id));
  }

  // Insert topics covered into junction table
  await db.delete(timetableTopicsCovered).where(eq(timetableTopicsCovered.timetableEntryId, targetId));

  // Structured chapter/topic entries
  if (body.chapterTopics && Array.isArray(body.chapterTopics)) {
    for (const ct of body.chapterTopics) {
      await db.insert(timetableTopicsCovered).values({
        id: uuid(),
        timetableEntryId: targetId,
        topic: ct.contentTitle || ct.chapterTitle,
        chapterId: ct.chapterId || null,
        contentId: ct.contentId || null,
      });
    }
  }

  // Free-text topics (legacy / additional)
  if (body.topicsCovered && Array.isArray(body.topicsCovered)) {
    for (const topic of body.topicsCovered) {
      await db.insert(timetableTopicsCovered).values({
        id: uuid(),
        timetableEntryId: targetId,
        topic,
      });
    }
  }

  // ── Upsert linked class session ──
  const dayStart = dateKeyToISOString(targetDateKey);
  const dayEnd = dateKeyEndISOString(targetDateKey);

  function resolveTime(time: string | undefined, fallback: string): string {
    if (!time) return fallback;
    // If it's just HH:MM (time-only), combine with the IST date
    if (/^\d{1,2}:\d{2}$/.test(time)) {
      // Interpret HH:MM as IST time on the target date
      return new Date(`${targetDateKey}T${time.padStart(5, "0")}:00+05:30`).toISOString();
    }
    return new Date(time).toISOString();
  }
  const startTime = resolveTime(body.startTime, now);
  const endTime = resolveTime(body.endTime, now);
  const durationMinutes =
    body.durationMinutes ?? Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000);

  let existingSessions: any[] = [];
  if (body.sessionId) {
    const [existingById] = await db
      .select()
      .from(classSessions)
      .where(
        and(
          eq(classSessions.id, body.sessionId),
          eq(classSessions.staffId, entryStaffId),
          eq(classSessions.classId, entryClassId),
          sql`${classSessions.startTime} >= ${dayStart}`,
          sql`${classSessions.startTime} <= ${dayEnd}`,
        ),
      )
      .limit(1);
    if (existingById) existingSessions = [existingById];
  }

  if (existingSessions.length === 0) {
    existingSessions = await db
      .select()
      .from(classSessions)
      .where(
        and(
          eq(classSessions.staffId, entryStaffId),
          eq(classSessions.classId, entryClassId),
          sql`${classSessions.startTime} >= ${startTime}`,
          sql`${classSessions.startTime} <= ${endTime}`,
        ),
      )
      .limit(1);
  }

  let sessionId: string;
  if (existingSessions.length === 0) {
    sessionId = uuid();
    await db.insert(classSessions).values({
      id: sessionId,
      staffId: entryStaffId,
      institutionId: entry.institutionId,
      classId: entryClassId,
      courseId: entry.gradeBookId || null,
      startTime,
      endTime,
      durationMinutes,
      remarks: body.notes || null,
      status: "completed",
      createdAt: now,
      updatedAt: now,
    });
  } else {
    sessionId = existingSessions[0].id;
    await db
      .update(classSessions)
      .set({
        startTime,
        endTime,
        durationMinutes,
        remarks: body.notes || null,
        status: "completed",
        updatedAt: now,
      })
      .where(eq(classSessions.id, sessionId));

    // Remove existing topics and re-insert
    await db.delete(classSessionTopics).where(eq(classSessionTopics.sessionId, sessionId));
  }

  if (body.topicsCovered && Array.isArray(body.topicsCovered)) {
    for (const topic of body.topicsCovered) {
      await db.insert(classSessionTopics).values({
        id: uuid(),
        sessionId,
        topic,
      });
    }
  }
  // ── End class session link ──

  // Fetch updated/created entry with populated info
  const [updated] = await db.select().from(timetableEntries).where(eq(timetableEntries.id, targetId)).limit(1);

  const allClassIds = [updated.classId, updated.additionalClassId].filter(Boolean);
  const classMap = new Map<string, any>();
  if (allClassIds.length > 0) {
    const classRows = await db
      .select({ id: classes.id, grade: classes.grade, section: classes.section, year: classes.year })
      .from(classes)
      .where(inArray(classes.id, allClassIds as string[]));
    for (const cls of classRows) classMap.set(cls.id, cls);
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

  const topicRows = await db
    .select({
      topic: timetableTopicsCovered.topic,
      chapterId: timetableTopicsCovered.chapterId,
      contentId: timetableTopicsCovered.contentId,
    })
    .from(timetableTopicsCovered)
    .where(eq(timetableTopicsCovered.timetableEntryId, targetId));

  return c.json({
    success: true,
    data: {
      ...updated,
      classId: updated.classId ? classMap.get(updated.classId) || null : null,
      additionalClassId: updated.additionalClassId ? classMap.get(updated.additionalClassId) || null : null,
      gradeBookId: gradeBookInfo,
      topicsCovered: topicRows.map((t: any) => t.topic),
      chapterTopics: topicRows
        .filter((t: any) => t.chapterId)
        .map((t: any) => ({
          chapterId: t.chapterId,
          contentId: t.contentId,
        })),
    },
  });
});

// ─── DELETE /:id — soft delete ─────────────────────

timetableController.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const dateQuery = c.req.query("date");
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

  // ── One-off entry: just soft-delete ──
  if (entry.isRecurring === 0) {
    await db
      .update(timetableEntries)
      .set({ isDeleted: 1, updatedAt: now })
      .where(eq(timetableEntries.id, id));

    return c.json({ success: true, message: "Timetable entry deleted" });
  }

  // ── Recurring entry ──
  if (!entry.staffId || entry.periodNumber === null || entry.periodNumber === undefined) {
    throw new BadRequestError("Recurring entry must have staff and period assigned");
  }
  const entryStaffId = entry.staffId;
  const entryPeriodNumber = entry.periodNumber;

  // Check for existing one-off (workdone) entries for this recurring template
  const workdoneEntries = await db
    .select({ id: timetableEntries.id, status: timetableEntries.status, specificDate: timetableEntries.specificDate })
    .from(timetableEntries)
    .where(
      and(
        eq(timetableEntries.staffId, entryStaffId),
        eq(timetableEntries.periodNumber, entryPeriodNumber),
        eq(timetableEntries.isRecurring, 0),
        eq(timetableEntries.isDeleted, 0),
      ),
    );

  // If a specific date is provided, delete only that day's instance
  if (dateQuery) {
    const targetDateKey = toDateKey(dateQuery);

    // Check if there's a one-off entry for this date
    const oneOffForDate = workdoneEntries.find(
      (e: any) => e.specificDate && toDateKey(e.specificDate) === targetDateKey,
    );

    if (oneOffForDate) {
      // Soft-delete the one-off entry for this date
      await db
        .update(timetableEntries)
        .set({ isDeleted: 1, updatedAt: now })
        .where(eq(timetableEntries.id, oneOffForDate.id));
    } else {
      // No one-off exists — create a "cancelled" one-off to void this date
      const cancelId = uuid();
      await db.insert(timetableEntries).values({
        id: cancelId,
        institutionId: entry.institutionId,
        staffId: entryStaffId,
        classId: entry.classId,
        additionalClassId: entry.additionalClassId,
        gradeBookId: entry.gradeBookId,
        periodNumber: entryPeriodNumber,
        dayOfWeek: entry.dayOfWeek,
        isRecurring: 0,
        specificDate: dateKeyToISOString(targetDateKey),
        notes: entry.notes,
        status: "cancelled",
        isDeleted: 1,
        createdAt: now,
        updatedAt: now,
      });
    }

    return c.json({ success: true, message: "Removed for this day only" });
  }

  // No date provided — attempting to delete the recurring template
  if (workdoneEntries.length > 0) {
    throw new BadRequestError(
      `Cannot delete this recurring schedule because ${workdoneEntries.length} workdone entry(ies) exist. Remove this period for a specific day instead.`,
    );
  }

  // No workdone entries — safe to delete the recurring template
  await db
    .update(timetableEntries)
    .set({ isDeleted: 1, updatedAt: now })
    .where(eq(timetableEntries.id, id));

  return c.json({ success: true, message: "Recurring schedule deleted" });
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

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const startDate = dateKeyToISOString(`${monthKey}-01`);
  const endDate = dateKeyEndISOString(`${monthKey}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`);

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

  // Get cancelled (deleted for specific day) entries in this month
  const cancelledEntries = await db
    .select({ periodNumber: timetableEntries.periodNumber, specificDate: timetableEntries.specificDate })
    .from(timetableEntries)
    .where(
      and(
        eq(timetableEntries.staffId, staffId),
        eq(timetableEntries.isRecurring, 0),
        eq(timetableEntries.isDeleted, 1),
        eq(timetableEntries.status, "cancelled"),
        sql`${timetableEntries.specificDate} >= ${startDate}`,
        sql`${timetableEntries.specificDate} <= ${endDate}`,
      ),
    );

  const dates = buildMonthSummary(recurringEntries, oneOffEntries, workingDays, year, month, new Map(), cancelledEntries);

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
  const dateKey = toDateKey(dateStr);
  const dow = new Date(`${dateKey}T12:00:00+05:30`).getUTCDay();
  const db = getDb(c.env.DB);

  // Get period config
  const [pc] = await db
    .select()
    .from(periodConfigs)
    .where(and(eq(periodConfigs.institutionId, institutionId), eq(periodConfigs.isDeleted, 0)))
    .limit(1);

  let periodConfig: Record<string, any> | null = null;
  if (pc) {
    const [periods, workingDayRows] = await Promise.all([
      db
        .select({
          id: periodConfigPeriods.id,
          periodNumber: periodConfigPeriods.periodNumber,
          label: periodConfigPeriods.label,
          startTime: periodConfigPeriods.startTime,
          endTime: periodConfigPeriods.endTime,
          isBreak: periodConfigPeriods.isBreak,
        })
        .from(periodConfigPeriods)
        .where(eq(periodConfigPeriods.periodConfigId, pc.id)),
      db
        .select({ day: periodConfigWorkingDays.day })
        .from(periodConfigWorkingDays)
        .where(eq(periodConfigWorkingDays.periodConfigId, pc.id)),
    ]);

    periodConfig = {
      ...pc,
      periods,
      workingDays: workingDayRows.map((r: any) => r.day),
    };
  }

  const rawRecurringEntries = await db
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
  const recurringEntries = rawRecurringEntries.map((entry: any) => recurringEntryForDate(entry, dateKey));

  const dayStart = dateKeyToISOString(dateKey);
  const dayEnd = dateKeyEndISOString(dateKey);

  const oneOffEntries = await db
    .select()
    .from(timetableEntries)
    .where(
      and(
        eq(timetableEntries.staffId, staffId),
        eq(timetableEntries.isRecurring, 0),
        eq(timetableEntries.isDeleted, 0),
        sql`${timetableEntries.specificDate} >= ${dayStart}`,
        sql`${timetableEntries.specificDate} <= ${dayEnd}`,
      ),
    );

  // Query cancelled (deleted for this day) one-off entries to exclude those periods
  const cancelledEntries = await db
    .select({ periodNumber: timetableEntries.periodNumber })
    .from(timetableEntries)
    .where(
      and(
        eq(timetableEntries.staffId, staffId),
        eq(timetableEntries.isRecurring, 0),
        eq(timetableEntries.isDeleted, 1),
        eq(timetableEntries.status, "cancelled"),
        sql`${timetableEntries.specificDate} >= ${dayStart}`,
        sql`${timetableEntries.specificDate} <= ${dayEnd}`,
      ),
    );
  const cancelledPeriods = new Set(cancelledEntries.map((e) => e.periodNumber));

  const overriddenPeriods = new Set(oneOffEntries.map((e) => e.periodNumber));
  const allEntries = [
    ...recurringEntries.filter((e) => !overriddenPeriods.has(e.periodNumber) && !cancelledPeriods.has(e.periodNumber)),
    ...oneOffEntries,
  ].sort((a, b) => (a.periodNumber ?? 0) - (b.periodNumber ?? 0));

  const enriched = await batchEnrichTimetableEntries(db, allEntries);

  return c.json({ success: true, data: { entries: enriched, periodConfig } });
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
          sql`${timetableEntries.specificDate} >= ${dateKeyToISOString(`${year}-${String(month).padStart(2, "0")}-01`)}`,
          sql`${timetableEntries.specificDate} <= ${dateKeyEndISOString(`${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`)}`,
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
  const chapterIdsSet = new Set<string>();
  const contentIdsSet = new Set<string>();
  const topicChapterMap = new Map<string, { chapterId?: string; contentId?: string }>();
  for (const row of topicsRows) {
    const existing = topicsMap.get(row.timetableEntryId) || [];
    existing.push(row.topic);
    topicsMap.set(row.timetableEntryId, existing);
    if (row.chapterId) {
      chapterIdsSet.add(row.chapterId);
      topicChapterMap.set(row.id, { chapterId: row.chapterId, contentId: row.contentId });
    }
    if (row.contentId) contentIdsSet.add(row.contentId);
  }

  // Fetch chapter and content titles for structured entries
  const chapterMap = new Map<string, { title: string }>();
  if (chapterIdsSet.size > 0) {
    const chRows = await db
      .select({ id: chapters.id, title: chapters.title })
      .from(chapters)
      .where(inArray(chapters.id, [...chapterIdsSet]));
    for (const ch of chRows) chapterMap.set(ch.id, { title: ch.title || "" });
  }
  const contentMap = new Map<string, { title: string; chapterId: string }>();
  if (contentIdsSet.size > 0) {
    const ctRows = await db
      .select({ id: chapterContents.id, title: chapterContents.title, chapterId: chapterContents.chapterId })
      .from(chapterContents)
      .where(inArray(chapterContents.id, [...contentIdsSet]));
    for (const ct of ctRows) contentMap.set(ct.id, { title: ct.title || "", chapterId: ct.chapterId });
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

    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const recurringForDay = recurringEntries
      .filter((e: any) => e.dayOfWeek === dow)
      .map((e: any) => recurringEntryForDate(e, dateStr));
    const oneOffForDate = oneOffEntries.filter((e: any) => {
      if (!e.specificDate) return false;
      return toDateKey(e.specificDate) === dateStr;
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

      const entryTopics = entry.__omitTopicsCovered ? [] : topicsMap.get(entry.id) || [];

      // Collect chapter and content names from structured entries for this entry
      const entryTopicRows = entry.__omitTopicsCovered ? [] : topicsRows.filter((r: any) => r.timetableEntryId === entry.id);
      const chapterNames = new Set<string>();
      const contentNames: string[] = [];
      for (const tr of entryTopicRows) {
        if (tr.chapterId) {
          const ch = chapterMap.get(tr.chapterId);
          if (ch?.title) chapterNames.add(ch.title);
        }
        if (tr.contentId) {
          const ct = contentMap.get(tr.contentId);
          if (ct?.title) contentNames.push(ct.title);
        }
      }

      const chapterName = chapterNames.size > 0
        ? [...chapterNames].join(", ")
        : bookTitle;

      const topicName = contentNames.length > 0
        ? contentNames.join(", ")
        : entryTopics.join(", ");

      rows.push({
        date: `${d} ${monthName} ${year}`,
        className: grade,
        section,
        chapterName,
        topicName,
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

// ─── GET /work-done — super admin / admin view of all completed entries ───

timetableController.get("/work-done", async (c) => {
  const user = c.get("user") as Record<string, any>;
  if (user.role !== "super_admin" && user.role !== "admin") {
    throw new BadRequestError("Only super_admin and admin can access this");
  }

  const institutionId = c.req.query("institutionId");
  const staffId = c.req.query("staffId");
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");
  const page = Math.max(1, parseInt(c.req.query("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "50")));
  const offset = (page - 1) * limit;

  // Admin can only see their own institution
  const effectiveInstitutionId =
    user.role === "admin"
      ? resolveInstitutionId(user)
      : institutionId || undefined;

  const db = getDb(c.env.DB);

  const conditions: any[] = [
    eq(timetableEntries.status, "completed"),
    eq(timetableEntries.isDeleted, 0),
  ];

  if (effectiveInstitutionId) {
    conditions.push(eq(timetableEntries.institutionId, effectiveInstitutionId));
  }
  if (staffId) conditions.push(eq(timetableEntries.staffId, staffId));
  if (startDate) conditions.push(sql`${timetableEntries.completedAt} >= ${startDate}`);
  if (endDate) conditions.push(sql`${timetableEntries.completedAt} <= ${endDate}T23:59:59.999Z`);

  // Count total
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(timetableEntries)
    .where(and(...conditions));

  const total = Number(countResult?.count || 0);

  // Fetch entries
  const entries = await db
    .select()
    .from(timetableEntries)
    .where(and(...conditions))
    .orderBy(sql`${timetableEntries.completedAt} DESC`)
    .limit(limit)
    .offset(offset);

  // Enrich with staff, class, institution, gradeBook topics
  const staffIds: string[] = [...new Set(entries.map((e) => e.staffId).filter(Boolean))] as string[];
  const classIds: string[] = [...new Set(entries.map((e) => e.classId).filter(Boolean))] as string[];
  const instIds: string[] = [...new Set(entries.map((e) => e.institutionId).filter(Boolean))] as string[];
  const gbIds: string[] = [...new Set(entries.map((e) => e.gradeBookId).filter(Boolean))] as string[];
  const entryIds = entries.map((e) => e.id);

  const [staffRows, classRows, instRows, gbRows, topicRows] = await Promise.all([
    staffIds.length > 0
      ? db
          .select({ id: staff.id, name: staff.name, email: staff.email })
          .from(staff)
          .where(inArray(staff.id, staffIds))
      : [],
    classIds.length > 0
      ? db
          .select({ id: classes.id, grade: classes.grade, section: classes.section })
          .from(classes)
          .where(inArray(classes.id, classIds))
      : [],
    instIds.length > 0
      ? db
          .select({ id: institutions.id, name: institutions.name })
          .from(institutions)
          .where(inArray(institutions.id, instIds))
      : [],
    gbIds.length > 0
      ? db
          .select({ id: gradeBooks.id, bookTitle: gradeBooks.bookTitle })
          .from(gradeBooks)
          .where(inArray(gradeBooks.id, gbIds))
      : [],
    entryIds.length > 0
      ? db
          .select({
            entryId: timetableTopicsCovered.timetableEntryId,
            topic: timetableTopicsCovered.topic,
          })
          .from(timetableTopicsCovered)
          .where(inArray(timetableTopicsCovered.timetableEntryId, entryIds))
      : [],
  ]);

  const staffMap = new Map(staffRows.map((r) => [r.id, r]));
  const classMap = new Map(classRows.map((r) => [r.id, r]));
  const instMap = new Map(instRows.map((r) => [r.id, r]));
  const gbMap = new Map(gbRows.map((r) => [r.id, r]));

  const topicsMap = new Map<string, string[]>();
  for (const r of topicRows) {
    const arr = topicsMap.get(r.entryId) || [];
    arr.push(r.topic);
    topicsMap.set(r.entryId, arr);
  }

  const enriched = entries.map((entry) => ({
    ...entry,
    staff: entry.staffId ? staffMap.get(entry.staffId) || null : null,
    class: entry.classId ? classMap.get(entry.classId) || null : null,
    institution: entry.institutionId ? instMap.get(entry.institutionId) || null : null,
    gradeBook: entry.gradeBookId ? gbMap.get(entry.gradeBookId) || null : null,
    topicsCovered: topicsMap.get(entry.id) || [],
  }));

  return c.json({
    success: true,
    data: {
      entries: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  });
});

export { timetableController };
