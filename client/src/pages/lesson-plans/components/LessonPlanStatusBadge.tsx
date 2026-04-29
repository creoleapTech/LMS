import { Badge } from "@/components/ui/badge";
import type { PlanStatus } from "../types";

interface LessonPlanStatusBadgeProps {
  status: PlanStatus;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<
  PlanStatus,
  { className: string; label: string }
> = {
  draft: {
    className:
      "bg-slate-100 text-slate-600 border-slate-300",
    label: "Draft",
  },
  ready: {
    className:
      "bg-indigo-100 text-indigo-700 border-indigo-300",
    label: "Ready",
  },
  completed: {
    className:
      "bg-emerald-100 text-emerald-700 border-emerald-300",
    label: "Completed",
  },
};

export function LessonPlanStatusBadge({
  status,
  size = "md",
}: LessonPlanStatusBadgeProps) {
  const { className, label } = STATUS_CONFIG[status];

  return (
    <Badge
      variant="outline"
      className={`${className} ${size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1"}`}
    >
      {label}
    </Badge>
  );
}
