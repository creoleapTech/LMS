import { z } from "zod";

// ─── Status ──────────────────────────────────────────────────────────────────

export type PlanStatus = "draft" | "ready" | "completed";

// ─── Core interfaces ─────────────────────────────────────────────────────────

export interface LessonPlan {
  id: string;
  _id: string; // alias normalised by _axios interceptor
  staffId: string;
  institutionId: string;
  title: string;
  subject: string;
  gradeOrClass: string;
  date: string; // YYYY-MM-DD
  periodNumber?: number | null;
  durationMinutes: number;
  status: PlanStatus;
  learningObjectives?: string;
  materialsNeeded?: string;
  introduction?: string;
  mainActivity?: string;
  conclusion?: string;
  assessmentMethod?: string;
  homeworkNotes?: string;
  gradeBookId?: string | { id: string; bookTitle: string; grade: number } | null;
  chapterId?: string | { id: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLessonPlanPayload {
  title: string;
  subject: string;
  gradeOrClass: string;
  date: string;
  periodNumber?: number | null;
  durationMinutes: number;
  learningObjectives?: string;
  materialsNeeded?: string;
  introduction?: string;
  mainActivity?: string;
  conclusion?: string;
  assessmentMethod?: string;
  homeworkNotes?: string;
  gradeBookId?: string | null;
  chapterId?: string | null;
}

export type UpdateLessonPlanPayload = Partial<CreateLessonPlanPayload> & {
  status?: PlanStatus;
};

export interface LessonPlanFormValues {
  title: string;
  subject: string;
  gradeOrClass: string;
  date: string;
  periodNumber?: number;
  durationMinutes: number;
  learningObjectives?: string;
  materialsNeeded?: string;
  introduction?: string;
  mainActivity?: string;
  conclusion?: string;
  assessmentMethod?: string;
  homeworkNotes?: string;
  gradeBookId?: string;
  chapterId?: string;
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

export interface GroupedLessonPlans {
  key: string; // "2025-W23" for week, "2025-06" for month
  label: string; // "Week 23, 2025" or "June 2025"
  plans: LessonPlan[];
}

// ─── Zod validation schema ────────────────────────────────────────────────────

export const lessonPlanSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subject: z.string().min(1, "Subject is required"),
  gradeOrClass: z.string().min(1, "Grade or class is required"),
  date: z
    .string()
    .min(1, "Date is required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  periodNumber: z
    .number({ invalid_type_error: "Period must be a number" })
    .int("Period must be a whole number")
    .positive("Period must be a positive number")
    .optional(),
  durationMinutes: z
    .number({ invalid_type_error: "Duration must be a number" })
    .int("Duration must be a whole number")
    .positive("Duration must be a positive number"),
  learningObjectives: z.string().optional(),
  materialsNeeded: z.string().optional(),
  introduction: z.string().optional(),
  mainActivity: z.string().optional(),
  conclusion: z.string().optional(),
  assessmentMethod: z.string().optional(),
  homeworkNotes: z.string().optional(),
  gradeBookId: z.string().optional(),
  chapterId: z.string().optional(),
});

// ─── Grouping utilities ───────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Groups an array of lesson plans by calendar month.
 *
 * Returns groups ordered chronologically. Each group's `key` is "YYYY-MM"
 * and `label` is e.g. "June 2025".
 *
 * Pure function — no React dependencies.
 */
export function groupByMonth(plans: LessonPlan[]): GroupedLessonPlans[] {
  const map = new Map<string, LessonPlan[]>();

  for (const plan of plans) {
    // date is YYYY-MM-DD; take the first 7 chars for the month key
    const key = plan.date.slice(0, 7); // "YYYY-MM"
    const existing = map.get(key);
    if (existing) {
      existing.push(plan);
    } else {
      map.set(key, [plan]);
    }
  }

  // Sort keys chronologically
  const sortedKeys = Array.from(map.keys()).sort();

  return sortedKeys.map((key) => {
    const [yearStr, monthStr] = key.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1; // 0-indexed
    const label = `${MONTH_NAMES[month]} ${year}`;
    return { key, label, plans: map.get(key)! };
  });
}

/**
 * Calculates the ISO week number for a given date.
 *
 * ISO 8601: the week containing the first Thursday of the year is week 1.
 * Returns { week, year } where year may differ from the calendar year for
 * dates near the year boundary.
 */
function getISOWeek(date: Date): { week: number; year: number } {
  // Copy date so we don't mutate the original
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

  // Set to nearest Thursday: current date + 4 - current day number (Mon=1, Sun=7)
  const dayOfWeek = d.getUTCDay() || 7; // convert Sunday (0) to 7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);

  // Get the first day of the year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));

  // Calculate full weeks to nearest Thursday
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  return { week, year: d.getUTCFullYear() };
}

/**
 * Groups an array of lesson plans by ISO week.
 *
 * Returns groups ordered chronologically. Each group's `key` is "YYYY-WNN"
 * (zero-padded to 2 digits) and `label` is e.g. "Week 23, 2025".
 *
 * Pure function — no React dependencies.
 */
export function groupByWeek(plans: LessonPlan[]): GroupedLessonPlans[] {
  const map = new Map<string, LessonPlan[]>();

  for (const plan of plans) {
    const [yearStr, monthStr, dayStr] = plan.date.split("-");
    const date = new Date(
      parseInt(yearStr, 10),
      parseInt(monthStr, 10) - 1,
      parseInt(dayStr, 10),
    );
    const { week, year } = getISOWeek(date);
    const weekPadded = String(week).padStart(2, "0");
    const key = `${year}-W${weekPadded}`;

    const existing = map.get(key);
    if (existing) {
      existing.push(plan);
    } else {
      map.set(key, [plan]);
    }
  }

  // Sort keys chronologically
  const sortedKeys = Array.from(map.keys()).sort();

  return sortedKeys.map((key) => {
    // key format: "YYYY-WNN"
    const [yearStr, weekPart] = key.split("-W");
    const year = parseInt(yearStr, 10);
    const week = parseInt(weekPart, 10);
    const label = `Week ${week}, ${year}`;
    return { key, label, plans: map.get(key)! };
  });
}
