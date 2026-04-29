"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, BookOpen } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { _axios } from "@/lib/axios";
import { useAuthStore } from "@/store/userAuthStore";
import { useCreateLessonPlan } from "../hooks/useCreateLessonPlan";
import { useUpdateLessonPlan } from "../hooks/useUpdateLessonPlan";
import { lessonPlanSchema } from "../types";
import type { LessonPlanFormValues } from "../types";
import type { IClass } from "@/types/class";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LessonPlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialValues?: Partial<LessonPlanFormValues>;
  planId?: string;
  /** Pre-selected date from the calendar (create mode). Format: YYYY-MM-DD */
  selectedDate?: string;
}

// ─── Curriculum types ─────────────────────────────────────────────────────────

interface GradeBook {
  id: string;
  bookTitle: string;
  grade: number;
}

interface Chapter {
  id: string;
  title: string;
}

interface CurriculumEntry {
  id: string;
  name: string;
  gradeBooks?: GradeBook[];
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * LessonPlanFormDialog
 *
 * Create/edit form for lesson plans. Handles:
 * - Two-column grid layout on desktop for core fields
 * - Full-width textareas for lesson structure sections
 * - Curriculum link Select populated from GET /admin/filtered-curriculum
 * - react-hook-form + Zod validation with inline field errors
 * - Confirmation AlertDialog when editing a completed plan (Req 5.4)
 * - Unsaved changes guard via beforeunload + TanStack Router blocker
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 5.2, 5.3, 5.4, 8.1, 8.2, 10.3
 */
export function LessonPlanFormDialog({
  open,
  onOpenChange,
  mode,
  initialValues,
  planId,
  selectedDate,
}: LessonPlanFormDialogProps) {
  const navigate = useNavigate();

  // ── Completed-plan confirmation state ──────────────────────────────────────
  // When editing a completed plan, show a confirmation alert before the form.
  const isCompletedEdit =
    mode === "edit" && initialValues?.status === "completed";
  const [completedConfirmed, setCompletedConfirmed] = useState(false);

  // Reset confirmation state whenever the dialog opens/closes
  useEffect(() => {
    if (!open) {
      setCompletedConfirmed(false);
    }
  }, [open]);

  // ── Form setup ─────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<LessonPlanFormValues>({
    resolver: zodResolver(lessonPlanSchema),
    defaultValues: {
      title: "",
      subject: "",
      gradeOrClass: "",
      date: "",
      durationMinutes: 45,
      learningObjectives: "",
      materialsNeeded: "",
      introduction: "",
      mainActivity: "",
      conclusion: "",
      assessmentMethod: "",
      homeworkNotes: "",
      gradeBookId: "",
      chapterId: "",
    },
  });

  // ── Populate form when editing ─────────────────────────────────────────────
  useEffect(() => {
    if (open && mode === "edit" && initialValues) {
      reset({
        title: initialValues.title ?? "",
        subject: initialValues.subject ?? "",
        gradeOrClass: initialValues.gradeOrClass ?? "",
        date: initialValues.date ?? "",
        durationMinutes: initialValues.durationMinutes ?? 45,
        learningObjectives: initialValues.learningObjectives ?? "",
        materialsNeeded: initialValues.materialsNeeded ?? "",
        introduction: initialValues.introduction ?? "",
        mainActivity: initialValues.mainActivity ?? "",
        conclusion: initialValues.conclusion ?? "",
        assessmentMethod: initialValues.assessmentMethod ?? "",
        homeworkNotes: initialValues.homeworkNotes ?? "",
        gradeBookId: initialValues.gradeBookId ?? "",
        chapterId: initialValues.chapterId ?? "",
      });
    } else if (open && mode === "create") {
      reset({
        title: "",
        subject: "",
        gradeOrClass: "",
        date: selectedDate ?? "",
        durationMinutes: 45,
        learningObjectives: "",
        materialsNeeded: "",
        introduction: "",
        mainActivity: "",
        conclusion: "",
        assessmentMethod: "",
        homeworkNotes: "",
        gradeBookId: "",
        chapterId: "",
      });
    }
  }, [open, mode, initialValues, selectedDate, reset]);

  // ── Unsaved changes guard — beforeunload only ──────────────────────────────
  // Note: we intentionally skip the TanStack Router onBeforeNavigate subscription
  // because Radix UI Select portals trigger spurious navigation events that cause
  // false "Leave site?" prompts while the user is simply picking a dropdown value.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You have unsaved changes. Leave anyway?";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── Curriculum data ────────────────────────────────────────────────────────
  // Watch the selected gradeBookId so we can fetch chapters for it
  const selectedGradeBookId = watch("gradeBookId") || "";

  // ── Classes for this institution ───────────────────────────────────────────
  const user = useAuthStore((s) => s.user);
  const institutionId =
    typeof user?.institutionId === "object"
      ? (user?.institutionId as { _id: string })?._id
      : user?.institutionId ?? "";

  const { data: classesData = [] } = useQuery<IClass[]>({
    queryKey: ["classes-list", institutionId],
    queryFn: async () => {
      const res = await _axios.get("/admin/classes", {
        params: { institutionId, limit: 200 },
      });
      return res.data?.data ?? [];
    },
    enabled: open && !!institutionId,
    staleTime: 5 * 60 * 1000,
  });

  // Only active, non-deleted classes; sorted by grade then section
  const classList = classesData
    .filter((c) => c.isActive && !c.isDeleted)
    .sort((a, b) => {
      const ga = Number(a.grade) || 0;
      const gb = Number(b.grade) || 0;
      if (ga !== gb) return ga - gb;
      return a.section.localeCompare(b.section);
    });

  const { data: curriculumData } = useQuery<CurriculumEntry[]>({
    queryKey: ["filtered-curriculum"],
    queryFn: async () => {
      const res = await _axios.get("/admin/filtered-curriculum");
      return res.data?.data ?? [];
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // All grade books accessible to this institution (already filtered by the API)
  const gradeBooks: GradeBook[] = (curriculumData ?? []).flatMap(
    (entry) => entry.gradeBooks ?? [],
  );

  // Fetch chapters for the currently selected grade book
  // Uses curriculum-reader endpoint which is accessible to all roles (teacher/admin/super_admin)
  const { data: chaptersData = [] } = useQuery<Chapter[]>({
    queryKey: ["gradebook-chapters", selectedGradeBookId],
    queryFn: async () => {
      const res = await _axios.get(
        `/admin/curriculum-reader/chapters/${selectedGradeBookId}`,
      );
      return res.data?.data ?? [];
    },
    enabled: open && !!selectedGradeBookId && selectedGradeBookId !== "__none__",
    staleTime: 5 * 60 * 1000,
  });

  const chapters: Chapter[] = chaptersData;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useCreateLessonPlan();
  const updateMutation = useUpdateLessonPlan();

  // ── Submit handler ─────────────────────────────────────────────────────────
  const onSubmit = async (values: LessonPlanFormValues) => {
    const payload = {
      title: values.title,
      subject: values.subject,
      gradeOrClass: values.gradeOrClass,
      date: values.date,
      durationMinutes: values.durationMinutes,
      learningObjectives: values.learningObjectives || undefined,
      materialsNeeded: values.materialsNeeded || undefined,
      introduction: values.introduction || undefined,
      mainActivity: values.mainActivity || undefined,
      conclusion: values.conclusion || undefined,
      assessmentMethod: values.assessmentMethod || undefined,
      homeworkNotes: values.homeworkNotes || undefined,
      gradeBookId: values.gradeBookId || null,
      chapterId: values.chapterId || null,
    };

    if (mode === "create") {
      const newPlan = await createMutation.mutateAsync(payload);
      onOpenChange(false);
      navigate({ to: "/lesson-plans/$id", params: { id: newPlan.id } });
    } else if (mode === "edit" && planId) {
      await updateMutation.mutateAsync({ id: planId, ...payload });
      onOpenChange(false);
    }
  };

  // ── Completed-plan confirmation dialog ─────────────────────────────────────
  // Show the AlertDialog first; only show the form after confirmation.
  if (isCompletedEdit && !completedConfirmed) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Completed Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This lesson plan is marked as <strong>completed</strong>. Are you
              sure you want to edit it? The plan will remain in its current
              status unless you change it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => onOpenChange(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => setCompletedConfirmed(true)}>
              Edit Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // ── Main form dialog ───────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-0">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-[var(--neo-bg)] border-b border-white/30 px-6 pt-6 pb-4 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-semibold leading-tight">
                {mode === "create" ? "New Lesson Plan" : "Edit Lesson Plan"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                {(() => {
                  const dateStr = mode === "create" ? selectedDate : initialValues?.date;
                  if (!dateStr) return mode === "create" ? "Fill in the details below." : "Update the lesson plan details below.";
                  try {
                    const [y, m, d] = dateStr.split("-").map(Number);
                    const label = new Date(y, m - 1, d).toLocaleDateString("en-GB", {
                      weekday: "long", day: "numeric", month: "long", year: "numeric",
                    });
                    return label;
                  } catch {
                    return dateStr;
                  }
                })()}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* ── Form ────────────────────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="px-6 pb-6 pt-4 space-y-6"
        >
          {/* ── Section: Core Details ──────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Core Details
            </p>

            {/* Two-column grid on desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-sm font-medium">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="e.g. Introduction to Fractions"
                  className="neo-input"
                  {...register("title")}
                />
                {errors.title && (
                  <p className="text-xs text-destructive">
                    {errors.title.message}
                  </p>
                )}
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <Label htmlFor="subject" className="text-sm font-medium">
                  Subject <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="subject"
                  placeholder="e.g. Mathematics"
                  className="neo-input"
                  {...register("subject")}
                />
                {errors.subject && (
                  <p className="text-xs text-destructive">
                    {errors.subject.message}
                  </p>
                )}
              </div>

              {/* Grade / Class */}
              <div className="space-y-1.5">
                <Label htmlFor="gradeOrClass" className="text-sm font-medium">
                  Grade / Class <span className="text-destructive">*</span>
                </Label>
                {classList.length > 0 ? (
                  <Controller
                    name="gradeOrClass"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a class" />
                        </SelectTrigger>
                        <SelectContent>
                          {classList.map((cls) => {
                            // Build a human-readable label; include year if set to
                            // disambiguate classes with the same grade+section across years
                            const base = cls.grade
                              ? `Grade ${cls.grade} - Section ${cls.section}`
                              : `Section ${cls.section}`;
                            const label = cls.year ? `${base} (${cls.year})` : base;
                            return (
                              <SelectItem key={cls._id} value={label}>
                                {label}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    )}
                  />
                ) : (
                  <Input
                    id="gradeOrClass"
                    placeholder="e.g. Grade 5 - Section A"
                    className="neo-input"
                    {...register("gradeOrClass")}
                  />
                )}
                {errors.gradeOrClass && (
                  <p className="text-xs text-destructive">
                    {errors.gradeOrClass.message}
                  </p>
                )}
              </div>

              {/* Date field removed — date is set from the calendar selection */}

              {/* Duration */}
              <div className="space-y-1.5">
                <Label htmlFor="durationMinutes" className="text-sm font-medium">
                  Duration (minutes) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="durationMinutes"
                  type="number"
                  min={1}
                  placeholder="e.g. 45"
                  className="neo-input"
                  {...register("durationMinutes", { valueAsNumber: true })}
                />
                {errors.durationMinutes && (
                  <p className="text-xs text-destructive">
                    {errors.durationMinutes.message}
                  </p>
                )}
              </div>

              {/* Learning Objectives */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="learningObjectives"
                  className="text-sm font-medium"
                >
                  Learning Objectives
                </Label>
                <Textarea
                  id="learningObjectives"
                  placeholder="What students will learn…"
                  rows={3}
                  {...register("learningObjectives")}
                />
                {errors.learningObjectives && (
                  <p className="text-xs text-destructive">
                    {errors.learningObjectives.message}
                  </p>
                )}
              </div>

              {/* Materials Needed */}
              <div className="space-y-1.5">
                <Label htmlFor="materialsNeeded" className="text-sm font-medium">
                  Materials Needed
                </Label>
                <Textarea
                  id="materialsNeeded"
                  placeholder="e.g. Fraction tiles, whiteboard…"
                  rows={3}
                  {...register("materialsNeeded")}
                />
                {errors.materialsNeeded && (
                  <p className="text-xs text-destructive">
                    {errors.materialsNeeded.message}
                  </p>
                )}
              </div>

              {/* Assessment Method */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="assessmentMethod"
                  className="text-sm font-medium"
                >
                  Assessment Method
                </Label>
                <Textarea
                  id="assessmentMethod"
                  placeholder="How you will assess understanding…"
                  rows={3}
                  {...register("assessmentMethod")}
                />
                {errors.assessmentMethod && (
                  <p className="text-xs text-destructive">
                    {errors.assessmentMethod.message}
                  </p>
                )}
              </div>

              {/* Homework / Follow-up Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="homeworkNotes" className="text-sm font-medium">
                  Homework / Follow-up Notes
                </Label>
                <Textarea
                  id="homeworkNotes"
                  placeholder="Homework or follow-up tasks…"
                  rows={3}
                  {...register("homeworkNotes")}
                />
                {errors.homeworkNotes && (
                  <p className="text-xs text-destructive">
                    {errors.homeworkNotes.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Section: Lesson Structure ──────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Lesson Structure
            </p>

            <div className="space-y-4">
              {/* Introduction */}
              <div className="space-y-1.5">
                <Label htmlFor="introduction" className="text-sm font-medium">
                  Introduction
                </Label>
                <Textarea
                  id="introduction"
                  placeholder="How you will open the lesson…"
                  rows={4}
                  {...register("introduction")}
                />
                {errors.introduction && (
                  <p className="text-xs text-destructive">
                    {errors.introduction.message}
                  </p>
                )}
              </div>

              {/* Main Activity */}
              <div className="space-y-1.5">
                <Label htmlFor="mainActivity" className="text-sm font-medium">
                  Main Activity
                </Label>
                <Textarea
                  id="mainActivity"
                  placeholder="The core teaching activity…"
                  rows={4}
                  {...register("mainActivity")}
                />
                {errors.mainActivity && (
                  <p className="text-xs text-destructive">
                    {errors.mainActivity.message}
                  </p>
                )}
              </div>

              {/* Conclusion */}
              <div className="space-y-1.5">
                <Label htmlFor="conclusion" className="text-sm font-medium">
                  Conclusion
                </Label>
                <Textarea
                  id="conclusion"
                  placeholder="How you will close the lesson…"
                  rows={4}
                  {...register("conclusion")}
                />
                {errors.conclusion && (
                  <p className="text-xs text-destructive">
                    {errors.conclusion.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Section: Curriculum Link ───────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Curriculum Link (Optional)
            </p>

            <div className="space-y-4">
              {/* Grade Book */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Grade Book</Label>
                <Controller
                  name="gradeBookId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || "__none__"}
                      onValueChange={(v) => {
                        field.onChange(v === "__none__" ? "" : v);
                        // Reset chapter when grade book changes
                        setValue("chapterId", "");
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a grade book (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {gradeBooks.map((book) => (
                          <SelectItem key={book.id} value={book.id}>
                            {book.bookTitle} — Grade {book.grade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.gradeBookId && (
                  <p className="text-xs text-destructive">
                    {errors.gradeBookId.message}
                  </p>
                )}
              </div>

              {/* Chapter — only shown when a grade book is selected */}
              {selectedGradeBookId && selectedGradeBookId !== "__none__" && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Chapter</Label>
                <Controller
                  name="chapterId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || "__none__"}
                      onValueChange={(v) =>
                        field.onChange(v === "__none__" ? "" : v)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={chapters.length === 0 ? "No chapters available" : "Select a chapter (optional)"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {chapters.map((chapter) => (
                          <SelectItem key={chapter.id} value={chapter.id}>
                            {chapter.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.chapterId && (
                  <p className="text-xs text-destructive">
                    {errors.chapterId.message}
                  </p>
                )}
              </div>
              )}
            </div>
          </div>

          {/* ── Footer: action buttons ─────────────────────────────────── */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t border-white/20">
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
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {mode === "create" ? "Create Plan" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
