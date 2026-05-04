import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Skeleton } from "@/components/ui/skeleton";
import { formatClassLabel } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClassItem {
  _id: string;
  grade: string;
  section: string;
  isActive: boolean;
  isDeleted: boolean;
}

interface ClassSelectorPanelProps {
  selectedClassIds: string[];
  onSelectionChange: (ids: string[]) => void;
  institutionId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ClassSelectorPanel
 *
 * Renders a list of toggleable chip/badge elements for selecting classes.
 * Fetches available classes from GET /admin/classes, filters to active
 * non-deleted classes, and sorts by grade (numeric) then section (alphabetic).
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
export function ClassSelectorPanel({
  selectedClassIds,
  onSelectionChange,
  institutionId,
}: ClassSelectorPanelProps) {
  const { data: classesData = [], isLoading } = useQuery<ClassItem[]>({
    queryKey: ["classes-list", institutionId],
    queryFn: async () => {
      const res = await _axios.get("/admin/classes", {
        params: { institutionId, limit: 200 },
      });
      return res.data?.data ?? [];
    },
    enabled: !!institutionId,
    staleTime: 5 * 60 * 1000,
  });

  // Filter to only active, non-deleted classes
  const classList = classesData
    .filter((c) => c.isActive && !c.isDeleted)
    .sort((a, b) => {
      const ga = Number(a.grade) || 0;
      const gb = Number(b.grade) || 0;
      if (ga !== gb) return ga - gb;
      return a.section.localeCompare(b.section);
    });

  // Toggle a class id in/out of the selection
  const handleToggle = (classId: string) => {
    if (selectedClassIds.includes(classId)) {
      onSelectionChange(selectedClassIds.filter((id) => id !== classId));
    } else {
      onSelectionChange([...selectedClassIds, classId]);
    }
  };

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Select Classes
      </p>

      {isLoading ? (
        // Loading skeleton — 3 placeholder chips
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
      ) : classList.length === 0 ? (
        // Empty state
        <p className="text-sm text-muted-foreground">No classes available.</p>
      ) : (
        // Chip list
        <div className="flex flex-wrap gap-2">
          {classList.map((cls) => {
            const isSelected = selectedClassIds.includes(cls._id);
            const label = formatClassLabel(cls.grade, cls.section);

            return (
              <button
                key={cls._id}
                type="button"
                onClick={() => handleToggle(cls._id)}
                className={[
                  "rounded-full px-3 py-1 text-sm font-medium cursor-pointer transition-colors",
                  isSelected
                    ? "bg-indigo-600 text-white border-indigo-600 border"
                    : "border border-border text-foreground hover:border-indigo-400",
                ].join(" ")}
                aria-pressed={isSelected}
                aria-label={label}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
