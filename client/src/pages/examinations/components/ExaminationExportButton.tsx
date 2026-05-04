import * as XLSX from "xlsx";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExaminationDetail } from "../types";

interface ExaminationExportButtonProps {
  examination: ExaminationDetail;
}

/**
 * Escapes a CSV cell value. If the value contains a comma, newline, or double
 * quote, wraps it in double quotes and escapes any internal double quotes by
 * doubling them.
 */
function escapeCsvCell(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Builds the shared 2D array (header row + data rows) used for both CSV and
 * Excel export.
 */
function buildRows(examination: ExaminationDetail): string[][] {
  const userColumns = [...examination.columns].sort((a, b) => a.order - b.order);

  const headers = [
    "Student Name",
    "Class",
    "Section",
    ...userColumns.map((col) => col.name),
  ];

  const dataRows = examination.students.map((student) => {
    const defaultValues = [student.name, student.grade, student.section];
    const cellValues = userColumns.map(
      (col) =>
        examination.cells.find(
          (c) => c.studentId === student.studentId && c.columnId === col.id
        )?.value ?? ""
    );
    return [...defaultValues, ...cellValues];
  });

  return [headers, ...dataRows];
}

/**
 * ExaminationExportButton
 *
 * Renders a dropdown button with CSV and Excel export options.
 * Column order: default columns first, then user columns sorted by order.
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5
 */
export function ExaminationExportButton({
  examination,
}: ExaminationExportButtonProps) {
  function handleExportCsv() {
    const rows = buildRows(examination);
    const csvString = rows
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\n");

    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${examination.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportExcel() {
    const rows = buildRows(examination);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Roster");
    XLSX.writeFile(wb, `${examination.name}.xlsx`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="rounded-xl gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={handleExportCsv}>
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportExcel}>
          Export as Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
