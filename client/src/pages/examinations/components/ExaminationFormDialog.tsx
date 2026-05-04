"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ClipboardList, CheckSquare, Square } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { _axios } from "@/lib/axios";
import { useAuthStore } from "@/store/userAuthStore";
import { useCreateExamination } from "../hooks/useCreateExamination";
import { useUpdateExamination } from "../hooks/useUpdateExamination";
import { examinationSchema, formatClassLabel } from "../types";
import type { Examination, ExaminationFormValues } from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassItem {
  _id: string;
  grade: string;
  section: string;
  isActive: boolean;
  isDeleted: boolean;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ExaminationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  examination?: Examination;
  onSuccess?: (examination: Examination) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ExaminationFormDialog
 *
 * Create mode: name field + class selector with "Select All" toggle.
 * Edit mode: name field only (classes are managed on the detail page).
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4
 */
export function ExaminationFormDialog({
  open,
  onOpenChange,
  mode,
  examination,
  onSuccess,
}: ExaminationFormDialogProps) {
  const user = useAuthStore((s) => s.user);

  // Resolve institution id from the logged-in user
  const institutionId =
    typeof user?.institutionId === "object"
      ? (user?.institutionId as { _id: string })?._id ?? ""
      : user?.institutionId ?? "";

  // ── Class selection state (create mode only) ───────────────────────────────
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  // ── Fetch classes (create mode only) ──────────────────────────────────────
  const { data: classesData = [], isLoading: classesLoading } = useQuery<ClassItem[]>({
    queryKey: ["classes-list", institutionId],
    queryFn: async () => {
      const res = await _axios.get("/admin/classes", {
        params: { institutionId, limit: 200 },
      });
      return res.data?.data ?? [];
    },
    enabled: open && mode === "create" && !!institutionId,
    staleTime: 5 * 60 * 1000,
  });

  const classList = classesData
    .filter((c) => c.isActive && !c.isDeleted)
    .sort((a, b) => {
      const ga = Number(a.grade) || 0;
      const gb = Number(b.grade) || 0;
      if (ga !== gb) return ga - gb;
      return a.section.localeCompare(b.section);
    });

  const allSelected = classList.length > 0 && selectedClassIds.length === classList.length;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedClassIds([]);
    } else {
      setSelectedClassIds(classList.map((c) => c._id));
    }
  };

  const handleToggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  // ── Form setup ─────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ExaminationFormValues>({
    resolver: zodResolver(examinationSchema),
    defaultValues: { name: "" },
  });

  // ── Reset when dialog opens ────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      reset({ name: mode === "edit" && examination ? examination.name : "" });
      if (mode === "create") setSelectedClassIds([]);
    }
  }, [open, mode, examination, reset]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useCreateExamination();
  const updateMutation = useUpdateExamination();

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = async (values: ExaminationFormValues) => {
    try {
      if (mode === "create") {
        const newExamination = await createMutation.mutateAsync({
          name: values.name,
          selectedClassIds,
        });
        onSuccess?.(newExamination);
        onOpenChange(false);
      } else if (mode === "edit" && examination) {
        await updateMutation.mutateAsync({ id: examination.id, name: values.name });
        onOpenChange(false);
      }
    } catch (err: any) {
      // Surface duplicate name error inline on the name field
      const msg = err?.message ?? "";
      if (msg.toLowerCase().includes("already exists")) {
        setError("name", { message: msg });
      }
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl p-0 max-h-[90vh] flex flex-col">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="bg-[var(--neo-bg)] border-b border-white/30 px-6 pt-6 pb-4 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-semibold leading-tight">
                {mode === "create" ? "New Assessment" : "Edit Assessment"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                {mode === "create"
                  ? "Enter a name and select the classes to include."
                  : "Update the examination name."}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* ── Name field ──────────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label htmlFor="examination-name" className="text-sm font-medium">
                Examination Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="examination-name"
                placeholder="e.g. Mid-Term Examination"
                className="neo-input"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* ── Class selector (create mode only) ───────────────────────── */}
            {mode === "create" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Select Classes
                    {selectedClassIds.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-indigo-600">
                        ({selectedClassIds.length} selected)
                      </span>
                    )}
                  </Label>

                  {/* Select All toggle */}
                  {classList.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      {allSelected ? (
                        <CheckSquare className="h-3.5 w-3.5" />
                      ) : (
                        <Square className="h-3.5 w-3.5" />
                      )}
                      {allSelected ? "Deselect All" : "Select All"}
                    </button>
                  )}
                </div>

                {classesLoading ? (
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-8 w-24 rounded-full" />
                    ))}
                  </div>
                ) : classList.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No classes available for your institution.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto py-1">
                    {classList.map((cls) => {
                      const isSelected = selectedClassIds.includes(cls._id);
                      const label = formatClassLabel(cls.grade, cls.section);
                      return (
                        <button
                          key={cls._id}
                          type="button"
                          onClick={() => handleToggleClass(cls._id)}
                          aria-pressed={isSelected}
                          className={[
                            "rounded-full px-3 py-1.5 text-sm font-medium transition-all border",
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200"
                              : "bg-transparent text-foreground border-border hover:border-indigo-400 hover:text-indigo-600",
                          ].join(" ")}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  You can also add or change classes later from the examination page.
                </p>
              </div>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────────────── */}
          <div className="shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 py-4 border-t border-white/20">
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
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Create Assessment" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
