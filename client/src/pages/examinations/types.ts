import { z } from "zod";

// ---------------------------------------------------------------------------
// Column types
// ---------------------------------------------------------------------------

export type ColumnType = "number" | "text" | "formula";

export interface ExaminationColumn {
  id: string;       // UUID
  name: string;     // Display name, used in formula references
  type: ColumnType;
  formula?: string; // Only for type === "formula"
  order: number;    // Display order (0-indexed, after default columns)
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
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const examinationSchema = z.object({
  name: z.string().trim().min(1, "Examination name is required").max(200),
});

export const columnConfigSchema = z
  .object({
    name: z.string().min(1, "Column name is required").max(100),
    type: z.enum(["number", "text", "formula"]),
    formula: z.string().optional(),
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
