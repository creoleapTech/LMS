import { BookMarked } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Props ────────────────────────────────────────────────────────────────────

interface LessonPlanEmptyStateProps {
  onNewPlan?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * LessonPlanEmptyState
 *
 * Displayed when the lesson plan list is empty. Shows a friendly message and
 * a "New Lesson Plan" CTA button.
 *
 * Requirements: 2.5
 */
export function LessonPlanEmptyState({ onNewPlan }: LessonPlanEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <BookMarked className="h-8 w-8 text-muted-foreground" />
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-foreground">
          No lesson plans yet
        </h3>
        <p className="text-sm text-muted-foreground">
          Create your first lesson plan to get started.
        </p>
      </div>

      {onNewPlan && (
        <Button onClick={onNewPlan} className="mt-2">
          New Lesson Plan
        </Button>
      )}
    </div>
  );
}
