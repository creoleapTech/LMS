import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { v4 as uuid } from "uuid";
import { nowISO } from "../../lib/utils";
import { eq, and, or, sql, inArray, desc } from "drizzle-orm";
import { adminAuth } from "../../middleware/admin-auth";
import { institutions, staff, classes } from "../../schema/admin";
import { gradeBooks, chapters, chapterContents } from "../../schema/books";
import { timetableEntries, periodConfigs, reportSubmissions } from "../../schema/settings";
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
import { saveFile, deleteFile, getFile, deliverFile } from "../../lib/file";
import {
  generateMonthlyReportDocx,
  type ReportRow,
  type ReportParams,
} from "../../lib/monthly-report-docx";
import { convertToPdf } from "docx-to-pdf-wasm";
import wasmModule from "../../lib/docx-to-pdf.wasm";
import { PDFDocument } from "pdf-lib";
import blueStripeAsset from "../../assets/monthly-report-design.jpeg";
import logoAsset from "../../assets/creoleap-logo-final.png";

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

function parseClassLabel(label: string) {
  const match = label.trim().match(/^(\d+)\s*([a-zA-Z]*)$/);
  if (match) {
    return {
      isNumeric: true,
      grade: parseInt(match[1], 10),
      section: match[2].toUpperCase(),
    };
  }
  return {
    isNumeric: false,
    grade: label,
    section: "",
  };
}

function sortClassesLabel(classesLabel: string | undefined | null): string {
  if (!classesLabel) return "—";
  const cleaned = classesLabel.replace(/[\u2014—-]/g, "").trim();
  if (!cleaned) return "—";

  const parts = cleaned.split(",").map(s => s.trim()).filter(Boolean);

  parts.sort((a, b) => {
    const infoA = parseClassLabel(a);
    const infoB = parseClassLabel(b);

    if (infoA.isNumeric && infoB.isNumeric) {
      const gradeA = infoA.grade as number;
      const gradeB = infoB.grade as number;
      if (gradeA !== gradeB) {
        return gradeA - gradeB;
      }
      return infoA.section.localeCompare(infoB.section);
    }

    if (infoA.isNumeric && !infoB.isNumeric) return -1;
    if (!infoA.isNumeric && infoB.isNumeric) return 1;

    return a.localeCompare(b);
  });

  return parts.join(", ");
}

function normalizeReportData(data: any): any {
  if (!data) return data;
  data.isNormalized = true;
  if (typeof data.classesLabel === "string") {
    data.classesLabel = data.classesLabel
      .replace(/(\d+),\s*([a-zA-Z])/g, "$1$2")
      .replace(/(\d+),([a-zA-Z])/g, "$1$2");
    data.classesLabel = sortClassesLabel(data.classesLabel);
  }
  if (Array.isArray(data.rows)) {
    for (const row of data.rows) {
      if (typeof row.className === "string") {
        row.className = row.className
          .replace(/(\d+),\s*([a-zA-Z])/g, "$1$2")
          .replace(/(\d+),([a-zA-Z])/g, "$1$2");
      }
      if (typeof row.section === "string") {
        row.section = row.section
          .replace(/(\d+),\s*([a-zA-Z])/g, "$1$2")
          .replace(/(\d+),([a-zA-Z])/g, "$1$2");
      }
    }
  }
  return data;
}


async function assetToBase64(asset: string | ArrayBuffer): Promise<string | null> {
  try {
    let buffer: ArrayBuffer;
    if (asset instanceof ArrayBuffer) {
      buffer = asset;
    } else if (typeof asset === "string") {
      const res = await fetch(asset);
      if (!res.ok) return null;
      buffer = await res.arrayBuffer();
    } else {
      return null;
    }
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (err) {
    console.error("Failed to load report asset:", err);
    return null;
  }
}

function formatSubmittedOn(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateString(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return dateStr;
    }
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function signatureImageTypeFromKey(signatureKey: string | null | undefined): "png" | "jpg" {
  const key = signatureKey?.toLowerCase() || "";
  return key.endsWith(".jpg") || key.endsWith(".jpeg") ? "jpg" : "png";
}

async function loadStaffSignature(
  db: any,
  bucket: R2Bucket | undefined,
  staffId: string | null | undefined,
): Promise<{ signatureData: ArrayBuffer | null; signatureImageType: "png" | "jpg" }> {
  if (!staffId) return { signatureData: null, signatureImageType: "png" };

  const [staffRow] = await db
    .select({ signatureKey: staff.signatureKey })
    .from(staff)
    .where(eq(staff.id, staffId))
    .limit(1);

  const signatureImageType = signatureImageTypeFromKey(staffRow?.signatureKey);
  if (!staffRow?.signatureKey) return { signatureData: null, signatureImageType };

  const sigFile = await getFile(bucket, staffRow.signatureKey);
  if (!sigFile) return { signatureData: null, signatureImageType };

  return { signatureData: await sigFile.arrayBuffer(), signatureImageType };
}

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
    // Only treat bare YYYY-MM-DD strings as already-local dates.
    // ISO datetime strings (e.g. "2026-06-21T18:30:00.000Z") must go through
    // the Date conversion so the IST calendar date is computed correctly.
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
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

/** Parse additional_class_id which may be a JSON array or a legacy single ID. */
function parseAdditionalClassIds(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const p = JSON.parse(val);
    if (Array.isArray(p)) return p;
  } catch {}
  return [val];
}

/** Serialize additional class IDs to JSON array string for DB storage. */
function serializeAdditionalClassIds(ids: string[] | undefined | null): string | null {
  if (!ids || ids.length === 0) return null;
  return JSON.stringify(ids);
}

/**
 * Dedupe one-off entries by periodNumber, preferring the completed instance.
 * Duplicate one-offs (e.g. legacy rows or template copies) can otherwise
 * shadow a completed mark with a scheduled copy in the day view.
 */
function dedupeOneOffsByPeriod(entries: any[]): any[] {
  const byPeriod = new Map<number, any>();
  for (const e of entries) {
    const pn = e.periodNumber ?? 0;
    const existing = byPeriod.get(pn);
    if (!existing) {
      byPeriod.set(pn, e);
      continue;
    }
    const existingRank = existing.status === "completed" ? 2 : existing.status === "cancelled" ? 0 : 1;
    const newRank = e.status === "completed" ? 2 : e.status === "cancelled" ? 0 : 1;
    if (newRank > existingRank) {
      byPeriod.set(pn, e);
    } else if (newRank === existingRank && newRank === 2) {
      // Both completed: keep the most recently completed
      const a = existing.completedAt ? new Date(existing.completedAt).getTime() : 0;
      const b = e.completedAt ? new Date(e.completedAt).getTime() : 0;
      if (b > a) byPeriod.set(pn, e);
    } else if (newRank === existingRank) {
      // Same status: keep the latest updated
      const a = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const b = e.updatedAt ? new Date(e.updatedAt).getTime() : 0;
      if (b > a) byPeriod.set(pn, e);
    }
  }
  return [...byPeriod.values()];
}

/**
 * Freeze past dates for a recurring entry before modifying or deleting the template.
 * Creates one-off copies for past dates (from createdAt to today) that don't already
 * have an independent entry, so those dates retain the current state after the template changes.
 */
async function freezeRecurringPastDates(db: any, entry: any, beforeDateKey: string): Promise<void> {
  const dayOfWeek = entry.dayOfWeek;
  const workingDays = await getWorkingDays(db, entry.institutionId);
  if (!workingDays.includes(dayOfWeek)) return;

  // Collect all matching date keys from entry.createdAt to beforeDateKey (today)
  const startDate = new Date(entry.createdAt);
  const endDateParts = beforeDateKey.split("-").map(Number);
  const endDate = new Date(endDateParts[0], endDateParts[1] - 1, endDateParts[2]);

  const dateKeys: string[] = [];
  const cursor = new Date(startDate);
  // Advance to first matching dayOfWeek on or after startDate
  while (cursor.getDay() !== dayOfWeek && cursor <= endDate) {
    cursor.setDate(cursor.getDate() + 1);
  }
  while (cursor <= endDate) {
    dateKeys.push(toDateKey(cursor.toISOString()));
    cursor.setDate(cursor.getDate() + 7);
  }

  if (dateKeys.length === 0) return;

  // Fetch existing one-off entries for this staff + period.
  // IMPORTANT: cancelled one-offs (isDeleted=1, status='cancelled') are created
  // when a trainer removes a specific day from a recurring template. They must
  // count as "existing" so a previously-deleted day is never re-created here.
  const existingOneOffs = await db
    .select({ specificDate: timetableEntries.specificDate, status: timetableEntries.status, isDeleted: timetableEntries.isDeleted })
    .from(timetableEntries)
    .where(
      and(
        eq(timetableEntries.staffId, entry.staffId),
        eq(timetableEntries.periodNumber, entry.periodNumber),
        eq(timetableEntries.isRecurring, 0),
      ),
    );

  const existingDateKeys = new Set(
    existingOneOffs
      .map((e: any) => (e.specificDate ? toDateKey(e.specificDate) : null))
      .filter(Boolean),
  );

  const missingDateKeys = dateKeys.filter((dk) => !existingDateKeys.has(dk));
  if (missingDateKeys.length === 0) return;

  const now = nowISO();
  const rows = missingDateKeys.map((dk) => {
    const wasCompletedOnThisDate =
      entry.status === "completed" && entry.completedAt && isSameDateKey(entry.completedAt, dk);
    return {
      id: uuid(),
      institutionId: entry.institutionId,
      staffId: entry.staffId,
      classId: entry.classId,
      additionalClassId: entry.additionalClassId,
      gradeBookId: entry.gradeBookId,
      periodNumber: entry.periodNumber,
      dayOfWeek: entry.dayOfWeek,
      isRecurring: 0,
      specificDate: dateKeyToISOString(dk),
      notes: entry.notes,
      status: wasCompletedOnThisDate ? "completed" : "scheduled",
      completedAt: wasCompletedOnThisDate ? entry.completedAt : null,
      isDeleted: 0,
      createdAt: now,
      updatedAt: now,
    };
  });

  // Batch insert in chunks of 50 to avoid exceeding parameters limit
  const CHUNK = 50;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(timetableEntries).values(rows.slice(i, i + CHUNK));
  }
}

/** Resolve additional class IDs from body (supports `additionalClassIds` array or legacy `additionalClassId`), falling back to a default. */
function resolveAdditionalClassIds(body: any, fallback: any): string | null {
  if (body.additionalClassIds !== undefined) {
    return serializeAdditionalClassIds(body.additionalClassIds);
  }
  if (body.additionalClassId !== undefined) {
    return serializeAdditionalClassIds(parseAdditionalClassIds(body.additionalClassId));
  }
  return fallback;
}

// D1 (Cloudflare) caps a query at 100 bound variables. Chunk inArray queries
// so large ID lists never exceed the limit.
const MAX_IN_ARRAY_CHUNK = 99;

async function inArrayChunked(
  db: any,
  ids: string[],
  buildQuery: (chunkIds: string[]) => any,
): Promise<any[]> {
  const results: any[] = [];
  for (let i = 0; i < ids.length; i += MAX_IN_ARRAY_CHUNK) {
    const chunk = ids.slice(i, i + MAX_IN_ARRAY_CHUNK);
    results.push(...(await buildQuery(chunk)));
  }
  return results;
}

/** Batch-enrich timetable entries with class, gradeBook and topics. */
async function batchEnrichTimetableEntries(db: any, entries: any[]) {
  const allClassIds = [
    ...new Set(
      entries.flatMap((e) => [
        e.classId,
        ...parseAdditionalClassIds(e.additionalClassId),
      ].filter(Boolean)),
    ),
  ];
  const gbIds = [...new Set(entries.map((e) => e.gradeBookId).filter(Boolean))];
  const entryIds = entries.map((e) => e.id);

  const classMap = new Map<string, any>();
  if (allClassIds.length > 0) {
    const rows = await inArrayChunked(db, allClassIds as string[], (chunkIds) =>
      db
        .select({ id: classes.id, grade: classes.grade, section: classes.section, year: classes.year })
        .from(classes)
        .where(inArray(classes.id, chunkIds)),
    );
    for (const r of rows) classMap.set(r.id, r);
  }

  const gbMap = new Map<string, any>();
  if (gbIds.length > 0) {
    const rows = await inArrayChunked(db, gbIds, (chunkIds) =>
      db
        .select({ id: gradeBooks.id, bookTitle: gradeBooks.bookTitle, grade: gradeBooks.grade })
        .from(gradeBooks)
        .where(inArray(gradeBooks.id, chunkIds)),
    );
    for (const r of rows) gbMap.set(r.id, r);
  }

  const topicsMap = new Map<string, { topic: string; chapterId: string | null; contentId: string | null }[]>();
  if (entryIds.length > 0) {
    const rows = await inArrayChunked(db, entryIds, (chunkIds) =>
      db
        .select({
          timetableEntryId: timetableTopicsCovered.timetableEntryId,
          topic: timetableTopicsCovered.topic,
          chapterId: timetableTopicsCovered.chapterId,
          contentId: timetableTopicsCovered.contentId,
        })
        .from(timetableTopicsCovered)
        .where(inArray(timetableTopicsCovered.timetableEntryId, chunkIds)),
    );
    for (const r of rows) {
      const arr = topicsMap.get(r.timetableEntryId) || [];
      arr.push({ topic: r.topic, chapterId: r.chapterId, contentId: r.contentId });
      topicsMap.set(r.timetableEntryId, arr);
    }
  }

  // Batch fetch chapter and content names
  const allChapterIds = [...new Set(entryIds.flatMap((id) => (topicsMap.get(id) || []).map((t) => t.chapterId).filter(Boolean)))] as string[];
  const allContentIds = [...new Set(entryIds.flatMap((id) => (topicsMap.get(id) || []).map((t) => t.contentId).filter(Boolean)))] as string[];

  const [chapterRows, contentRows] = await Promise.all([
    allChapterIds.length > 0
      ? inArrayChunked(db, allChapterIds, (chunkIds) =>
          db.select({ id: chapters.id, title: chapters.title, chapterNumber: chapters.chapterNumber }).from(chapters).where(inArray(chapters.id, chunkIds)),
        )
      : ([] as any[]),
    allContentIds.length > 0
      ? inArrayChunked(db, allContentIds, (chunkIds) =>
          db.select({ id: chapterContents.id, title: chapterContents.title }).from(chapterContents).where(inArray(chapterContents.id, chunkIds)),
        )
      : ([] as any[]),
  ]);

  const chapterMap = new Map<string, any>(chapterRows.map((r: any) => [r.id, r]));
  const contentMap = new Map<string, any>(contentRows.map((r: any) => [r.id, r]));

  return entries.map((entry) => {
    const { __omitTopicsCovered, ...entryWithoutInternalFields } = entry;
    const rawTopics = topicsMap.get(entry.id) || [];

    // Build structured chapter topics
    const chapterGroups = new Map<string | null, { chapterId: string | null; chapterTitle: string | null; subtopics: { contentId: string | null; title: string }[] }>();
    for (const t of rawTopics) {
      const ch = t.chapterId ? chapterMap.get(t.chapterId) : null;
      const ct = t.contentId ? contentMap.get(t.contentId) : null;
      const key = t.chapterId || "__no_chapter__";
      const existing = chapterGroups.get(key);
      const subtopic = { contentId: t.contentId, title: ct?.title || t.topic };
      if (existing) {
        existing.subtopics.push(subtopic);
      } else {
        chapterGroups.set(key, {
          chapterId: t.chapterId,
          chapterTitle: ch ? `Chapter ${ch.chapterNumber ?? ""}: ${ch.title || ""}` : null,
          subtopics: [subtopic],
        });
      }
    }
    const chapterTopics = [...chapterGroups.values()];

    return {
      ...entryWithoutInternalFields,
      classId: entry.classId ? classMap.get(entry.classId) || null : null,
      additionalClassId: entry.additionalClassId,
      additionalClasses: parseAdditionalClassIds(entry.additionalClassId)
        .map((id: string) => classMap.get(id))
        .filter(Boolean),
      gradeBookId: entry.gradeBookId ? gbMap.get(entry.gradeBookId) || null : null,
      topicsCovered: __omitTopicsCovered ? [] : rawTopics.map((t: any) => t.topic),
      chapterTopics: __omitTopicsCovered ? [] : chapterTopics,
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
  const dates: Record<string, { entryCount: number; hasCompleted: boolean; completedCount?: number }> = {};

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
      ...dedupeOneOffsByPeriod(oneOffForDate),
    ];

    if (merged.length > 0) {
      dates[dateStr] = {
        entryCount: merged.length,
        hasCompleted: merged.some((e: any) => e.status === "completed"),
        completedCount: merged.filter((e: any) => e.status === "completed").length,
      };
    }
  }

  return dates;
}

// ─── GET /my-month — teacher's month view ──────────

timetableController.get("/my-month", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const staffId = user.id;
  const queryInstitutionId = c.req.query("institutionId");
  const institutionId = queryInstitutionId || resolveInstitutionId(user);
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
  const queryInstitutionId = c.req.query("institutionId");
  const institutionId = queryInstitutionId || resolveInstitutionId(user);
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
  const dedupedOneOffs = dedupeOneOffsByPeriod(oneOffEntries);
  const allEntries = [
    ...recurringEntries.filter((e) => !overriddenPeriods.has(e.periodNumber) && !cancelledPeriods.has(e.periodNumber)),
    ...dedupedOneOffs,
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

  if (!staffId || !institutionId) {
    throw new ForbiddenError("No institution associated with this account");
  }

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
    additionalClassId: serializeAdditionalClassIds(body.additionalClassIds ?? (body.additionalClassId ? [body.additionalClassId] : undefined)),
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

  const now = nowISO();

  // ── Recurring entry with date → create/update one-off copy ──
  if (entry.isRecurring === 1 && body.date) {
    if (!entry.staffId || entry.periodNumber === null || entry.periodNumber === undefined) {
      throw new BadRequestError("Recurring entry must have staff and period assigned");
    }
    const targetDateKey = toDateKey(body.date);
    const targetSpecificDate = dateKeyToISOString(targetDateKey);

    // Check for existing one-off for this date
    const [existingOneOff] = await db
      .select()
      .from(timetableEntries)
      .where(
        and(
          eq(timetableEntries.staffId, entry.staffId),
          eq(timetableEntries.periodNumber, entry.periodNumber),
          eq(timetableEntries.isRecurring, 0),
          eq(timetableEntries.isDeleted, 0),
          sql`${timetableEntries.specificDate} >= ${dateKeyToISOString(targetDateKey)}`,
          sql`${timetableEntries.specificDate} <= ${dateKeyEndISOString(targetDateKey)}`,
        ),
      )
      .limit(1);

    const targetId = existingOneOff?.id || uuid();
    // Preserve an existing completed one-off — never downgrade a done mark to
    // "scheduled" when the recurring template is edited for a specific date.
    const keepCompleted = existingOneOff?.status === "completed";
    const oneOffValues: Record<string, any> = {
      institutionId: entry.institutionId,
      staffId: entry.staffId,
      classId: body.classId || entry.classId,
      additionalClassId: resolveAdditionalClassIds(body, entry.additionalClassId),
      gradeBookId: body.gradeBookId !== undefined ? body.gradeBookId : entry.gradeBookId,
      periodNumber: entry.periodNumber,
      dayOfWeek: entry.dayOfWeek,
      isRecurring: 0,
      specificDate: targetSpecificDate,
      notes: body.notes !== undefined ? body.notes : entry.notes,
      status: keepCompleted ? "completed" : entry.status,
      completedAt: keepCompleted ? existingOneOff.completedAt : (entry.status === "completed" ? entry.completedAt : null),
      updatedAt: now,
    };

    if (existingOneOff) {
      await db.update(timetableEntries).set(oneOffValues).where(eq(timetableEntries.id, targetId));
    } else {
      await db.insert(timetableEntries).values({
        id: targetId,
        ...oneOffValues,
        isDeleted: 0,
        createdAt: now,
      });
    }

    // Fetch updated entry with populated info
    const [updated] = await db.select().from(timetableEntries).where(eq(timetableEntries.id, targetId)).limit(1);

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
  }

  // ── Non-recurring or no date: direct update ──
  // For recurring entries, freeze past dates before updating the template
  if (entry.isRecurring === 1) {
    const todayKey = toDateKey(now);
    await freezeRecurringPastDates(db, entry, todayKey);
  }

  const updates: Record<string, any> = { updatedAt: now };
  if (body.classId) updates.classId = body.classId;
  if (body.additionalClassIds !== undefined || body.additionalClassId !== undefined) {
    updates.additionalClassId = resolveAdditionalClassIds(body, null);
  }
  if (body.gradeBookId !== undefined) updates.gradeBookId = body.gradeBookId;
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
          sql`${timetableEntries.specificDate} >= ${dateKeyToISOString(targetDateKey)}`,
          sql`${timetableEntries.specificDate} <= ${dateKeyEndISOString(targetDateKey)}`,
        ),
      )
      .limit(1);

    targetId = existingOneOff?.id || uuid();

    const completedValues = {
      institutionId: entry.institutionId,
      staffId: entryStaffId,
      classId: entryClassId,
      additionalClassId: resolveAdditionalClassIds(body, entry.additionalClassId),
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
    if (body.additionalClassIds !== undefined || body.additionalClassId !== undefined) {
      updates.additionalClassId = resolveAdditionalClassIds(body, null);
    }
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
    // Use actual start/end times for the class session, not scheduled period times.
    // body.startTime may be a future scheduled time; clamp to actual wall-clock.
    const actualStartTime = new Date(startTime).getTime() > new Date(now).getTime() ? now : startTime;
    const actualEndTime = now; // session ends when teacher marks it complete
    const actualDuration = Math.round((new Date(actualEndTime).getTime() - new Date(actualStartTime).getTime()) / 60000);
    await db.insert(classSessions).values({
      id: sessionId,
      staffId: entryStaffId,
      institutionId: entry.institutionId,
      classId: entryClassId,
      courseId: entry.gradeBookId || null,
      startTime: actualStartTime,
      endTime: actualEndTime,
      durationMinutes: actualDuration,
      remarks: body.notes || null,
      status: "completed",
      createdAt: now,
      updatedAt: now,
    });
  } else {
    sessionId = existingSessions[0].id;
    // Clamp future scheduled start time to actual wall-clock
    const actualStartTime = new Date(startTime).getTime() > new Date(now).getTime() ? now : startTime;
    await db
      .update(classSessions)
      .set({
        startTime: actualStartTime,
        endTime: now,
        durationMinutes: Math.round((new Date(now).getTime() - new Date(actualStartTime).getTime()) / 60000),
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

  const additionalClassIds = parseAdditionalClassIds(updated.additionalClassId);
  const allClassIds = [updated.classId, ...additionalClassIds].filter(Boolean);
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
      additionalClassId: updated.additionalClassId,
      additionalClasses: additionalClassIds.map((id: string) => classMap.get(id)).filter(Boolean),
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
  const user = c.get("user") as Record<string, any>;
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

  // Teachers/staff can only delete their own non-completed entries
  if (user.role !== "admin" && user.role !== "super_admin") {
    if (entry.staffId !== user.id) {
      throw new BadRequestError("You can only delete your own timetable entries");
    }
    if (entry.status === "completed") {
      throw new BadRequestError("Cannot delete completed entries");
    }
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
      // Teachers/staff cannot delete completed entries
      if (user.role !== "admin" && user.role !== "super_admin" && oneOffForDate.status === "completed") {
        throw new BadRequestError("Cannot delete completed entries");
      }
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

  // ── scope=future: freeze past dates, then delete template ──
  const scopeQuery = c.req.query("scope");
  if (scopeQuery === "future") {
    const todayKey = toDateKey(now);
    await freezeRecurringPastDates(db, entry, todayKey);

    // Soft-delete the recurring template
    await db
      .update(timetableEntries)
      .set({ isDeleted: 1, updatedAt: now })
      .where(eq(timetableEntries.id, id));

    // Also soft-delete any future uncompleted one-off entries for this staff+period after today
    const futureOneOffs = workdoneEntries.filter(
      (e: any) =>
        e.specificDate &&
        toDateKey(e.specificDate) >= todayKey &&
        e.status !== "completed",
    );
    if (futureOneOffs.length > 0) {
      await db
        .update(timetableEntries)
        .set({ isDeleted: 1, updatedAt: now })
        .where(
          inArray(
            timetableEntries.id,
            futureOneOffs.map((e: any) => e.id),
          ),
        );
    }

    return c.json({ success: true, message: "Recurring schedule removed from today onwards" });
  }

  // No date/scope provided — attempting to delete the recurring template
  if (workdoneEntries.length > 0) {
    if (user.role === "super_admin") {
      // Superadmin can force-delete: also soft-delete all associated workdone entries
      await db
        .update(timetableEntries)
        .set({ isDeleted: 1, updatedAt: now })
        .where(
          inArray(
            timetableEntries.id,
            workdoneEntries.map((e: any) => e.id),
          ),
        );
    } else {
      throw new BadRequestError(
        `Cannot delete this recurring schedule because ${workdoneEntries.length} workdone entry(ies) exist. Remove this period for a specific day instead.`,
      );
    }
  }

  // Delete the recurring template
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
  const dedupedOneOffs = dedupeOneOffsByPeriod(oneOffEntries);
  const allEntries = [
    ...recurringEntries.filter((e) => !overriddenPeriods.has(e.periodNumber) && !cancelledPeriods.has(e.periodNumber)),
    ...dedupedOneOffs,
  ].sort((a, b) => (a.periodNumber ?? 0) - (b.periodNumber ?? 0));

  const enriched = await batchEnrichTimetableEntries(db, allEntries);

  return c.json({ success: true, data: { entries: enriched, periodConfig } });
});

// ═══ Monthly Report endpoints ═════════════════════

async function buildMonthlyReportData(
  db: any,
  staffId: string,
  institutionId: string,
  year: number,
  month: number,
): Promise<ReportParams> {
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
          or(
            eq(timetableEntries.isDeleted, 0),
            and(
              eq(timetableEntries.isDeleted, 1),
              eq(timetableEntries.status, "cancelled"),
            ),
          ),
          sql`${timetableEntries.specificDate} >= ${dateKeyToISOString(`${year}-${String(month).padStart(2, "0")}-01`)}`,
          sql`${timetableEntries.specificDate} <= ${dateKeyEndISOString(`${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`)}`,
        ),
      ),
  ]);

  // Get all entry IDs for topics lookup
  const allEntryIds = [...recurringEntries, ...oneOffEntries].map((e: any) => e.id);

  // Batch fetch topics covered
  const topicsRows = allEntryIds.length > 0
    ? await inArrayChunked(db, allEntryIds, (chunkIds) =>
        db
          .select()
          .from(timetableTopicsCovered)
          .where(inArray(timetableTopicsCovered.timetableEntryId, chunkIds)),
      )
    : [];

  const chapterIdsSet = new Set<string>();
  const contentIdsSet = new Set<string>();
  for (const row of topicsRows) {
    if (row.chapterId) chapterIdsSet.add(row.chapterId);
    if (row.contentId) contentIdsSet.add(row.contentId);
  }

  // Fetch chapter and content titles for structured entries
  const chapterMap = new Map<string, { title: string; chapterNumber: number | null }>();
  if (chapterIdsSet.size > 0) {
    const chRows = await inArrayChunked(db, [...chapterIdsSet], (chunkIds) =>
      db
        .select({ id: chapters.id, title: chapters.title, chapterNumber: chapters.chapterNumber })
        .from(chapters)
        .where(inArray(chapters.id, chunkIds)),
    );
    for (const ch of chRows) chapterMap.set(ch.id, { title: ch.title || "", chapterNumber: ch.chapterNumber });
  }
  const contentMap = new Map<string, { title: string; chapterId: string; order: number | null }>();
  if (contentIdsSet.size > 0) {
    const ctRows = await inArrayChunked(db, [...contentIdsSet], (chunkIds) =>
      db
        .select({ id: chapterContents.id, title: chapterContents.title, chapterId: chapterContents.chapterId, order: chapterContents.order })
        .from(chapterContents)
        .where(inArray(chapterContents.id, chunkIds)),
    );
    for (const ct of ctRows) contentMap.set(ct.id, { title: ct.title || "", chapterId: ct.chapterId, order: ct.order });
  }

  const allTimetableEntries = [...recurringEntries, ...oneOffEntries];
  const getEntryClassIds = (entry: any): string[] => [
    entry.classId,
    ...parseAdditionalClassIds(entry.additionalClassId),
  ].filter(Boolean);
  const formatClassLabel = (classRow: any): string => {
    if (!classRow) return "";
    const grade = String(classRow.grade || "").trim();
    const section = String(classRow.section || "").trim();
    return `${grade}${section}`;
  };

  // Batch fetch class and gradeBook info, including combined/additional classes.
  const classIds = [...new Set(allTimetableEntries.flatMap((e: any) => getEntryClassIds(e)))];
  const gbIds = [...new Set(allTimetableEntries.map((e: any) => e.gradeBookId).filter(Boolean))];

  const classMap = new Map<string, any>();
  if (classIds.length > 0) {
    const classRows = await inArrayChunked(db, classIds, (chunkIds) =>
      db
        .select({ id: classes.id, grade: classes.grade, section: classes.section, year: classes.year })
        .from(classes)
        .where(inArray(classes.id, chunkIds)),
    );
    for (const cls of classRows) classMap.set(cls.id, cls);
  }

  const gbMap = new Map<string, any>();
  if (gbIds.length > 0) {
    const gbRows = await inArrayChunked(db, gbIds, (chunkIds) =>
      db
        .select({ id: gradeBooks.id, bookTitle: gradeBooks.bookTitle, grade: gradeBooks.grade })
        .from(gradeBooks)
        .where(inArray(gradeBooks.id, chunkIds)),
    );
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
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const oneOffForDate = oneOffEntries.filter((e: any) => {
      if (!e.specificDate) return false;
      return toDateKey(e.specificDate) === dateStr;
    });

    const activeOneOff = oneOffForDate.filter((e: any) => e.isDeleted === 0);
    const cancelledOneOff = oneOffForDate.filter((e: any) => e.isDeleted === 1 && e.status === "cancelled");

    // Include non-working days only if they have actual active one-off entries
    if (!workingDays.includes(dow) && activeOneOff.length === 0) continue;

    const recurringForDay = recurringEntries
      .filter((e: any) => e.dayOfWeek === dow)
      .map((e: any) => recurringEntryForDate(e, dateStr));

    const cancelledPeriods = new Set(cancelledOneOff.map((e: any) => e.periodNumber));
    const overriddenPeriods = new Set(activeOneOff.map((e: any) => e.periodNumber));

    // If duplicate active one-off instances exist for the same period (legacy data),
    // keep only the most recently completed one.
    const oneOffByPeriod = new Map<number, any>();
    for (const e of activeOneOff) {
      const pn = e.periodNumber ?? 0;
      const existing = oneOffByPeriod.get(pn);
      if (
        !existing ||
        (e.completedAt && existing.completedAt && new Date(e.completedAt) > new Date(existing.completedAt))
      ) {
        oneOffByPeriod.set(pn, e);
      }
    }
    const dedupedOneOff = [...oneOffByPeriod.values()];

    const merged = [
      ...recurringForDay.filter((e: any) => !overriddenPeriods.has(e.periodNumber) && !cancelledPeriods.has(e.periodNumber)),
      ...dedupedOneOff,
    ].sort((a: any, b: any) => (a.periodNumber ?? 0) - (b.periodNumber ?? 0));

    for (const entry of merged) {
      const bookObj = gbMap.get(entry.gradeBookId);

      const classLabels = [
        ...new Set(
          getEntryClassIds(entry)
            .map((classId) => formatClassLabel(classMap.get(classId)))
            .filter(Boolean),
        ),
      ];
      const classLabel = classLabels.join(", ");
      const bookTitle = bookObj?.bookTitle || "";

      for (const label of classLabels) classSet.add(label);
      if (bookTitle) subjectSet.add(bookTitle);
      if (entry.status === "completed") completedCount++;

      // Collect chapter and content names from structured entries for this entry
      const entryTopicRows = entry.__omitTopicsCovered ? [] : topicsRows.filter((r: any) => r.timetableEntryId === entry.id);
      const entryTopics = entryTopicRows.map((r: any) => r.topic);
      const chapterLabels = new Set<string>();
      const subtopicLabels: string[] = [];
      for (const tr of entryTopicRows) {
        if (tr.chapterId) {
          const ch = chapterMap.get(tr.chapterId);
          if (ch) chapterLabels.add(`Chapter ${ch.chapterNumber ?? ""}: ${ch.title}`);
        }
        if (tr.contentId) {
          const ct = contentMap.get(tr.contentId);
          const ch = ct ? chapterMap.get(ct.chapterId) : null;
          const chNum = ch?.chapterNumber;
          if (ct) {
            const subtopicNum = `${chNum != null ? chNum + "." : ""}${ct.order != null ? ct.order : ""}`;
            subtopicLabels.push(`${subtopicNum} - ${ct.title}`);
          }
        }
      }

      const hasStructuredTopics = entryTopicRows.some((r: any) => r.chapterId || r.contentId);
      const freeTextTopics = entryTopicRows
        .filter((r: any) => !r.chapterId && !r.contentId)
        .map((r: any) => r.topic);

      // Fallback raw topic labels (used when chapter/content DB lookups fail)
      const rawChapterTopics = entryTopicRows
        .filter((r: any) => r.chapterId && !r.contentId)
        .map((r: any) => r.topic);
      const rawSubtopicTopics = entryTopicRows
        .filter((r: any) => r.contentId)
        .map((r: any) => r.topic);

      // Chapter Name = chapter(s) selected by the teacher in work done
      // For legacy/free-text-only entries, fall back to the grade-book (subject) title
      const chapterName = hasStructuredTopics
        ? [...chapterLabels].join(", ") || rawChapterTopics.join(", ")
        : bookTitle;

      // Topic Name = subtopic(s) selected by the teacher under the chapters
      // Fall back to free-text additional topics when no structured subtopics exist
      const topicName = hasStructuredTopics
        ? subtopicLabels.length > 0
          ? subtopicLabels.join(", ")
          : rawSubtopicTopics.join(", ") || freeTextTopics.join(", ")
        : entryTopics.join(", ");

      rows.push({
        date: `${String(d).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`,
        className: classLabel,
        section: "",
        chapterName,
        topicName,
        remarks: entry.status === "completed" ? entry.notes || "" : "",
      });
    }
  }

  return normalizeReportData({
    monthName,
    year,
    staffNames: [trainerName],
    schoolName: institutionRow?.name || "",
    classesLabel: Array.from(classSet).join(", ") || "\u2014",
    subjectLabel: Array.from(subjectSet).join(", ") || "\u2014",
    sessionsPlanned: rows.length,
    sessionsCompleted: completedCount,
    rows,
    sessionColumns: ["Date", "Class", "Chapter", "Topic", "Remarks"],
    bodyItems: [],
    staffId,
  });
}

async function buildMonthlyReport(
  db: any,
  staffId: string,
  institutionId: string,
  year: number,
  month: number,
): Promise<Uint8Array> {
  const data = await buildMonthlyReportData(db, staffId, institutionId, year, month);
  return generateMonthlyReportDocx(data);
}

// ─── GET /my-monthly-report — teacher's DOCX ──────

timetableController.get("/my-monthly-report", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    if (user.role !== "teacher" && user.role !== "staff" && user.role !== "super_admin") {
      throw new BadRequestError("Only teachers can generate reports");
    }
    const staffId = user.id;
    const queryInstitutionId = c.req.query("institutionId");
    const institutionId = queryInstitutionId || resolveInstitutionId(user);
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

// ─── GET /my-monthly-report-data — teacher's report data as JSON ──

timetableController.get("/my-monthly-report-data", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    if (user.role !== "teacher" && user.role !== "staff" && user.role !== "super_admin") {
      throw new BadRequestError("Only teachers can generate reports");
    }
    const staffId = user.id;
    const queryInstitutionId = c.req.query("institutionId");
    const institutionId = queryInstitutionId || resolveInstitutionId(user);
    const year = Number(c.req.query("year"));
    const month = Number(c.req.query("month"));
    const db = getDb(c.env.DB);

    const data = await buildMonthlyReportData(db, staffId, institutionId, year, month);
    return c.json({ success: true, data });
  } catch (err) {
    console.error("Monthly report data error:", err);
    return c.json({ success: false, message: "Failed to generate report data" }, 500);
  }
});

// ─── GET /report-assets — header images for preview ───────────────

timetableController.get("/report-assets", async (c) => {
  const [blueStripe, logo] = await Promise.all([
    assetToBase64(blueStripeAsset),
    assetToBase64(logoAsset),
  ]);
  return c.json({
    success: true,
    data: {
      blueStripe: blueStripe ? `data:image/jpeg;base64,${blueStripe}` : null,
      logo: logo ? `data:image/png;base64,${logo}` : null,
      blueStripeSize: { width: 105, height: 1600 },
      logoSize: { width: 380, height: 100 },
      logoOffset: 3750000 / 9525, // EMUs → px
    },
  });
});

// ─── GET /staff-monthly-report-data — admin's report data as JSON ──

timetableController.get("/staff-monthly-report-data", async (c) => {
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

  const data = await buildMonthlyReportData(db, staffId, institutionId, year, month);
  return c.json({ success: true, data });
});

// ─── POST /generate-report-docx — generate docx from edited report data ──

timetableController.post("/generate-report-docx", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    if (user.role === "admin") {
      throw new BadRequestError("Admins cannot generate reports");
    }
    let body = await c.req.json<ReportParams>();
    body = normalizeReportData(body);
    const db = getDb(c.env.DB);
    const targetStaffId = body.staffId || (user.role === "admin" || user.role === "super_admin" ? null : user.id);

    const { signatureData, signatureImageType } = await loadStaffSignature(db, c.env.BUCKET, targetStaffId);
    const buffer = await generateMonthlyReportDocx({
      ...body,
      signatureData,
      signatureImageType,
      submittedOn: formatDateString(body.submittedOn) || formatSubmittedOn(),
    });
    const monthName = body.monthName || "Report";
    const year = body.year || "";

    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="Monthly_Report_${monthName}_${year}.docx"`,
      },
    });
  } catch (err) {
    console.error("Generate report docx error:", err);
    return c.json({ success: false, message: "Failed to generate docx" }, 500);
  }
});

function detectImageFormat(bytes: Uint8Array): "png" | "jpg" | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return "jpg";
  return null;
}

async function embedSignatureImage(pdfDoc: PDFDocument, sigBytes: Uint8Array): Promise<any> {
  const fmt = detectImageFormat(sigBytes);
  console.log("PDF sig format:", fmt, "bytes:", sigBytes.byteLength);

  if (fmt === "png") {
    const img = await pdfDoc.embedPng(sigBytes).catch(() => null);
    if (img) return img;
  }
  if (fmt === "jpg") {
    const img = await pdfDoc.embedJpg(sigBytes).catch(() => null);
    if (img) return img;
  }

  // Unknown format: try both
  const asPng = await pdfDoc.embedPng(sigBytes).catch(() => null);
  if (asPng) return asPng;
  const asJpg = await pdfDoc.embedJpg(sigBytes).catch(() => null);
  if (asJpg) return asJpg;

  console.log("PDF sig: all embed attempts failed");
  return null;
}

async function resolveAssetBytes(asset: string | ArrayBuffer): Promise<Uint8Array | null> {
  try {
    if (asset instanceof ArrayBuffer) return new Uint8Array(asset);
    if (typeof asset === "string") {
      const res = await fetch(asset);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    }
  } catch { /* ignore */ }
  return null;
}

// ─── POST /generate-report-pdf — generate PDF from edited report data ──

timetableController.post("/generate-report-pdf", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    if (user.role === "admin") {
      throw new BadRequestError("Admins cannot generate reports");
    }
    const queryStaffId = c.req.query("staffId");
    let body = await c.req.json<ReportParams>();
    body = normalizeReportData(body);
    const db = getDb(c.env.DB);
    const targetStaffId = queryStaffId || body.staffId || (user.role === "admin" || user.role === "super_admin" ? null : user.id);

    const { signatureData, signatureImageType } = await loadStaffSignature(db, c.env.BUCKET, targetStaffId);
    const docxBuffer = await generateMonthlyReportDocx({
      ...body,
      signatureData,
      signatureImageType,
      submittedOn: formatDateString(body.submittedOn) || formatSubmittedOn(),
    });

    let pdfBytes = await convertToPdf(wasmModule, docxBuffer);

    // Post-process: overlay images that the WASM converter may have dropped
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();

      // Load assets — only stripe and logo (signature is already in DOCX)
      const [stripeBytes, logoBytes] = await Promise.all([
        resolveAssetBytes(blueStripeAsset),
        resolveAssetBytes(logoAsset),
      ]);

      // Embed images
      const stripeImg = stripeBytes ? await pdfDoc.embedJpg(stripeBytes).catch(() => null) ?? await pdfDoc.embedPng(stripeBytes).catch(() => null) : null;
      const logoImg = logoBytes ? await pdfDoc.embedPng(logoBytes).catch(() => null) ?? await pdfDoc.embedJpg(logoBytes).catch(() => null) : null;

      for (const page of pages) {
        const { width, height } = page.getSize();

        // Blue stripe — left edge, full page height (matches DOCX 105px stripe)
        if (stripeImg) {
          const stripeW = 20;
          const aspect = stripeImg.height / stripeImg.width;
          const stripeH = height; // full page height
          const drawW = stripeH / aspect;
          page.drawImage(stripeImg, {
            x: 0,
            y: 0,
            width: drawW,
            height: stripeH,
          });
        }

        // Logo — top right
        if (logoImg) {
          const logoW = 120;
          const aspect = logoImg.height / logoImg.width;
          const logoH = logoW * aspect;
          page.drawImage(logoImg, {
            x: width - logoW - 24,
            y: height - logoH - 8,
            width: logoW,
            height: logoH,
          });
        }
      }

      pdfBytes = await pdfDoc.save();
    } catch (postErr) {
      console.error("PDF post-processing failed (returning unmodified):", postErr);
    }

    const monthName = body.monthName || "Report";
    const year = body.year || "";

    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Monthly_Report_${monthName}_${year}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Generate report pdf error:", err);
    return c.json({ success: false, message: "Failed to generate pdf" }, 500);
  }
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
  if (startDate) conditions.push(sql`${timetableEntries.completedAt} >= ${dateKeyToISOString(startDate)}`);
  if (endDate) conditions.push(sql`${timetableEntries.completedAt} <= ${dateKeyEndISOString(endDate)}`);

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
  const classIds: string[] = [...new Set(
    entries.flatMap((e) => [e.classId, ...parseAdditionalClassIds(e.additionalClassId)].filter(Boolean)),
  )] as string[];
  const instIds: string[] = [...new Set(entries.map((e) => e.institutionId).filter(Boolean))] as string[];
  const gbIds: string[] = [...new Set(entries.map((e) => e.gradeBookId).filter(Boolean))] as string[];
  const entryIds = entries.map((e) => e.id);

  const [staffRows, classRows, instRows, gbRows, topicRows] = await Promise.all([
    staffIds.length > 0
      ? inArrayChunked(db, staffIds, (chunkIds) =>
          db
            .select({ id: staff.id, name: staff.name, email: staff.email })
            .from(staff)
            .where(inArray(staff.id, chunkIds)),
        )
      : [],
    classIds.length > 0
      ? inArrayChunked(db, classIds, (chunkIds) =>
          db
            .select({ id: classes.id, grade: classes.grade, section: classes.section })
            .from(classes)
            .where(inArray(classes.id, chunkIds)),
        )
      : [],
    instIds.length > 0
      ? inArrayChunked(db, instIds, (chunkIds) =>
          db
            .select({ id: institutions.id, name: institutions.name })
            .from(institutions)
            .where(inArray(institutions.id, chunkIds)),
        )
      : [],
    gbIds.length > 0
      ? inArrayChunked(db, gbIds, (chunkIds) =>
          db
            .select({ id: gradeBooks.id, bookTitle: gradeBooks.bookTitle })
            .from(gradeBooks)
            .where(inArray(gradeBooks.id, chunkIds)),
        )
      : [],
    entryIds.length > 0
      ? inArrayChunked(db, entryIds, (chunkIds) =>
          db
            .select({
              entryId: timetableTopicsCovered.timetableEntryId,
              topic: timetableTopicsCovered.topic,
              chapterId: timetableTopicsCovered.chapterId,
              contentId: timetableTopicsCovered.contentId,
            })
            .from(timetableTopicsCovered)
            .where(inArray(timetableTopicsCovered.timetableEntryId, chunkIds)),
        )
      : [],
  ]);

  const staffMap = new Map(staffRows.map((r) => [r.id, r]));
  const classMap = new Map(classRows.map((r) => [r.id, r]));
  const instMap = new Map(instRows.map((r) => [r.id, r]));
  const gbMap = new Map(gbRows.map((r) => [r.id, r]));

  const topicsMap = new Map<string, { topic: string; chapterId: string | null; contentId: string | null }[]>();
  for (const r of topicRows) {
    const arr = topicsMap.get(r.entryId) || [];
    arr.push({ topic: r.topic, chapterId: r.chapterId, contentId: r.contentId });
    topicsMap.set(r.entryId, arr);
  }

  // Fetch chapter and content info for structured topic display
  const allChapterIds = [...new Set(topicRows.map((r) => r.chapterId).filter(Boolean))] as string[];
  const allContentIds = [...new Set(topicRows.map((r) => r.contentId).filter(Boolean))] as string[];

  const [chapterRows, contentRows] = await Promise.all([
    allChapterIds.length > 0
      ? inArrayChunked(db, allChapterIds, (chunkIds) =>
          db.select({ id: chapters.id, title: chapters.title, chapterNumber: chapters.chapterNumber }).from(chapters).where(inArray(chapters.id, chunkIds)),
        )
      : [],
    allContentIds.length > 0
      ? inArrayChunked(db, allContentIds, (chunkIds) =>
          db.select({ id: chapterContents.id, title: chapterContents.title, order: chapterContents.order }).from(chapterContents).where(inArray(chapterContents.id, chunkIds)),
        )
      : [],
  ]);

  const chapterMap = new Map(chapterRows.map((r) => [r.id, r]));
  const contentMap = new Map(contentRows.map((r) => [r.id, r]));

  const enriched = entries.map((entry) => {
    const rawTopics = topicsMap.get(entry.id) || [];
    // Build structured chapter topics: group by chapterId
    const chapterGroups = new Map<string | null, { chapterId: string | null; chapterLabel: string | null; subtopics: string[] }>();
    for (const t of rawTopics) {
      const ch = t.chapterId ? chapterMap.get(t.chapterId) : null;
      const ct = t.contentId ? contentMap.get(t.contentId) : null;
      const chNum = ch?.chapterNumber;
      const chapterLabel = ch ? `Chapter ${chNum ?? ""}: ${ch.title || ""}` : null;
      const subtopic = ct
        ? `${chNum != null ? chNum + "." : ""}${ct.order != null ? ct.order : ""} - ${ct.title || t.topic}`
        : t.topic;
      const key = t.chapterId || "__no_chapter__";
      const existing = chapterGroups.get(key);
      if (existing) {
        existing.subtopics.push(subtopic);
      } else {
        chapterGroups.set(key, { chapterId: t.chapterId, chapterLabel, subtopics: [subtopic] });
      }
    }
    const chapterTopics = [...chapterGroups.values()];
    // Flat list for backwards compat (just subtopic titles, no book name)
    const topicsCovered = chapterTopics.flatMap((g) => g.subtopics);

    return {
      ...entry,
      staff: entry.staffId ? staffMap.get(entry.staffId) || null : null,
      class: entry.classId ? classMap.get(entry.classId) || null : null,
      additionalClasses: parseAdditionalClassIds(entry.additionalClassId)
        .map((id: string) => classMap.get(id))
        .filter(Boolean),
      institution: entry.institutionId ? instMap.get(entry.institutionId) || null : null,
      gradeBook: entry.gradeBookId ? gbMap.get(entry.gradeBookId) || null : null,
      topicsCovered,
      chapterTopics,
    };
  });

  return c.json({
    success: true,
    data: {
      entries: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  });
});

// ═══ Signature endpoints ══════════════════════════

// ─── POST /signature — upload teacher signature ────

timetableController.post("/signature", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    const staffId = user.id;
    const db = getDb(c.env.DB);

    const formData = await c.req.formData();
    const file = formData.get("signature");
    if (!file || typeof file === "string") {
      throw new BadRequestError("Signature image file is required");
    }

    const sigFile = file as unknown as File;
    if (!sigFile.type?.startsWith("image/")) {
      throw new BadRequestError("Only image files are allowed");
    }
    if (sigFile.size > 5 * 1024 * 1024) {
      throw new BadRequestError("Signature image must be 5MB or smaller");
    }

    // Delete old signature if exists
    const [existing] = await db
      .select({ signatureKey: staff.signatureKey })
      .from(staff)
      .where(eq(staff.id, staffId))
      .limit(1);
    if (existing?.signatureKey) {
      await deleteFile(c.env.BUCKET, existing.signatureKey);
    }

    const result = await saveFile(c.env.BUCKET, sigFile, `staff/signatures/${staffId}`);
    if (!result.ok) {
      throw new BadRequestError("Failed to upload signature");
    }

    await db
      .update(staff)
      .set({ signatureKey: result.key, updatedAt: nowISO() })
      .where(eq(staff.id, staffId));

    return c.json({ success: true, data: { signatureKey: result.key } });
  } catch (err: any) {
    if (err instanceof BadRequestError) throw err;
    console.error("Signature upload error:", err);
    return c.json({ success: false, message: "Failed to upload signature" }, 500);
  }
});

// ─── GET /signature — get teacher's signature key ──

timetableController.get("/signature", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    const staffId = user.id;
    const db = getDb(c.env.DB);

    const [row] = await db
      .select({ signatureKey: staff.signatureKey })
      .from(staff)
      .where(eq(staff.id, staffId))
      .limit(1);

    const signatureKey = row?.signatureKey || null;
    return c.json({
      success: true,
      data: {
        signatureKey,
        signatureUrl: signatureKey ? deliverFile(signatureKey) : null,
      },
    });
  } catch (err) {
    console.error("Get signature error:", err);
    return c.json({ success: false, message: "Failed to get signature" }, 500);
  }
});

// ─── GET /staff-signature — admin fetches a teacher's signature ──

timetableController.get("/staff-signature", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    if (user.role !== "admin" && user.role !== "super_admin") {
      throw new BadRequestError("Only admin/super_admin can access this");
    }
    const staffId = c.req.query("staffId");
    if (!staffId) throw new BadRequestError("staffId is required");

    const db = getDb(c.env.DB);
    const [row] = await db
      .select({ signatureKey: staff.signatureKey })
      .from(staff)
      .where(eq(staff.id, staffId))
      .limit(1);

    const signatureKey = row?.signatureKey || null;
    return c.json({
      success: true,
      data: {
        signatureKey,
        signatureUrl: signatureKey ? deliverFile(signatureKey) : null,
      },
    });
  } catch (err: any) {
    if (err instanceof BadRequestError) throw err;
    console.error("Get staff signature error:", err);
    return c.json({ success: false, message: "Failed to get signature" }, 500);
  }
});

// ═══ Report Submission endpoints ═══════════════════

// ─── POST /submit-report — teacher submits report ──

timetableController.post("/submit-report", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    if (user.role === "admin") {
      throw new BadRequestError("Admins cannot submit reports");
    }
    const staffId = user.id;
    const institutionId = resolveInstitutionId(user);
    let body = await c.req.json<ReportParams>();
    body = normalizeReportData(body);
    const db = getDb(c.env.DB);

    const year = body.year;
    const monthNum = MONTH_NAMES.indexOf(body.monthName) + 1;
    if (!year || !monthNum) {
      throw new BadRequestError("year and monthName are required");
    }

    // Generate DOCX with signature
    const { signatureData, signatureImageType } = await loadStaffSignature(db, c.env.BUCKET, staffId);

    if (!signatureData) {
      return c.json({ success: false, message: "Please upload your signature before submitting a report." }, 400);
    }

    const submittedOn = formatSubmittedOn();

    const docxBuffer = await generateMonthlyReportDocx({
      ...body,
      signatureData,
      signatureImageType,
      submittedOn,
    });

    // Store DOCX in R2
    const docxKey = `reports/${staffId}/${year}-${String(monthNum).padStart(2, "0")}.docx`;
    if (c.env.BUCKET) {
      await c.env.BUCKET.put(docxKey, docxBuffer);
    }

    const now = nowISO();
    const reportDataJson = JSON.stringify(body);

    // Check if submission already exists (upsert)
    const [existing] = await db
      .select()
      .from(reportSubmissions)
      .where(
        and(
          eq(reportSubmissions.staffId, staffId),
          eq(reportSubmissions.year, year),
          eq(reportSubmissions.month, monthNum),
          eq(reportSubmissions.isDeleted, 0),
        ),
      )
      .limit(1);

    if (existing) {
      // Prevent re-submission if report is already approved
      if (existing.adminApproval === "verified") {
        return c.json({ success: false, message: "Cannot modify a verified report." }, 400);
      }
      // Delete old DOCX from R2 if key changed
      if (existing.docxKey && existing.docxKey !== docxKey) {
        await deleteFile(c.env.BUCKET, existing.docxKey);
      }
      const [updated] = await db
        .update(reportSubmissions)
        .set({
          reportData: reportDataJson,
          docxKey,
          status: "submitted",
          submittedAt: now,
          updatedAt: now,
          adminApproval: "pending",
          adminComment: null,
          reviewedAt: null,
          reviewedBy: null,
        })
        .where(eq(reportSubmissions.id, existing.id))
        .returning();
      return c.json({ success: true, data: updated });
    } else {
      const id = uuid();
      const [created] = await db
        .insert(reportSubmissions)
        .values({
          id,
          staffId,
          institutionId,
          year,
          month: monthNum,
          status: "submitted",
          reportData: reportDataJson,
          docxKey,
          submittedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return c.json({ success: true, data: created });
    }
  } catch (err: any) {
    if (err instanceof BadRequestError) throw err;
    console.error("Submit report error:", err);
    return c.json({ success: false, message: "Failed to submit report" }, 500);
  }
});

// ═══ Report Approval endpoints ═══════════════════

// ─── POST /approve-report — superadmin approves a report ──

timetableController.post("/approve-report", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    if (user.role !== "super_admin") {
      throw new BadRequestError("Only super_admin can approve reports");
    }

    const { submissionId } = await c.req.json();
    if (!submissionId) throw new BadRequestError("submissionId is required");

    const db = getDb(c.env.DB);
    const now = nowISO();

    const [updated] = await db
      .update(reportSubmissions)
      .set({
        adminApproval: "verified",
        reviewedAt: now,
        reviewedBy: user.id,
        updatedAt: now,
      })
      .where(eq(reportSubmissions.id, submissionId))
      .returning();

    if (!updated) throw new BadRequestError("Submission not found");

    return c.json({ success: true, data: updated });
  } catch (err: any) {
    if (err instanceof BadRequestError) throw err;
    console.error("Approve report error:", err);
    return c.json({ success: false, message: "Failed to approve report" }, 500);
  }
});

// ─── POST /cancel-approve-report — admin/superadmin cancels approval ──

timetableController.post("/cancel-approve-report", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    if (user.role !== "super_admin") {
      throw new BadRequestError("Only super_admin can cancel approval");
    }

    const { submissionId } = await c.req.json();
    if (!submissionId) throw new BadRequestError("submissionId is required");

    const db = getDb(c.env.DB);
    const now = nowISO();

    const [existing] = await db
      .select()
      .from(reportSubmissions)
      .where(eq(reportSubmissions.id, submissionId))
      .limit(1);

    if (!existing) throw new BadRequestError("Submission not found");
    if (existing.adminApproval !== "verified") {
      throw new BadRequestError("Only verified reports can have their approval cancelled");
    }

    const [updated] = await db
      .update(reportSubmissions)
      .set({
        adminApproval: "pending",
        reviewedAt: null,
        reviewedBy: null,
        updatedAt: now,
      })
      .where(eq(reportSubmissions.id, submissionId))
      .returning();

    return c.json({ success: true, data: updated });
  } catch (err: any) {
    if (err instanceof BadRequestError) throw err;
    console.error("Cancel approval error:", err);
    return c.json({ success: false, message: "Failed to cancel approval" }, 500);
  }
});

// ─── POST /reject-report — superadmin rejects a report with comment ──

timetableController.post("/reject-report", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    if (user.role !== "super_admin") {
      throw new BadRequestError("Only super_admin can reject reports");
    }

    const { submissionId, comment } = await c.req.json();
    if (!submissionId) throw new BadRequestError("submissionId is required");

    const db = getDb(c.env.DB);
    const now = nowISO();

    const [updated] = await db
      .update(reportSubmissions)
      .set({
        adminApproval: "rejected",
        adminComment: comment || null,
        reviewedAt: now,
        reviewedBy: user.id,
        updatedAt: now,
      })
      .where(eq(reportSubmissions.id, submissionId))
      .returning();

    if (!updated) throw new BadRequestError("Submission not found");

    return c.json({ success: true, data: updated });
  } catch (err: any) {
    if (err instanceof BadRequestError) throw err;
    console.error("Reject report error:", err);
    return c.json({ success: false, message: "Failed to reject report" }, 500);
  }
});

// ═══ Report Draft endpoints ═══════════════════════

// ─── POST /save-report-draft — save or update a draft ──

timetableController.post("/save-report-draft", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    if (user.role === "admin") {
      throw new BadRequestError("Admins cannot save report drafts");
    }
    const staffId = user.id;
    const institutionId = resolveInstitutionId(user);
    let body = await c.req.json<ReportParams>();
    body = normalizeReportData(body);
    const db = getDb(c.env.DB);

    const year = body.year;
    const monthNum = MONTH_NAMES.indexOf(body.monthName) + 1;
    if (!year || !monthNum) {
      throw new BadRequestError("year and monthName are required");
    }

    const now = nowISO();
    const reportDataJson = JSON.stringify(body);

    // Check if a record already exists for this staff+year+month
    const [existing] = await db
      .select()
      .from(reportSubmissions)
      .where(
        and(
          eq(reportSubmissions.staffId, staffId),
          eq(reportSubmissions.year, year),
          eq(reportSubmissions.month, monthNum),
          eq(reportSubmissions.isDeleted, 0),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.adminApproval === "verified") {
        return c.json({ success: false, message: "Cannot modify a verified report." }, 400);
      }
      // Update existing record (whether draft or submitted — saving draft overwrites)
      const [updated] = await db
        .update(reportSubmissions)
        .set({
          reportData: reportDataJson,
          status: "draft",
          adminApproval: "pending",
          adminComment: null,
          reviewedAt: null,
          reviewedBy: null,
          updatedAt: now,
        })
        .where(eq(reportSubmissions.id, existing.id))
        .returning();
      return c.json({ success: true, data: updated });
    } else {
      const id = uuid();
      const [created] = await db
        .insert(reportSubmissions)
        .values({
          id,
          staffId,
          institutionId,
          year,
          month: monthNum,
          status: "draft",
          reportData: reportDataJson,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return c.json({ success: true, data: created });
    }
  } catch (err: any) {
    if (err instanceof BadRequestError) throw err;
    console.error("Save draft error:", err);
    return c.json({ success: false, message: "Failed to save draft" }, 500);
  }
});

// ─── GET /my-report-drafts — teacher lists their own drafts ──

timetableController.get("/my-report-drafts", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    if (user.role !== "teacher" && user.role !== "staff" && user.role !== "super_admin") {
      throw new BadRequestError("Access denied");
    }

    const db = getDb(c.env.DB);
    const staffId = user.role === "teacher" ? user.id : c.req.query("staffId");
    if (!staffId) throw new BadRequestError("staffId is required");

    const drafts = await db
      .select({
        id: reportSubmissions.id,
        year: reportSubmissions.year,
        month: reportSubmissions.month,
        status: reportSubmissions.status,
        updatedAt: reportSubmissions.updatedAt,
      })
      .from(reportSubmissions)
      .where(and(
        eq(reportSubmissions.staffId, staffId),
        eq(reportSubmissions.status, "draft"),
        eq(reportSubmissions.isDeleted, 0),
      ))
      .orderBy(desc(reportSubmissions.updatedAt));

    return c.json({ success: true, data: drafts });
  } catch (err: any) {
    if (err instanceof BadRequestError) throw err;
    console.error("List drafts error:", err);
    return c.json({ success: false, message: "Failed to list drafts" }, 500);
  }
});

// ─── DELETE /delete-report-draft — delete a draft ──

timetableController.delete("/delete-report-draft", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    if (user.role === "admin") {
      throw new BadRequestError("Admins cannot delete report drafts");
    }
    const draftId = c.req.query("id");
    if (!draftId) throw new BadRequestError("id is required");

    const db = getDb(c.env.DB);
    const now = nowISO();

    const [draft] = await db
      .select()
      .from(reportSubmissions)
      .where(eq(reportSubmissions.id, draftId))
      .limit(1);

    if (!draft || draft.isDeleted) {
      throw new BadRequestError("Draft not found");
    }

    // Permission check
    if (user.role === "teacher" && draft.staffId !== user.id) {
      throw new ForbiddenError("Access denied");
    }

    // Soft delete
    await db
      .update(reportSubmissions)
      .set({ isDeleted: 1, updatedAt: now })
      .where(eq(reportSubmissions.id, draftId));

    return c.json({ success: true, message: "Draft deleted" });
  } catch (err: any) {
    if (err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    console.error("Delete draft error:", err);
    return c.json({ success: false, message: "Failed to delete draft" }, 500);
  }
});

// ─── GET /report-submission — check submission status ──

timetableController.get("/report-submission", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    const year = Number(c.req.query("year"));
    const month = Number(c.req.query("month"));
    const queryStaffId = c.req.query("staffId");

    if (!year || !month) {
      throw new BadRequestError("year and month are required");
    }

    const db = getDb(c.env.DB);

    // If admin/super_admin querying for a specific staff member
    const staffId = queryStaffId || user.id;
    if (queryStaffId && user.role !== "admin" && user.role !== "super_admin") {
      throw new BadRequestError("Only admin/super_admin can query other staff submissions");
    }

    const [submission] = await db
      .select()
      .from(reportSubmissions)
      .where(
        and(
          eq(reportSubmissions.staffId, staffId),
          eq(reportSubmissions.year, year),
          eq(reportSubmissions.month, month),
          eq(reportSubmissions.isDeleted, 0),
        ),
      )
      .limit(1);

    if (!submission) {
      return c.json({ success: true, data: null });
    }

    return c.json({ success: true, data: submission });
  } catch (err: any) {
    if (err instanceof BadRequestError) throw err;
    console.error("Check submission error:", err);
    return c.json({ success: false, message: "Failed to check submission" }, 500);
  }
});

// ─── GET /my-submissions — teacher lists their own submitted reports ──

timetableController.get("/my-submissions", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    if (user.role !== "teacher" && user.role !== "admin" && user.role !== "super_admin") {
      throw new BadRequestError("Access denied");
    }

    const db = getDb(c.env.DB);
    const staffId = user.role === "teacher" ? user.id : c.req.query("staffId");
    if (!staffId) throw new BadRequestError("staffId is required");

    const submissions = await db
      .select({
        id: reportSubmissions.id,
        year: reportSubmissions.year,
        month: reportSubmissions.month,
        status: reportSubmissions.status,
        submittedAt: reportSubmissions.submittedAt,
        docxKey: reportSubmissions.docxKey,
        adminApproval: reportSubmissions.adminApproval,
        adminComment: reportSubmissions.adminComment,
        principalSignedKey: reportSubmissions.principalSignedKey,
        principalSignedAt: reportSubmissions.principalSignedAt,
      })
      .from(reportSubmissions)
      .where(and(
        eq(reportSubmissions.staffId, staffId),
        eq(reportSubmissions.status, "submitted"),
        eq(reportSubmissions.isDeleted, 0),
      ))
      .orderBy(desc(reportSubmissions.submittedAt));

    return c.json({ success: true, data: submissions });
  } catch (err: any) {
    if (err instanceof BadRequestError) throw err;
    console.error("List my submissions error:", err);
    return c.json({ success: false, message: "Failed to list submissions" }, 500);
  }
});

// ─── GET /submission-data — get reportData for a submitted report ──

timetableController.get("/submission-data", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    const submissionId = c.req.query("id");
    if (!submissionId) throw new BadRequestError("id is required");

    const db = getDb(c.env.DB);
    const [submission] = await db
      .select()
      .from(reportSubmissions)
      .where(eq(reportSubmissions.id, submissionId))
      .limit(1);

    if (!submission || submission.isDeleted) {
      throw new BadRequestError("Submission not found");
    }

    // Permission: teacher can only see their own, admin only their institution
    if (user.role === "teacher" && submission.staffId !== user.id) {
      throw new ForbiddenError("Access denied");
    }
    if (user.role === "admin") {
      const adminInstId = resolveInstitutionId(user);
      if (submission.institutionId !== adminInstId) {
        throw new ForbiddenError("Access denied");
      }
    }

    let reportData = submission.reportData;
    if (typeof reportData === "string") {
      try { reportData = JSON.parse(reportData); } catch { /* keep as string */ }
    }
    reportData = normalizeReportData(reportData);

    return c.json({ success: true, data: { reportData, submittedAt: submission.submittedAt, year: submission.year, month: submission.month, adminApproval: submission.adminApproval, adminComment: submission.adminComment, principalSignedKey: submission.principalSignedKey, principalSignedAt: submission.principalSignedAt } });
  } catch (err: any) {
    if (err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    console.error("Get submission data error:", err);
    return c.json({ success: false, message: "Failed to get submission data" }, 500);
  }
});

// ─── GET /submitted-reports — list submitted reports ──

timetableController.get("/submitted-reports", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    if (user.role !== "admin" && user.role !== "super_admin") {
      throw new BadRequestError("Only admin/super_admin can access this");
    }

    const db = getDb(c.env.DB);
    const queryInstitutionId = c.req.query("institutionId");
    const queryStaffId = c.req.query("staffId");
    const queryMonth = c.req.query("month");
    const queryYear = c.req.query("year");

    // Admin sees only their institution; super_admin can filter
    const effectiveInstitutionId =
      user.role === "admin"
        ? resolveInstitutionId(user)
        : queryInstitutionId || undefined;

    const conditions = [
      eq(reportSubmissions.status, "submitted"),
      eq(reportSubmissions.isDeleted, 0),
    ];
    if (effectiveInstitutionId) {
      conditions.push(eq(reportSubmissions.institutionId, effectiveInstitutionId));
    }
    if (queryStaffId) {
      conditions.push(eq(reportSubmissions.staffId, queryStaffId));
    }
    if (queryMonth) {
      conditions.push(eq(reportSubmissions.month, Number(queryMonth)));
    }
    if (queryYear) {
      conditions.push(eq(reportSubmissions.year, Number(queryYear)));
    }

    const submissions = await db
      .select({
        id: reportSubmissions.id,
        staffId: reportSubmissions.staffId,
        institutionId: reportSubmissions.institutionId,
        year: reportSubmissions.year,
        month: reportSubmissions.month,
        status: reportSubmissions.status,
        submittedAt: reportSubmissions.submittedAt,
        docxKey: reportSubmissions.docxKey,
        adminApproval: reportSubmissions.adminApproval,
        adminComment: reportSubmissions.adminComment,
        principalSignedKey: reportSubmissions.principalSignedKey,
        principalSignedAt: reportSubmissions.principalSignedAt,
        mailSentAt: reportSubmissions.mailSentAt,
        staffName: staff.name,
        staffSalutation: staff.salutation,
        institutionName: institutions.name,
      })
      .from(reportSubmissions)
      .innerJoin(staff, eq(reportSubmissions.staffId, staff.id))
      .innerJoin(institutions, eq(reportSubmissions.institutionId, institutions.id))
      .where(and(...conditions));

    return c.json({ success: true, data: submissions });
  } catch (err: any) {
    if (err instanceof BadRequestError) throw err;
    console.error("List submitted reports error:", err);
    return c.json({ success: false, message: "Failed to list submitted reports" }, 500);
  }
});

// ─── GET /download-submitted-report — download DOCX from R2 ──

timetableController.get("/download-submitted-report", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    const submissionId = c.req.query("id");
    if (!submissionId) throw new BadRequestError("id is required");

    const db = getDb(c.env.DB);
    const [submission] = await db
      .select()
      .from(reportSubmissions)
      .where(eq(reportSubmissions.id, submissionId))
      .limit(1);

    if (!submission || submission.isDeleted) {
      throw new BadRequestError("Submission not found");
    }

    // Permission check: admin can only download their institution's reports
    if (user.role === "admin") {
      const adminInstId = resolveInstitutionId(user);
      if (submission.institutionId !== adminInstId) {
        throw new ForbiddenError("Access denied");
      }
    }

    let reportData: any = submission.reportData;
    if (typeof reportData === "string") {
      try { reportData = JSON.parse(reportData); } catch { /* keep as string */ }
    }

    let docxBuffer: Uint8Array | null = null;

    const { signatureData, signatureImageType } = await loadStaffSignature(db, c.env.BUCKET, submission.staffId);

    if (reportData && typeof reportData === "object" && signatureData) {
      try {
        reportData = normalizeReportData(reportData);
        docxBuffer = await generateMonthlyReportDocx({
          ...reportData,
          signatureData,
          signatureImageType,
          submittedOn: formatDateString(submission.submittedAt || reportData.submittedOn) || formatSubmittedOn(),
        });

        // Lazy-update the database record
        try {
          await db
            .update(reportSubmissions)
            .set({ reportData: JSON.stringify(reportData) })
            .where(eq(reportSubmissions.id, submission.id));
        } catch (dbErr) {
          console.error("Failed to update normalized JSON in DB:", dbErr);
        }

        // Lazy-update R2 with the clean version
        if (c.env.BUCKET && submission.docxKey) {
          try {
            await c.env.BUCKET.put(submission.docxKey, docxBuffer);
          } catch (e) {
            console.error("Failed to update corrected report in R2:", e);
          }
        }
      } catch (genErr) {
        console.error("Failed to regenerate submitted report DOCX:", genErr);
      }
    }

    if (!docxBuffer) {
      if (!submission.docxKey) {
        throw new BadRequestError("File not found in storage (no key)");
      }
      const file = await getFile(c.env.BUCKET, submission.docxKey);
      if (!file) {
        throw new BadRequestError("File not found in storage");
      }
      docxBuffer = new Uint8Array(await file.arrayBuffer());
    }

    const monthName = MONTH_NAMES[submission.month - 1] || "Report";
    const headers = new Headers();
    headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    headers.set("Content-Disposition", `attachment; filename="Monthly_Report_${monthName}_${submission.year}.docx"`);

    return new Response(docxBuffer, { headers });
  } catch (err: any) {
    if (err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    console.error("Download submitted report error:", err);
    return c.json({ success: false, message: "Failed to download report" }, 500);
  }
});

// ─── GET /view-submitted-report — redirect to Google Docs Viewer for in-browser viewing ──

timetableController.get("/view-submitted-report", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    const submissionId = c.req.query("id");
    if (!submissionId) throw new BadRequestError("id is required");

    const db = getDb(c.env.DB);
    const [submission] = await db
      .select()
      .from(reportSubmissions)
      .where(eq(reportSubmissions.id, submissionId))
      .limit(1);

    if (!submission || submission.isDeleted) {
      throw new BadRequestError("Submission not found");
    }

    // Permission check: admin can only view their institution's reports
    if (user.role === "admin") {
      const adminInstId = resolveInstitutionId(user);
      if (submission.institutionId !== adminInstId) {
        throw new ForbiddenError("Access denied");
      }
    }

    if (!submission.docxKey) {
      throw new BadRequestError("No DOCX file associated with this submission");
    }

    // Build the direct file URL using the API proxy
    const apiBase = new URL(c.req.url).origin;
    const fileUrl = `${apiBase}/api/file/proxy?key=${encodeURIComponent(submission.docxKey)}`;

    // Redirect to Google Docs Viewer for in-browser rendering
    const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
    return c.redirect(viewerUrl, 302);
  } catch (err: any) {
    if (err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    console.error("View submitted report error:", err);
    return c.json({ success: false, message: "Failed to view report" }, 500);
  }
});

// ─── POST /upload-principal-signed-report — upload principal signed PDF ──

timetableController.post("/upload-principal-signed-report", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    const body: any = await c.req.parseBody();
    const submissionId = body.submissionId?.toString?.() || c.req.query("submissionId");

    if (!submissionId) throw new BadRequestError("submissionId is required");

    const db = getDb(c.env.DB);
    const [submission] = await db
      .select()
      .from(reportSubmissions)
      .where(and(eq(reportSubmissions.id, submissionId), eq(reportSubmissions.isDeleted, 0)))
      .limit(1);

    if (!submission) throw new BadRequestError("Submission not found");

    // Only the owner trainer can upload
    if (submission.staffId !== user.id) throw new ForbiddenError("Access denied");

    // Must be verified first
    if (submission.adminApproval !== "verified") {
      throw new BadRequestError("Principal signed report can only be uploaded after admin verification");
    }

    // If a signed PDF already exists, enforce 10-day replacement window
    if (submission.principalSignedKey) {
      const signedAt = submission.principalSignedAt;
      if (!signedAt) throw new BadRequestError("Signed date not found");
      const signedDate = new Date(signedAt);
      const now = new Date();
      const daysSince = (now.getTime() - signedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 10) {
        throw new BadRequestError("10-day replacement window for principal signed report has expired");
      }
    }

    // Get the uploaded file
    const file = body.file;
    if (!file || !(file instanceof File)) throw new BadRequestError("PDF file is required");

    if (file.type !== "application/pdf") throw new BadRequestError("Only PDF files are accepted");

    // Delete old principal signed file from R2 if exists
    if (submission.principalSignedKey) {
      await deleteFile(c.env.BUCKET, submission.principalSignedKey);
    }

    // Save to R2
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const key = `principal-signed/${submission.staffId}/${submission.year}-${submission.month}-${timestamp}-${randomStr}.pdf`;
    await c.env.BUCKET.put(key, file);

    const nowStr = new Date().toISOString();
    const [updated] = await db
      .update(reportSubmissions)
      .set({ principalSignedKey: key, principalSignedAt: nowStr, updatedAt: nowStr })
      .where(eq(reportSubmissions.id, submissionId))
      .returning();

    return c.json({ success: true, data: { principalSignedKey: key, principalSignedAt: nowStr } });
  } catch (err: any) {
    if (err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    console.error("Upload principal signed report error:", err);
    return c.json({ success: false, message: "Failed to upload principal signed report" }, 500);
  }
});

// ─── GET /download-principal-signed-report — download principal signed PDF ──

timetableController.get("/download-principal-signed-report", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    const submissionId = c.req.query("id");
    if (!submissionId) throw new BadRequestError("id is required");

    const db = getDb(c.env.DB);
    const [submission] = await db
      .select()
      .from(reportSubmissions)
      .where(and(eq(reportSubmissions.id, submissionId), eq(reportSubmissions.isDeleted, 0)))
      .limit(1);

    if (!submission) throw new BadRequestError("Submission not found");

    // Only the owner trainer, admin of same institution, or super_admin can download
    if (user.role === "staff" && submission.staffId !== user.id) {
      throw new ForbiddenError("Access denied");
    }
    if (user.role === "admin") {
      const adminInstId = resolveInstitutionId(user);
      if (submission.institutionId !== adminInstId) {
        throw new ForbiddenError("Access denied");
      }
    }
    // super_admin passes through

    if (!submission.principalSignedKey) {
      throw new BadRequestError("No principal signed report uploaded yet");
    }

    const file = await getFile(c.env.BUCKET, submission.principalSignedKey);
    if (!file) {
      throw new BadRequestError("File not found in storage");
    }

    const buffer = await file.arrayBuffer();
    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Disposition", `attachment; filename="CTPL_AI&Stem_Robotics_${MONTH_NAMES[submission.month - 1] || "Report"}${submission.year}_monthly_report.pdf"`);

    return new Response(buffer, { headers });
  } catch (err: any) {
    if (err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    console.error("Download principal signed report error:", err);
    return c.json({ success: false, message: "Failed to download principal signed report" }, 500);
  }
});

// ─── POST /send-report-email — send trainer report to school email via Resend ──

// ─── GET /email-preview — preview email content before sending ──

timetableController.get("/email-preview", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    if (user.role !== "super_admin") {
      throw new ForbiddenError("Access denied");
    }

    const submissionId = c.req.query("id");
    if (!submissionId) throw new BadRequestError("id is required");

    const db = getDb(c.env.DB);
    const [submission] = await db
      .select()
      .from(reportSubmissions)
      .where(and(eq(reportSubmissions.id, submissionId), eq(reportSubmissions.isDeleted, 0)))
      .limit(1);

    if (!submission) throw new BadRequestError("Submission not found");

    const [inst] = await db
      .select()
      .from(institutions)
      .where(eq(institutions.id, submission.institutionId))
      .limit(1);

    if (!inst) throw new BadRequestError("Institution not found");

    const monthName = MONTH_NAMES[submission.month - 1] || "Report";
    const year = submission.year;
    const schoolName = inst.name;
    const schoolLocation = inst.address || "";
    const schoolNameAndLocation = schoolName + (schoolLocation ? `, ${schoolLocation}` : "");

    const subject = `Creoleap AI Integrated STEM Robotics Monthly Report ${monthName} ${year} - REG`;
    const body = `Respected Sir/Ma’am,

Greetings from Creoleap Technologies Pvt. Ltd.

Please find attached the Monthly Lesson Completion Report for the AI Integrated STEM Robotics Program conducted during ${monthName} ${year} at ${schoolNameAndLocation}.

The report provides a comprehensive summary of the sessions conducted, including:
• Lessons and topics completed as per the curriculum
• Student attendance, participation, and engagement
• Learning outcomes and skills achieved
• Trainer observations and recommendations, where applicable

This report is submitted for your kind reference and institutional records. Should you require any additional information or clarification, please feel free to contact us. Our team will be happy to assist you.

Thank you for your continued trust and partnership with Creoleap Technologies. We look forward to empowering students with future ready skills through AI, STEM, and Robotics education.

Warm Regards,
Learning & Development Department
Creoleap Technologies Pvt. Ltd.
📧 Email: info@creoleap.com
🌐 Website: www.creoleap.com
📞 Contact: +91 93632 08701`;

    const attachmentName = `CTPL_AI&Stem_Robotics_${monthName}${year}_monthly_report.pdf`;

    const defaultCc = ["cto@creoleap.com", "ceo@creoleap.com"];
    const [trainer] = await db
      .select({ email: staff.email })
      .from(staff)
      .where(eq(staff.id, submission.staffId))
      .limit(1);
    const instStaff = await db
      .select({ email: staff.email })
      .from(staff)
      .where(
        and(
          eq(staff.institutionId, submission.institutionId),
          eq(staff.isDeleted, 0),
          eq(staff.isActive, 1)
        )
      );
    const trainerEmails = new Set<string>();
    if (trainer?.email) trainerEmails.add(trainer.email);
    for (const s of instStaff) {
      if (s.email) trainerEmails.add(s.email);
    }
    for (const email of trainerEmails) {
      if (email && !defaultCc.includes(email)) {
        defaultCc.push(email);
      }
    }

    return c.json({
      success: true,
      data: {
        to: inst.contactEmail || "",
        cc: defaultCc.join(", "),
        subject,
        body,
        attachmentName,
      }
    });
  } catch (err: any) {
    if (err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    console.error("Get email preview error:", err);
    return c.json({ success: false, message: "Failed to get email preview" }, 500);
  }
});

// ─── POST /send-report-email — send signed PDF report to school email via Resend ──

timetableController.post("/send-report-email", async (c) => {
  try {
    const user = c.get("user") as Record<string, any>;
    if (user.role !== "super_admin") {
      throw new ForbiddenError("Access denied");
    }

    const { submissionId, customSubject, customBody, customCc } = await c.req.json();
    if (!submissionId) throw new BadRequestError("submissionId is required");

    const db = getDb(c.env.DB);

    const [submission] = await db
      .select()
      .from(reportSubmissions)
      .where(and(eq(reportSubmissions.id, submissionId), eq(reportSubmissions.isDeleted, 0)))
      .limit(1);

    if (!submission) throw new BadRequestError("Submission not found");

    if (submission.adminApproval !== "verified") {
      throw new BadRequestError("Report must be approved by admin first");
    }
    if (!submission.principalSignedKey) {
      throw new BadRequestError("Principal signed report is required before emailing");
    }

    let ccList: string[] = [];
    if (customCc !== undefined) {
      if (typeof customCc === "string") {
        ccList = customCc
          .split(",")
          .map((email: string) => email.trim())
          .filter((email: string) => email.length > 0);
      } else if (Array.isArray(customCc)) {
        ccList = customCc;
      }
    } else {
      const defaultCc = ["cto@creoleap.com", "ceo@creoleap.com"];
      const [trainer] = await db
        .select({ email: staff.email })
        .from(staff)
        .where(eq(staff.id, submission.staffId))
        .limit(1);
      const instStaff = await db
        .select({ email: staff.email })
        .from(staff)
        .where(
          and(
            eq(staff.institutionId, submission.institutionId),
            eq(staff.isDeleted, 0),
            eq(staff.isActive, 1)
          )
        );
      const trainerEmails = new Set<string>();
      if (trainer?.email) trainerEmails.add(trainer.email);
      for (const s of instStaff) {
        if (s.email) trainerEmails.add(s.email);
      }
      for (const email of trainerEmails) {
        if (email && !defaultCc.includes(email)) {
          defaultCc.push(email);
        }
      }
      ccList = defaultCc;
    }

    const [inst] = await db
      .select()
      .from(institutions)
      .where(eq(institutions.id, submission.institutionId))
      .limit(1);

    if (!inst) throw new BadRequestError("Institution not found");
    if (!inst.contactEmail) {
      throw new BadRequestError("School email (contact email) is not configured for this institution");
    }

    const resendApiKey = c.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new BadRequestError("Email sending is not configured (missing Resend API key)");
    }

    // Load the signed PDF document from R2 BUCKET
    const file = await getFile(c.env.BUCKET, submission.principalSignedKey);
    if (!file) {
      throw new BadRequestError("Principal signed report file not found in storage");
    }

    const pdfBuffer = new Uint8Array(await file.arrayBuffer());
    const base64Content = Buffer.from(pdfBuffer).toString("base64");

    const monthName = MONTH_NAMES[submission.month - 1] || "Report";
    const year = submission.year;
    const schoolName = inst.name;
    const schoolLocation = inst.address || "";
    const schoolNameAndLocation = schoolName + (schoolLocation ? `, ${schoolLocation}` : "");
    const filename = `CTPL_AI&Stem_Robotics_${monthName}${year}_monthly_report.pdf`;

    // Email templates
    const subject = customSubject || `Creoleap AI Integrated STEM Robotics Monthly Report ${monthName} ${year} - REG`;
    const html = customBody
      ? customBody.replace(/\r?\n/g, "<br/>")
      : `
        <p>Respected Sir/Ma’am,</p>
        <p>Greetings from Creoleap Technologies Pvt. Ltd.</p>
        <p>Please find attached the Monthly Lesson Completion Report for the AI Integrated STEM Robotics Program conducted during ${monthName} ${year} at ${schoolNameAndLocation}.</p>
        <p>The report provides a comprehensive summary of the sessions conducted, including:</p>
        <p>• Lessons and topics completed as per the curriculum<br/>
        • Student attendance, participation, and engagement<br/>
        • Learning outcomes and skills achieved<br/>
        • Trainer observations and recommendations, where applicable</p>
        <p>This report is submitted for your kind reference and institutional records. Should you require any additional information or clarification, please feel free to contact us. Our team will be happy to assist you.</p>
        <p>Thank you for your continued trust and partnership with Creoleap Technologies. We look forward to empowering students with future ready skills through AI, STEM, and Robotics education.</p>
        <p>Warm Regards,<br/>
        Learning & Development Department<br/>
        Creoleap Technologies Pvt. Ltd.<br/>
        📧 Email: <a href="mailto:info@creoleap.com">info@creoleap.com</a><br/>
        🌐 Website: <a href="http://www.creoleap.com">www.creoleap.com</a><br/>
        📞 Contact: +91 93632 08701</p>
      `;

    // Send email using Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Creoleap Technologies <info@creoleap.com>",
        to: [inst.contactEmail],
        cc: ccList.length > 0 ? ccList : undefined,
        subject: subject,
        html: html,
        attachments: [
          {
            content: base64Content,
            filename: filename,
            content_type: "application/pdf"
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("📧 [EMAIL] Failed to send email via Resend:", response.status, errorBody);
      throw new BadRequestError(`Resend API error: ${response.status} - ${errorBody}`);
    }

    const now = nowISO();
    await db
      .update(reportSubmissions)
      .set({
        mailSentAt: now,
        updatedAt: now,
      })
      .where(eq(reportSubmissions.id, submissionId));

    return c.json({ success: true, message: "Email sent successfully", mailSentAt: now });
  } catch (err: any) {
    if (err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    console.error("Send report email error:", err);
    return c.json({ success: false, message: err.message || "Failed to send email" }, 500);
  }
});

export { timetableController };
