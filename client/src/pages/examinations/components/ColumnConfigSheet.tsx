"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, XCircle } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { validateFormula } from "../lib/formulaEngine";
import {
  columnConfigSchema,
  type ExaminationColumn,
  type ColumnConfigFormValues,
  type ColumnType,
} from "../types";
import { TEXT_LIMITS } from "@/lib/validation/textLimits";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ColumnConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingColumns: ExaminationColumn[];
  onSave: (column: Omit<ExaminationColumn, "id" | "order">) => void;
  editingColumn?: ExaminationColumn;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ColumnConfigSheet
 *
 * A side sheet for adding or editing examination columns. Supports:
 * - Column name with uniqueness validation (case-insensitive)
 * - Column type selection: Number, Text, Formula
 * - Formula textarea with live validation when type is "formula"
 * - Create mode ("Add Column") and edit mode ("Save Column")
 * - Form reset when sheet opens; pre-population in edit mode
 *
 * Requirements: 5.2, 5.3, 5.4, 5.5, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 19.3
 */
export function ColumnConfigSheet({
  open,
  onOpenChange,
  existingColumns,
  onSave,
  editingColumn,
}: ColumnConfigSheetProps) {
  const isEditMode = editingColumn !== undefined;

  // ── Form setup ─────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ColumnConfigFormValues>({
    resolver: zodResolver(columnConfigSchema),
    defaultValues: {
      name: "",
      type: "number",
      formula: "",
    },
  });

  // ── Reset / pre-populate form when sheet opens ─────────────────────────────
  useEffect(() => {
    if (open) {
      if (isEditMode && editingColumn) {
        reset({
          name: editingColumn.name,
          type: editingColumn.type,
          formula: editingColumn.formula ?? "",
        });
      } else {
        reset({
          name: "",
          type: "number",
          formula: "",
        });
      }
    }
  }, [open, isEditMode, editingColumn, reset]);

  // ── Watched values ─────────────────────────────────────────────────────────
  const watchedType = watch("type") as ColumnType;
  const watchedFormula = watch("formula") ?? "";

  // ── Derived: number column names available for formula references ──────────
  const existingNumberColumnNames = existingColumns
    .filter(
      (col) =>
        col.type === "number" &&
        (!isEditMode || col.id !== editingColumn?.id)
    )
    .map((col) => col.name);

  // ── Live formula validation ────────────────────────────────────────────────
  const formulaValidationError =
    watchedType === "formula" && watchedFormula.trim().length > 0
      ? validateFormula(watchedFormula, existingNumberColumnNames)
      : null;

  const isFormulaValid =
    watchedType === "formula" &&
    watchedFormula.trim().length > 0 &&
    formulaValidationError === null;

  // ── Submit handler ─────────────────────────────────────────────────────────
  const onSubmit = (values: ColumnConfigFormValues) => {
    // Validate column name uniqueness (case-insensitive), excluding editingColumn
    const nameLower = values.name.trim().toLowerCase();
    const isDuplicate = existingColumns.some(
      (col) =>
        col.name.toLowerCase() === nameLower &&
        (!isEditMode || col.id !== editingColumn?.id)
    );

    if (isDuplicate) {
      return;
    }

    onSave({
      name: values.name.trim(),
      type: values.type,
      formula: values.type === "formula" ? values.formula : undefined,
      maxMarks: values.type === "number" && values.maxMarks ? values.maxMarks : undefined,
    });
    onOpenChange(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col overflow-y-auto">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <SheetHeader className="border-b border-white/20 pb-4">
          <SheetTitle className="text-xl font-semibold">
            {isEditMode ? "Edit Column" : "Add Column"}
          </SheetTitle>
          <SheetDescription>
            {isEditMode
              ? "Update the column configuration below."
              : "Configure a new column for this examination."}
          </SheetDescription>
        </SheetHeader>

        {/* ── Form ────────────────────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 gap-6 px-6 py-4"
        >
          {/* ── Column Name ───────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="column-name" className="text-sm font-medium">
              Column Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="column-name"
              placeholder="e.g. Math Score"
              maxLength={TEXT_LIMITS.examinationColumnName}
              {...register("name", {
                validate: (value) => {
                  const nameLower = value.trim().toLowerCase();
                  const isDuplicate = existingColumns.some(
                    (col) =>
                      col.name.toLowerCase() === nameLower &&
                      (!isEditMode || col.id !== editingColumn?.id)
                  );
                  return isDuplicate
                    ? "A column with this name already exists"
                    : true;
                },
              })}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* ── Column Type ───────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="column-type" className="text-sm font-medium">
              Column Type <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(val) => field.onChange(val as ColumnType)}
                >
                  <SelectTrigger id="column-type" className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="formula">Formula</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.type && (
              <p className="text-xs text-destructive">{errors.type.message}</p>
            )}
          </div>

          {/* ── Max Marks (only when type === "number") ──────────────────── */}
          {watchedType === "number" && (
            <div className="space-y-1.5">
              <Label htmlFor="column-max-marks" className="text-sm font-medium">
                Max Marks
              </Label>
              <Controller
                name="maxMarks"
                control={control}
                render={({ field }) => (
                  <Input
                    id="column-max-marks"
                    type="number"
                    min="1"
                    step="any"
                    placeholder="e.g. 100"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                  />
                )}
              />
              {errors.maxMarks && (
                <p className="text-xs text-destructive">{errors.maxMarks.message}</p>
              )}
            </div>
          )}

          {/* ── Formula field (only when type === "formula") ───────────────── */}
          {watchedType === "formula" && (
            <div className="space-y-1.5">
              <Label htmlFor="column-formula" className="text-sm font-medium">
                Formula <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="column-formula"
                placeholder="e.g. Math + Science / 2"
                rows={3}
                maxLength={TEXT_LIMITS.examinationFormula}
                {...register("formula")}
              />

              {/* Live validation indicator */}
              {watchedFormula.trim().length > 0 && (
                <div className="flex items-center gap-1.5 text-xs mt-1">
                  {isFormulaValid ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      <span className="text-green-600">Valid formula</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      <span className="text-destructive">
                        {formulaValidationError}
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* Zod schema error (e.g. formula required but empty) */}
              {errors.formula && (
                <p className="text-xs text-destructive">
                  {errors.formula.message}
                </p>
              )}

              {/* Helper: available number columns */}
              {existingNumberColumnNames.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Available columns:{" "}
                  {existingNumberColumnNames.join(", ")}
                </p>
              )}
            </div>
          )}

          {/* ── Spacer to push footer to bottom ───────────────────────────── */}
          <div className="flex-1" />

          {/* ── Footer: action buttons ────────────────────────────────────── */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-white/20">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30"
            >
              {isEditMode ? "Save Column" : "Add Column"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
