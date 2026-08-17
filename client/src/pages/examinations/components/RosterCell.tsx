import React, { useState } from "react";
import type { ColumnType } from "../types";

interface RosterCellProps {
  value: string;
  columnType: ColumnType;
  isReadOnly: boolean;
  isFormula: boolean;
  maxMarks?: number;
  error?: string | null;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  "aria-label": string;
}

/**
 * A single cell in the student roster grid.
 *
 * Handles three rendering modes:
 * 1. Formula / read-only  → plain <td> with optional error icon
 * 2. Number column        → <input type="text" inputMode="decimal"> with blur validation
 * 3. Text column          → <input type="text"> with onChange passthrough
 *
 * Keyboard navigation (Enter / ArrowDown / ArrowUp) moves focus between cells
 * using `data-cell-input="true"` data attributes.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 9.3, 9.5, 20.1, 20.2
 */
export function RosterCell({
  value,
  columnType,
  isReadOnly,
  isFormula,
  maxMarks,
  error,
  onChange,
  onBlur,
  "aria-label": ariaLabel,
}: RosterCellProps) {
  const [localError, setLocalError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Keyboard navigation helper
  // -------------------------------------------------------------------------
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();

      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>("[data-cell-input='true']")
      );
      const currentIndex = inputs.indexOf(e.currentTarget);
      if (currentIndex === -1) return;

      // Determine how many columns are in the table so we can jump a full row.
      const td = e.currentTarget.closest("td");
      const tr = td?.closest("tr");
      const columnCount = tr ? tr.querySelectorAll("td").length : 1;

      let targetIndex: number;
      if (e.key === "ArrowUp") {
        targetIndex = currentIndex - columnCount;
      } else {
        // Enter or ArrowDown
        targetIndex = currentIndex + columnCount;
      }

      if (targetIndex >= 0 && targetIndex < inputs.length) {
        inputs[targetIndex].focus();
      }
    }
  }

  // -------------------------------------------------------------------------
  // 1. Formula or read-only cell
  // -------------------------------------------------------------------------
  if (isFormula || isReadOnly) {
    const tdClass = [
      "px-2 py-1 border-b border-r border-border/40 min-w-[100px] max-w-[200px]",
      isFormula ? "bg-muted/30" : "text-muted-foreground",
    ].join(" ");

    return (
      <td className={tdClass} aria-label={ariaLabel}>
        <span>{value}</span>
        {isFormula && error && (
          <span
            className="ml-1 text-red-500 cursor-help"
            title={error}
            aria-label="Formula error"
            role="img"
          >
            ⚠
          </span>
        )}
      </td>
    );
  }

  // -------------------------------------------------------------------------
  // 2. Number column
  // -------------------------------------------------------------------------
  if (columnType === "number") {
    function validateNumber(val: string): string | null {
      if (val === "") return null;
      const num = Number(val);
      if (isNaN(num) || !isFinite(num)) return "Must be a number";
      if (maxMarks !== undefined && maxMarks > 0 && num > maxMarks)
        return `Max marks is ${maxMarks}`;
      return null;
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const val = e.target.value;
      onChange?.(val);
      setLocalError(validateNumber(val));
    }

    function handleNumberBlur() {
      setLocalError(validateNumber(value));
      onBlur?.();
    }

    const inputClass = [
      "w-full bg-transparent outline-none text-sm px-1 py-0.5",
      localError ? "border border-red-500 rounded" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <td className="px-2 py-1 border-b border-r border-border/40 min-w-[100px] max-w-[200px]">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          max={maxMarks}
          className={inputClass}
          aria-label={ariaLabel}
          data-cell-input="true"
          onChange={handleChange}
          onBlur={handleNumberBlur}
          onKeyDown={handleKeyDown}
        />
        {localError && (
          <p className="text-red-500 text-xs mt-0.5">{localError}</p>
        )}
      </td>
    );
  }

  // -------------------------------------------------------------------------
  // 3. Text column
  // -------------------------------------------------------------------------
  return (
    <td className="px-2 py-1 border-b border-r border-border/40 min-w-[100px] max-w-[200px]">
      <input
        type="text"
        value={value}
        className="w-full bg-transparent outline-none text-sm px-1 py-0.5"
        aria-label={ariaLabel}
        data-cell-input="true"
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
      />
    </td>
  );
}
