import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Trash2, BookOpen, AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAuthStore } from "@/store/userAuthStore";
import { useLessonPlan } from "./hooks/useLessonPlan";
import { useUpdateLessonPlan } from "./hooks/useUpdateLessonPlan";
import { useDeleteLessonPlan } from "./hooks/useDeleteLessonPlan";
import { LessonPlanStatusBadge } from "./components/LessonPlanStatusBadge";
import { LessonPlanFormDialog } from "./components/LessonPlanFormDialog";
import type { LessonPlan, PlanStatus } from "./types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface LessonPlanDetailPageProps {
  id: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function Section({
  title,
  content,
}: {
  title: string;
  content?: string;
}) {
  if (!content) return null;
  return (
    <div className="neo-card-flat rounded-2xl p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </p>
      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
        {content}
      </p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * LessonPlanDetailPage
 *
 * Full detail view for a single lesson plan.
 * Requirements: 4.1–4.4, 5.1, 5.4, 6.1–6.4, 7.2, 8.2–8.4
 */
export default function LessonPlanDetailPage({ id }: LessonPlanDetailPageProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdminRole = user?.role === "admin" || user?.role === "super_admin";

  const { data: plan, isLoading, isError, refetch } = useLessonPlan(id);
  const updateMutation = useUpdateLessonPlan();
  const deleteMutation = useDeleteLessonPlan();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto">
        <BackLink />
        <div className="flex justify-center py-24">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading lesson plan…
          </div>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (isError || !plan) {
    return (
      <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto">
        <BackLink />
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 py-20 text-center">
          <AlertCircle className="h-8 w-8 text-destructive/60" />
          <p className="text-sm font-medium text-destructive">
            Failed to load lesson plan.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  // ── Curriculum link ────────────────────────────────────────────────────────
  const gradeBookObj =
    typeof plan.gradeBookId === "object" && plan.gradeBookId
      ? plan.gradeBookId
      : null;
  const chapterObj =
    typeof plan.chapterId === "object" && plan.chapterId
      ? plan.chapterId
      : null;
  const gradeBookIdStr =
    typeof plan.gradeBookId === "string" ? plan.gradeBookId : gradeBookObj?.id;
  const hasCurriculumLink = !!(gradeBookObj || gradeBookIdStr);

  const handleDeleteConfirm = () => {
    deleteMutation.mutate(id, {
      onSuccess: () => navigate({ to: "/lesson-plans" }),
    });
  };

  return (
    <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto">
      <BackLink />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{plan.title}</h1>
            {/* Status: inline select for teachers, read-only badge for admins */}
            {isAdminRole ? (
              <LessonPlanStatusBadge status={plan.status} />
            ) : (
              <Select
                value={plan.status}
                onValueChange={(v) =>
                  updateMutation.mutate({ id, status: v as PlanStatus })
                }
              >
                <SelectTrigger className="h-7 w-auto gap-1.5 rounded-full border px-3 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Meta row */}
          <p className="text-sm text-muted-foreground">
            <span>{plan.subject}</span>
            <span className="mx-1.5 opacity-40">·</span>
            <span>{plan.gradeOrClass}</span>
            <span className="mx-1.5 opacity-40">·</span>
            <span>{formatDate(plan.date)}</span>
            <span className="mx-1.5 opacity-40">·</span>
            <span>{plan.durationMinutes} min</span>
          </p>
        </div>

        {/* Action buttons (teacher only) */}
        {!isAdminRole && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Plan
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* ── Content grid ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {/* Learning Objectives + Materials */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Section title="Learning Objectives" content={plan.learningObjectives} />
          <Section title="Materials Needed" content={plan.materialsNeeded} />
        </div>

        {/* Lesson Structure — three columns */}
        {(plan.introduction || plan.mainActivity || plan.conclusion) && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Lesson Structure
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {plan.introduction && (
                <div className="neo-card-flat rounded-2xl p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500 mb-2">
                    Introduction
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {plan.introduction}
                  </p>
                </div>
              )}
              {plan.mainActivity && (
                <div className="neo-card-flat rounded-2xl p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-violet-500 mb-2">
                    Main Activity
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {plan.mainActivity}
                  </p>
                </div>
              )}
              {plan.conclusion && (
                <div className="neo-card-flat rounded-2xl p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500 mb-2">
                    Conclusion
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {plan.conclusion}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Assessment + Homework */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Section title="Assessment Method" content={plan.assessmentMethod} />
          <Section title="Homework / Follow-up Notes" content={plan.homeworkNotes} />
        </div>

        {/* Curriculum Link */}
        {hasCurriculumLink && (
          <div className="neo-card-flat rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Curriculum Link
            </p>
            {gradeBookObj ? (
              <Link
                to="/curriculum"
                search={{ gradeBookId: gradeBookObj.id }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-medium hover:bg-indigo-100 transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5" />
                {gradeBookObj.bookTitle} — Grade {gradeBookObj.grade}
                {chapterObj && (
                  <span className="text-indigo-500">· {chapterObj.title}</span>
                )}
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Curriculum item unavailable
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Edit dialog ──────────────────────────────────────────────────── */}
      <LessonPlanFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        planId={id}
        initialValues={{
          title: plan.title,
          subject: plan.subject,
          gradeOrClass: plan.gradeOrClass,
          date: plan.date,
          durationMinutes: plan.durationMinutes,
          learningObjectives: plan.learningObjectives ?? "",
          materialsNeeded: plan.materialsNeeded ?? "",
          introduction: plan.introduction ?? "",
          mainActivity: plan.mainActivity ?? "",
          conclusion: plan.conclusion ?? "",
          assessmentMethod: plan.assessmentMethod ?? "",
          homeworkNotes: plan.homeworkNotes ?? "",
          gradeBookId:
            typeof plan.gradeBookId === "object" && plan.gradeBookId
              ? (plan.gradeBookId as { id: string }).id
              : (plan.gradeBookId as string) ?? "",
          chapterId:
            typeof plan.chapterId === "object" && plan.chapterId
              ? (plan.chapterId as { id: string }).id
              : (plan.chapterId as string) ?? "",
          status: plan.status,
        }}
      />

      {/* ── Delete confirmation ──────────────────────────────────────────── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lesson Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The lesson plan will be permanently
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/lesson-plans"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Lesson Plans
    </Link>
  );
}
