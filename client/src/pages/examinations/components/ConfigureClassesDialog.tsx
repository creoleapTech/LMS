import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Settings2, ChevronDown, ChevronRight, Check } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { _axios } from "@/lib/axios";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassItem {
  _id: string;
  grade: string;
  section: string;
  isActive: boolean;
  isDeleted: boolean;
}

interface GradeGroup {
  grade: string;
  gradeNum: number;
  classes: ClassItem[];
}

interface ConfigureClassesDialogProps {
  selectedClassIds: string[];
  onApply: (ids: string[]) => void;
  institutionId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ConfigureClassesDialog
 *
 * A "Configure Classes" button that opens a dialog.
 * Classes are grouped by grade. Clicking a grade header toggles all its
 * sections. Clicking a section chip toggles just that section.
 * A single "Apply" button saves the whole selection at once (bulk update).
 */
export function ConfigureClassesDialog({
  selectedClassIds,
  onApply,
  institutionId,
}: ConfigureClassesDialogProps) {
  const [open, setOpen] = useState(false);
  // Local draft selection — only committed on Apply
  const [draft, setDraft] = useState<string[]>([]);
  // Which grade groups are expanded
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set());

  // ── Fetch classes ──────────────────────────────────────────────────────────
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

  const classList = classesData
    .filter((c) => c.isActive && !c.isDeleted)
    .sort((a, b) => {
      const ga = Number(a.grade) || 0;
      const gb = Number(b.grade) || 0;
      if (ga !== gb) return ga - gb;
      return a.section.localeCompare(b.section);
    });

  // Group by grade
  const gradeGroups: GradeGroup[] = [];
  for (const cls of classList) {
    const existing = gradeGroups.find((g) => g.grade === cls.grade);
    if (existing) {
      existing.classes.push(cls);
    } else {
      gradeGroups.push({
        grade: cls.grade,
        gradeNum: Number(cls.grade) || 0,
        classes: [cls],
      });
    }
  }

  // ── Sync draft when dialog opens ──────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setDraft([...selectedClassIds]);
      // Auto-expand grades that have at least one selected section
      const expanded = new Set<string>();
      for (const group of gradeGroups) {
        if (group.classes.some((c) => selectedClassIds.includes(c._id))) {
          expanded.add(group.grade);
        }
      }
      setExpandedGrades(expanded);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Grade toggle (select/deselect all sections in a grade) ────────────────
  const handleGradeToggle = (group: GradeGroup) => {
    const gradeIds = group.classes.map((c) => c._id);
    const allSelected = gradeIds.every((id) => draft.includes(id));
    if (allSelected) {
      setDraft((prev) => prev.filter((id) => !gradeIds.includes(id)));
    } else {
      setDraft((prev) => [...new Set([...prev, ...gradeIds])]);
    }
  };

  // ── Section toggle ────────────────────────────────────────────────────────
  const handleSectionToggle = (classId: string) => {
    setDraft((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  // ── Grade expand/collapse ─────────────────────────────────────────────────
  const toggleExpand = (grade: string) => {
    setExpandedGrades((prev) => {
      const next = new Set(prev);
      if (next.has(grade)) next.delete(grade);
      else next.add(grade);
      return next;
    });
  };

  // ── Apply ─────────────────────────────────────────────────────────────────
  const handleApply = () => {
    onApply(draft);
    setOpen(false);
  };

  // ── Summary label for the button ──────────────────────────────────────────
  const selectedCount = selectedClassIds.length;
  const buttonLabel =
    selectedCount === 0
      ? "Configure Classes"
      : `${selectedCount} class${selectedCount !== 1 ? "es" : ""} selected`;

  return (
    <>
      {/* Trigger button */}
      <Button
        variant="outline"
        size="sm"
        className="rounded-xl gap-2"
        onClick={() => setOpen(true)}
      >
        <Settings2 className="h-4 w-4" />
        {buttonLabel}
      </Button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-0 max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-white/20 shrink-0">
            <DialogTitle className="text-lg font-semibold">Configure Classes</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-0.5">
              Select grades and sections to include in this examination.
            </DialogDescription>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-xl" />
                ))}
              </div>
            ) : gradeGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No classes available.
              </p>
            ) : (
              gradeGroups.map((group) => {
                const gradeIds = group.classes.map((c) => c._id);
                const selectedInGrade = gradeIds.filter((id) => draft.includes(id));
                const allSelected = selectedInGrade.length === gradeIds.length;
                const someSelected = selectedInGrade.length > 0 && !allSelected;
                const isExpanded = expandedGrades.has(group.grade);

                return (
                  <div key={group.grade} className="rounded-xl border border-border/60 overflow-hidden">
                    {/* Grade header row */}
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors">
                      {/* Expand/collapse */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(group.grade)}
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>

                      {/* Grade checkbox */}
                      <button
                        type="button"
                        onClick={() => handleGradeToggle(group)}
                        className="flex items-center gap-2.5 flex-1 text-left"
                        aria-label={`Select all sections in Grade ${group.grade}`}
                      >
                        {/* Custom checkbox */}
                        <span
                          className={[
                            "h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                            allSelected
                              ? "bg-indigo-600 border-indigo-600"
                              : someSelected
                              ? "bg-indigo-200 border-indigo-400"
                              : "border-border bg-background",
                          ].join(" ")}
                        >
                          {(allSelected || someSelected) && (
                            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                          )}
                        </span>
                        <span className="text-sm font-semibold">
                          Grade {group.grade}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {selectedInGrade.length}/{gradeIds.length} sections
                        </span>
                      </button>
                    </div>

                    {/* Sections */}
                    {isExpanded && (
                      <div className="px-4 py-3 flex flex-wrap gap-2 border-t border-border/40">
                        {group.classes.map((cls) => {
                          const isSelected = draft.includes(cls._id);
                          return (
                            <button
                              key={cls._id}
                              type="button"
                              onClick={() => handleSectionToggle(cls._id)}
                              aria-pressed={isSelected}
                              className={[
                                "rounded-full px-3 py-1 text-sm font-medium border transition-all",
                                isSelected
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "bg-transparent text-foreground border-border hover:border-indigo-400",
                              ].join(" ")}
                            >
                              Section {cls.section}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-white/20">
            <span className="text-sm text-muted-foreground">
              {draft.length} section{draft.length !== 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={handleApply}
              >
                Apply
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
