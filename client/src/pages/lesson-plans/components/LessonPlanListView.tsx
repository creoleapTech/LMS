import { BookPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LessonPlanCard } from "./LessonPlanCard";
import { groupByMonth, groupByWeek } from "../types";
import type { LessonPlan, PlanStatus } from "../types";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LessonPlanListViewProps {
  plans: LessonPlan[];
  viewMode: "month" | "week";
  readOnly?: boolean;
  onPlanClick: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: PlanStatus) => void;
}

// ─── Empty state ──────────────────────────────────────────────────────────────

/**
 * LessonPlanEmptyState
 *
 * Shown when there are no lesson plans for the selected period.
 * Provides a CTA to create the first plan.
 *
 * Requirements: 2.5
 */
function LessonPlanEmptyState({
  onNewPlan,
}: {
  onNewPlan?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-muted/30 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <BookPlus className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">No lesson plans yet</p>
        <p className="text-xs text-muted-foreground">
          Create your first lesson plan to get started.
        </p>
      </div>
      {onNewPlan && (
        <Button
          size="sm"
          onClick={onNewPlan}
          className="mt-1 rounded-xl bg-brand-color hover:bg-brand-color/90 shadow-md shadow-indigo-500/20"
        >
          <BookPlus className="mr-2 h-4 w-4" />
          New Lesson Plan
        </Button>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * LessonPlanListView
 *
 * Renders lesson plans grouped by month or week depending on `viewMode`.
 * Each group has a section heading followed by a list of LessonPlanCard
 * components. When `plans` is empty, renders LessonPlanEmptyState.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
export function LessonPlanListView({
  plans,
  viewMode,
  readOnly = false,
  onPlanClick,
  onEdit,
  onDelete,
  onStatusChange,
}: LessonPlanListViewProps) {
  // ── Empty state ────────────────────────────────────────────────────────────
  if (plans.length === 0) {
    return <LessonPlanEmptyState />;
  }

  // ── Group plans ────────────────────────────────────────────────────────────
  const groups =
    viewMode === "month" ? groupByMonth(plans) : groupByWeek(plans);

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`group-heading-${group.key}`}>
          {/* Section heading */}
          <h2
            id={`group-heading-${group.key}`}
            className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
          >
            {group.label}
          </h2>

          {/* Plan cards */}
          <div className="flex flex-col gap-3">
            {group.plans.map((plan) => (
              <div
                key={plan.id}
                onClick={() => onPlanClick(plan.id)}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onPlanClick(plan.id);
                  }
                }}
                aria-label={`View lesson plan: ${plan.title}`}
              >
                <LessonPlanCard
                  plan={plan}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onStatusChange={onStatusChange}
                  readOnly={readOnly}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
