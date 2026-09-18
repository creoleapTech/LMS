import { evaluateFormula } from "./formulaEngine";
import type { CellData, ExaminationColumn, StudentRow } from "../types";
import type { SortConfig } from "../types";

// ---------------------------------------------------------------------------
// Section filter
// ---------------------------------------------------------------------------

/** Distinct sections in a student list, sorted alphabetically. */
export function sectionsInStudents(students: StudentRow[]): string[] {
  return [...new Set(students.map((s) => s.section).filter((s) => s !== ""))].sort(
    (a, b) => a.localeCompare(b)
  );
}

/** Filters students to one section; "all" (or empty) returns everyone. */
export function filterStudentsBySection(
  students: StudentRow[],
  section: string
): StudentRow[] {
  if (!section || section === "all") return students;
  return students.filter((s) => s.section === section);
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

interface SortValue {
  /** Numeric value when the cell is numeric; null for empty/non-numeric text. */
  numeric: number | null;
  text: string;
}

/** Resolves the raw stored value for a student/column pair (unsaved edits win). */
function rawCellValue(
  student: StudentRow,
  columnId: string,
  cells: CellData[],
  localCells?: Map<string, string>
): string {
  const localVal = localCells?.get(`${student.studentId}:${columnId}`);
  if (localVal !== undefined) return localVal;
  return (
    cells.find((c) => c.studentId === student.studentId && c.columnId === columnId)
      ?.value ?? ""
  );
}

/** Builds the formula context for one student (mirrors StudentRosterGrid). */
function formulaContext(
  student: StudentRow,
  columns: ExaminationColumn[],
  cells: CellData[],
  localCells?: Map<string, string>
): Record<string, number> {
  const ctx: Record<string, number> = {};
  for (const col of columns) {
    if (col.type !== "number") continue;
    const parsed = parseFloat(rawCellValue(student, col.id, cells, localCells));
    ctx[col.name] = isNaN(parsed) ? 0 : parsed;
  }
  return ctx;
}

/**
 * Resolves a comparable value for a student under a sort key.
 * Default keys: "studentName" | "grade" | "section"; otherwise a column id.
 */
export function getSortValue(
  student: StudentRow,
  key: string,
  columns: ExaminationColumn[],
  cells: CellData[],
  localCells?: Map<string, string>
): SortValue {
  if (key === "studentName") return { numeric: null, text: student.name ?? "" };
  if (key === "section") return { numeric: null, text: student.section ?? "" };
  if (key === "grade") {
    const n = Number(student.grade);
    return isNaN(n)
      ? { numeric: null, text: student.grade ?? "" }
      : { numeric: n, text: student.grade };
  }

  const column = columns.find((c) => c.id === key);
  if (!column) return { numeric: null, text: "" };

  if (column.type === "formula") {
    const result = evaluateFormula(column.formula ?? "", {
      values: formulaContext(student, columns, cells, localCells),
    });
    return result.value !== null
      ? { numeric: result.value, text: String(result.value) }
      : { numeric: null, text: "" };
  }

  const raw = rawCellValue(student, column.id, cells, localCells);
  if (column.type === "number") {
    const n = parseFloat(raw);
    return isNaN(n) ? { numeric: null, text: raw } : { numeric: n, text: raw };
  }
  return { numeric: null, text: raw };
}

/**
 * Sorts students by a sort config. Numeric values (marks, totals) compare
 * numerically; empty/non-numeric values (blank, absent) always sink to the
 * bottom in both directions. Ties break by student name for stability.
 * Unknown sort keys leave the order untouched.
 */
export function sortStudents(
  students: StudentRow[],
  sort: SortConfig | null,
  columns: ExaminationColumn[],
  cells: CellData[],
  localCells?: Map<string, string>
): StudentRow[] {
  if (!sort) return students;
  // Unknown keys (e.g. a column deleted in another tab) leave the roster
  // order untouched instead of applying a meaningless sort.
  const knownKey =
    sort.key === "studentName" ||
    sort.key === "grade" ||
    sort.key === "section" ||
    columns.some((c) => c.id === sort.key);
  if (!knownKey) return students;
  const dir = sort.direction === "asc" ? 1 : -1;

  return [...students].sort((a, b) => {
    const va = getSortValue(a, sort.key, columns, cells, localCells);
    const vb = getSortValue(b, sort.key, columns, cells, localCells);

    if (va.numeric !== null || vb.numeric !== null) {
      if (va.numeric === null) return 1;
      if (vb.numeric === null) return -1;
      if (va.numeric !== vb.numeric) return (va.numeric - vb.numeric) * dir;
    } else {
      // Blank values sink below any text in both directions
      if (va.text === "" && vb.text !== "") return 1;
      if (vb.text === "" && va.text !== "") return -1;
      const cmp = va.text.localeCompare(vb.text);
      if (cmp !== 0) return cmp * dir;
    }
    return a.name.localeCompare(b.name);
  });
}
