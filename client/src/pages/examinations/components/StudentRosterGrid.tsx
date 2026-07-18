import React from "react";
import type {
  ExaminationDetail,
  ExaminationColumn,
} from "../types";
import { evaluateFormula } from "../lib/formulaEngine";
import { RosterCell } from "./RosterCell";
import { ColumnHeaderMenu } from "./ColumnHeaderMenu";

interface StudentRosterGridProps {
  examination: ExaminationDetail;
  isReadOnly: boolean;
  onCellChange: (studentId: string, columnId: string, value: string) => void;
  onAddColumn: () => void;
  onEditColumn: (column: ExaminationColumn) => void;
  onDeleteColumn: (columnId: string) => void;
  onReorderColumn: (columnId: string, direction: "left" | "right") => void;
  localCells?: Map<string, string>; // key = `${studentId}:${columnId}`
}

/**
 * Renders the student roster as a scrollable table with default columns
 * (Student Name, Class, Section) and user-defined columns.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.6, 9.3, 15.1, 15.2, 15.5,
 *               17.1, 18.1, 18.4, 20.1, 20.2
 */
export function StudentRosterGrid({
  examination,
  isReadOnly,
  onCellChange,
  onAddColumn,
  onEditColumn,
  onDeleteColumn,
  onReorderColumn,
  localCells,
}: StudentRosterGridProps) {
  // Sort user columns by their order field
  const sortedColumns = [...examination.columns].sort(
    (a, b) => a.order - b.order
  );

  // Total column count for empty-state colspan
  // 3 default + user columns + (1 for add-column button when not read-only)
  const totalColumns =
    3 + sortedColumns.length + (isReadOnly ? 0 : 1);

  const useLargeRosterOptimization = examination.students.length > 100;

  // ---------------------------------------------------------------------------
  // Sticky default column header styles
  // ---------------------------------------------------------------------------
  const defaultThClass =
    "sticky z-10 bg-[var(--neo-bg)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider border border-border/40 whitespace-nowrap";

  const defaultTdClass =
    "sticky z-10 bg-[var(--neo-bg)] px-3 py-2 text-sm border border-border/40 whitespace-nowrap";

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm w-full">
        {/* ------------------------------------------------------------------ */}
        {/* THEAD                                                               */}
        {/* ------------------------------------------------------------------ */}
        <thead className="sticky top-0 z-20 bg-[var(--neo-bg)]">
          <tr>
            {/* Default: Student Name */}
            <th className={`${defaultThClass} left-0`}>
              Student Name
            </th>

            {/* Default: Class */}
            <th className={`${defaultThClass} left-[150px]`}>
              Class
            </th>

            {/* Default: Section */}
            <th className={`${defaultThClass} left-[250px]`}>
              Section
            </th>

            {/* User-defined columns */}
            {sortedColumns.map((column, index) => (
              <th
                key={column.id}
                className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider border border-border/40 whitespace-nowrap min-w-[120px]"
              >
                <div className="flex items-center gap-1">
                  <span>{column.name}</span>
                  {!isReadOnly && (
                    <ColumnHeaderMenu
                      column={column}
                      onEdit={onEditColumn}
                      onDelete={onDeleteColumn}
                      onMoveLeft={(id) => onReorderColumn(id, "left")}
                      onMoveRight={(id) => onReorderColumn(id, "right")}
                      isFirst={index === 0}
                      isLast={index === sortedColumns.length - 1}
                    />
                  )}
                </div>
              </th>
            ))}

            {/* Add Column button */}
            {!isReadOnly && (
              <th className="px-3 py-2 border border-border/40">
                <button
                  onClick={onAddColumn}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap"
                >
                  + Add Column
                </button>
              </th>
            )}
          </tr>
        </thead>

        {/* ------------------------------------------------------------------ */}
        {/* TBODY                                                               */}
        {/* ------------------------------------------------------------------ */}
        <tbody>
          {examination.students.length === 0 ? (
            <tr>
              <td
                colSpan={totalColumns}
                className="px-3 py-8 text-center text-sm text-muted-foreground"
              >
                Select classes above to populate the student roster
              </td>
            </tr>
          ) : (
            examination.students.map((student) => {
              const rowStyle: React.CSSProperties | undefined =
                useLargeRosterOptimization
                  ? {
                      contentVisibility: "auto" as React.CSSProperties["contentVisibility"],
                      containIntrinsicSize: "0 50px",
                    }
                  : undefined;

              return (
                <tr key={student.studentId} style={rowStyle}>
                  {/* Student Name */}
                  <td className={`${defaultTdClass} left-0`}>
                    {student.name}
                  </td>

                  {/* Class */}
                  <td className={`${defaultTdClass} left-[150px]`}>
                    {student.grade}
                  </td>

                  {/* Section */}
                  <td className={`${defaultTdClass} left-[250px]`}>
                    {student.section}
                  </td>

                  {/* User-defined column cells */}
                  {sortedColumns.map((column) => {
                    if (column.type === "formula") {
                      // Build formula context: prefer localCells, fall back to examination.cells
                      const ctx: Record<string, number> = {};
                      for (const col of sortedColumns) {
                        if (col.type !== "number") continue;
                        // Try localCells first, then fall back to examination.cells
                        const localVal = localCells?.get(`${student.studentId}:${col.id}`);
                        const serverCell = examination.cells.find(
                          (c) => c.studentId === student.studentId && c.columnId === col.id
                        );
                        const raw = localVal !== undefined ? localVal : (serverCell?.value ?? "");
                        const parsed = parseFloat(raw);
                        ctx[col.name] = isNaN(parsed) ? 0 : parsed;
                      }

                      const result = evaluateFormula(column.formula!, {
                        values: ctx,
                      });

                      const displayValue =
                        result.value !== null
                          ? String(result.value)
                          : "";

                      return (
                        <RosterCell
                          key={column.id}
                          value={displayValue}
                          columnType={column.type}
                          isReadOnly={isReadOnly}
                          isFormula={true}
                          maxMarks={column.maxMarks}
                          error={result.error}
                          aria-label={`${student.name} — ${column.name}`}
                        />
                      );
                    }

                    // Regular (number or text) cell
                    const localVal = localCells?.get(`${student.studentId}:${column.id}`);
                    const serverCell = examination.cells.find(
                      (c) => c.studentId === student.studentId && c.columnId === column.id
                    );
                    const cellValue = localVal !== undefined ? localVal : (serverCell?.value ?? "");

                    return (
                      <RosterCell
                        key={column.id}
                        value={cellValue}
                        columnType={column.type}
                        isReadOnly={isReadOnly}
                        isFormula={false}
                        maxMarks={column.maxMarks}
                        onChange={(val) =>
                          onCellChange(student.studentId, column.id, val)
                        }
                        aria-label={`${student.name} — ${column.name}`}
                      />
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
