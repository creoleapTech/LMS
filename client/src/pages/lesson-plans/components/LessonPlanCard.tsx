import { MoreHorizontal, Pencil, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LessonPlanStatusBadge } from "./LessonPlanStatusBadge";
import type { LessonPlan, PlanStatus } from "../types";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LessonPlanCardProps {
  plan: LessonPlan;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: PlanStatus) => void;
  readOnly?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: PlanStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready" },
  { value: "completed", label: "Completed" },
];

/**
 * Formats a YYYY-MM-DD date string into a human-readable form like "12 Jun 2025".
 * Falls back to the raw string if parsing fails.
 */
function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * LessonPlanCard
 *
 * Renders a single lesson plan as a card in the list view.
 * Displays title, subject, gradeOrClass, date, duration, and status badge.
 * Includes a three-dot DropdownMenu for Edit / Change Status / Delete actions.
 * All actions are hidden when `readOnly` is true.
 *
 * Requirements: 2.6, 5.1, 6.1, 7.2
 */
export function LessonPlanCard({
  plan,
  onEdit,
  onDelete,
  onStatusChange,
  readOnly = false,
}: LessonPlanCardProps) {
  const formattedDate = formatDate(plan.date);

  return (
    <div className="neo-card neo-card-hover flex items-start justify-between gap-4 p-4">
      {/* ── Left: plan info ─────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* Title row */}
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {plan.title}
          </h3>
          <LessonPlanStatusBadge status={plan.status} size="sm" />
        </div>

        {/* Meta row: subject · grade · period · date · duration */}
        <p className="text-xs text-muted-foreground">
          <span>{plan.subject}</span>
          <span className="mx-1.5 opacity-40">·</span>
          <span>{plan.gradeOrClass}</span>
          {typeof plan.periodNumber === "number" && (
            <>
              <span className="mx-1.5 opacity-40">·</span>
              <span>Period {plan.periodNumber}</span>
            </>
          )}
          <span className="mx-1.5 opacity-40">·</span>
          <span>{formattedDate}</span>
          <span className="mx-1.5 opacity-40">·</span>
          <span>{plan.durationMinutes} min</span>
        </p>
      </div>

      {/* ── Right: three-dot menu (hidden when readOnly) ─────────────────── */}
      {!readOnly && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              aria-label="Plan actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            {/* Edit */}
            <DropdownMenuItem onClick={() => onEdit(plan.id)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>

            {/* Change Status sub-menu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <RefreshCw className="mr-2 h-4 w-4" />
                Change Status
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {STATUS_OPTIONS.map(({ value, label }) => (
                  <DropdownMenuItem
                    key={value}
                    onClick={() => onStatusChange(plan.id, value)}
                    // Visually indicate the current status
                    className={plan.status === value ? "font-semibold" : ""}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            {/* Delete */}
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(plan.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
