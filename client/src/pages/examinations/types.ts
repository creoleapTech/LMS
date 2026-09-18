import { z } from "zod";
import { TEXT_LIMITS } from "@/lib/validation/textLimits";

// ---------------------------------------------------------------------------
// Column types
// ---------------------------------------------------------------------------

export type ColumnType = "number" | "text" | "formula";

export interface ExaminationColumn {
  id: string;       // UUID
  grade: string;    // Grade scope — each grade owns an independent column set
  name: string;     // Display name, used in formula references
  type: ColumnType;
  formula?: string; // Only for type === "formula"
  maxMarks?: number; // Only for type === "number"
  order: number;    // Display order (0-indexed, after default columns)
}

export interface GradeTab {
  grade: string;
  studentCount: number;
  columnCount: number;
  sectionCount: number;
}

// Default columns are synthetic — not stored in the columns array
export const DEFAULT_COLUMNS = ["studentName", "class", "section"] as const;
export type DefaultColumnKey = typeof DEFAULT_COLUMNS[number];

// ---------------------------------------------------------------------------
// Cell data
// ---------------------------------------------------------------------------

export interface CellData {
  studentId: string;
  columnId: string;
  value: string; // Always stored as string; parsed on read for number columns
}

// ---------------------------------------------------------------------------
// Examination records
// ---------------------------------------------------------------------------

export interface Examination {
  id: string;
  _id: string;           // normalised by axios interceptor
  name: string;
  createdBy: string;     // user id
  createdByName?: string;
  institutionId: string;
  selectedClassIds: string[];
  columns: ExaminationColumn[];
  studentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudentRow {
  studentId: string;
  name: string;
  classId: string;
  grade: string;
  section: string;
}

// Examination with fully resolved data (detail view)
export interface ExaminationDetail extends Examination {
  students: StudentRow[];
  cells: CellData[];
}

// ---------------------------------------------------------------------------
// API payloads
// ---------------------------------------------------------------------------

export interface CreateExaminationPayload {
  name: string;
  selectedClassIds?: string[];
}

export interface UpdateExaminationPayload {
  name?: string;
  selectedClassIds?: string[];
}

export interface SaveColumnsPayload {
  grade: string;
  columns: ExaminationColumn[];
}

export interface SaveCellsPayload {
  cells: Array<{ studentId: string; columnId: string; value: string }>;
}

// ---------------------------------------------------------------------------
// Form values
// ---------------------------------------------------------------------------

export interface ExaminationFormValues {
  name: string;
}

export interface ColumnConfigFormValues {
  name: string;
  type: ColumnType;
  formula?: string;
  maxMarks?: number;
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const examinationSchema = z.object({
  name: z.string().trim().min(1, "Examination name is required").max(TEXT_LIMITS.examinationName, "Name too long"),
});

export const columnConfigSchema = z
  .object({
    name: z.string().trim().min(1, "Column name is required").max(TEXT_LIMITS.examinationColumnName, "Column name too long"),
    type: z.enum(["number", "text", "formula"]),
    formula: z.string().trim().max(TEXT_LIMITS.examinationFormula, "Formula too long").optional().or(z.literal("")),
    maxMarks: z
      .number({ invalid_type_error: "Must be a number" })
      .positive("Max marks must be positive")
      .optional(),
  })
  .refine(
    (data) =>
      data.type !== "formula" ||
      (data.formula !== undefined && data.formula.trim().length > 0),
    { message: "Formula is required for formula columns", path: ["formula"] }
  );

// ---------------------------------------------------------------------------
// Pure utility functions
// ---------------------------------------------------------------------------

/**
 * Returns the columns belonging to a single grade, sorted by order.
 * Legacy columns with an empty grade are treated as belonging to the
 * requested grade (pre-migration shared data).
 */
export function columnsForGrade(
  columns: ExaminationColumn[],
  grade: string
): ExaminationColumn[] {
  return columns
    .filter((c) => (c.grade ?? "") === "" || c.grade === grade)
    .sort((a, b) => a.order - b.order);
}

/**
 * Returns the students belonging to a single grade, sorted by section then name.
 */
export function studentsForGrade(
  students: StudentRow[],
  grade: string
): StudentRow[] {
  return students
    .filter((s) => s.grade === grade)
    .sort((a, b) => {
      const sc = a.section.localeCompare(b.section);
      if (sc !== 0) return sc;
      return a.name.localeCompare(b.name);
    });
}

/**
 * Derives the distinct grades present in a student roster, in numeric order.
 */
export function gradesFromStudents(students: StudentRow[]): string[] {
  const grades = [...new Set(students.map((s) => s.grade).filter((g) => g !== ""))];
  return grades.sort((a, b) => (Number(a) || 0) - (Number(b) || 0));
}

export const ABSENT_CODES = ["AB", "ABS", "ABSENT", "A"] as const;

/**
 * Checks if a string value represents an absent student (e.g. "AB", "Absent", "A").
 */
export function isAbsentValue(val: string): boolean {
  if (!val) return false;
  const trimmed = val.trim().toUpperCase();
  return (ABSENT_CODES as readonly string[]).includes(trimmed);
}

/**
 * Returns a formatted class label, e.g. "Class 6 - A".
 */
export function formatClassLabel(grade: string, section: string): string {
  return `Class ${grade} - ${section}`;
}

/**
 * Builds a formula evaluation context for a single student row.
 *
 * Maps each number-type column's name to the numeric value stored in `cells`
 * for that student/column pair. Empty or non-numeric values are treated as 0.
 * Only number-type columns are included in the context.
 */
export function buildFormulaContext(
  row: StudentRow,
  cells: CellData[],
  columns: ExaminationColumn[]
): Record<string, number> {
  const context: Record<string, number> = {};

  for (const column of columns) {
    if (column.type !== "number") continue;

    const cell = cells.find(
      (c) => c.studentId === row.studentId && c.columnId === column.id
    );

    const raw = cell?.value ?? "";
    const parsed = parseFloat(raw);
    context[column.name] = isNaN(parsed) ? 0 : parsed;
  }

  return context;
}
