import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { _axios } from "@/lib/axios";

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

import { useAuthStore } from "@/store/userAuthStore";
import { useExamination } from "./hooks/useExamination";
import { useUpdateExamination } from "./hooks/useUpdateExamination";
import { useDeleteExamination } from "./hooks/useDeleteExamination";
import { useSaveColumns } from "./hooks/useSaveColumns";
import { useSaveCells } from "./hooks/useSaveCells";
import { ConfigureClassesDialog } from "./components/ConfigureClassesDialog";
import { StudentRosterGrid } from "./components/StudentRosterGrid";import { ColumnConfigSheet } from "./components/ColumnConfigSheet";
import { ExaminationFormDialog } from "./components/ExaminationFormDialog";
import { ExaminationExportButton } from "./components/ExaminationExportButton";
import type { ExaminationColumn, ExaminationDetail } from "./types";
import { columnsForGrade, studentsForGrade } from "./types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExaminationDetailPageProps {
  id: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ExaminationDetailPage
 *
 * Full spreadsheet editor for a single examination.
 *
 * Each grade owns an independent column set (all sections of one grade share
 * the same columns/formulas). Only one grade is shown at a time via grade
 * tabs — the roster grid, column configuration, and export all operate on the
 * active grade.
 *
 * Requirements: 4.1, 4.4, 5.1, 5.6, 5.7, 9.1, 9.2, 10.1, 10.2, 10.3,
 *               11.1, 11.2, 11.3, 11.4, 12.1, 12.2, 12.3, 12.4,
 *               14.1, 14.2, 14.3, 14.4, 15.1, 15.2, 15.3, 15.4, 16.1
 */
export default function ExaminationDetailPage({ id }: ExaminationDetailPageProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  // ── Role flags ─────────────────────────────────────────────────────────────
  // Cast to string to support "student" role which may not be in the User type yet
  const userRole = user?.role as string | undefined;
  const isReadOnly = userRole === "student";
  const isAdminOrSuperAdmin =
    userRole === "admin" || userRole === "super_admin";

  // ── Server data ────────────────────────────────────────────────────────────
  const { data: examination, isLoading, isError, refetch } = useExamination(id);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateMutation = useUpdateExamination();
  const deleteMutation = useDeleteExamination();
  const saveColumnsMutation = useSaveColumns();
  const saveCellsMutation = useSaveCells();

  // ── Local state ────────────────────────────────────────────────────────────
  const [localCells, setLocalCells] = useState<Map<string, string>>(new Map());
  // All grades' columns (grade-scoped on the server)
  const [localColumns, setLocalColumns] = useState<ExaminationColumn[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  // Only one grade is visible/edited at a time
  const [activeGrade, setActiveGrade] = useState<string>("");
  const [columnSheetOpen, setColumnSheetOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<ExaminationColumn | undefined>(undefined);
  const [deleteExamOpen, setDeleteExamOpen] = useState(false);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Debounce ref ───────────────────────────────────────────────────────────
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track dirty cells for the debounced save
  const dirtyCellsRef = useRef<Map<string, string>>(new Map());

  // ── Derive institution id (needed for the classes lookup) ────────────────
  const institutionId = useMemo(() => {
    if (!examination) return "";
    return typeof examination.institutionId === "string"
      ? examination.institutionId
      : ((examination.institutionId as { _id: string })?._id ?? "");
  }, [examination]);

  // ── Classes lookup: resolves selected class IDs → grades (for grade tabs) ──
  const { data: classesData = [] } = useQuery<Array<{ _id: string; grade: string; section: string }>>({
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

  const gradeByClassId = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classesData) map.set(c._id, c.grade);
    return map;
  }, [classesData]);

  // ── Initialize local state from server data ────────────────────────────────
  useEffect(() => {
    if (!examination) return;

    // Build localCells map from examination.cells
    const cellMap = new Map<string, string>();
    for (const cell of examination.cells) {
      cellMap.set(`${cell.studentId}:${cell.columnId}`, cell.value);
    }
    // Overlay edits that haven't successfully saved yet — a background
    // refresh must never wipe what the user typed.
    for (const [k, v] of dirtyCellsRef.current) {
      cellMap.set(k, v);
    }
    setLocalCells(cellMap);
    setLocalColumns(examination.columns);
    setSelectedClassIds(examination.selectedClassIds);
  }, [examination]);

  // ── Grades in this examination (one tab per grade) ─────────────────────────
  // Union of grades from the class selection, the roster, and stored columns —
  // so tabs survive empty rosters and freshly added grades.
  const grades: string[] = useMemo(() => {
    const set = new Set<string>();
    for (const cid of selectedClassIds) {
      const g = gradeByClassId.get(cid);
      if (g) set.add(g);
    }
    if (examination) {
      for (const s of examination.students) if (s.grade) set.add(s.grade);
      for (const c of localColumns) {
        const g = (c as ExaminationColumn).grade ?? "";
        if (g) set.add(g);
      }
    }
    return [...set].sort((a, b) => (Number(a) || 0) - (Number(b) || 0));
  }, [selectedClassIds, gradeByClassId, examination, localColumns]);

  // Keep the active grade valid: default to the first grade, and fall back
  // when the active grade loses its last section.
  useEffect(() => {
    if (grades.length === 0) {
      setActiveGrade("");
      return;
    }
    if (!activeGrade || !grades.includes(activeGrade)) {
      setActiveGrade(grades[0]);
    }
  }, [grades, activeGrade]);

  // ── Active grade's slice ───────────────────────────────────────────────────
  const gradeColumns = useMemo(
    () => (activeGrade ? columnsForGrade(localColumns, activeGrade) : []),
    [localColumns, activeGrade]
  );
  const gradeStudents = useMemo(
    () => (examination && activeGrade ? studentsForGrade(examination.students, activeGrade) : []),
    [examination, activeGrade]
  );

  // ── Cell change handler with debounced save ────────────────────────────────
  const handleCellChange = useCallback(
    (studentId: string, columnId: string, value: string) => {
      const key = `${studentId}:${columnId}`;

      // Update local cells immediately
      setLocalCells((prev) => {
        const next = new Map(prev);
        next.set(key, value);
        return next;
      });

      // Track dirty cell
      dirtyCellsRef.current.set(key, value);

      // Clear previous timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Show saving indicator
      setIsSaving(true);

      // Schedule save after 500ms
      saveTimeoutRef.current = setTimeout(() => {
        const dirtyCells = Array.from(dirtyCellsRef.current.entries()).map(
          ([k, v]) => {
            const [sId, cId] = k.split(":");
            return { studentId: sId, columnId: cId, value: v };
          }
        );

        saveCellsMutation.mutate(
          { id, cells: dirtyCells },
          {
            // Only forget cells the server actually stored. Failed edits
            // stay dirty: they survive refreshes (see overlay above) and
            // ride along with the next save as an automatic retry.
            onSuccess: (saved) => {
              setIsSaving(false);
              const savedKeys = new Set(
                (saved ?? []).map((c: { studentId: string; columnId: string }) => `${c.studentId}:${c.columnId}`)
              );
              for (const key of [...dirtyCellsRef.current.keys()]) {
                if (savedKeys.has(key)) dirtyCellsRef.current.delete(key);
              }
            },
            onError: () => {
              setIsSaving(false);
            },
          }
        );
      }, 500);
    },
    [id, saveCellsMutation]
  );

  // ── Column operations ──────────────────────────────────────────────────────

  const handleAddColumn = useCallback(() => {
    if (!activeGrade) return;
    setEditingColumn(undefined);
    setColumnSheetOpen(true);
  }, [activeGrade]);

  const handleEditColumn = useCallback((column: ExaminationColumn) => {
    setEditingColumn(column);
    setColumnSheetOpen(true);
  }, []);

  // Persist helper: replaces the active grade's columns locally + on server.
  // Other grades' columns are untouched.
  const persistGradeColumns = useCallback(
    (nextGradeColumns: ExaminationColumn[]) => {
      const normalized = nextGradeColumns.map((col, idx) => ({
        ...col,
        grade: activeGrade,
        order: idx,
      }));
      setLocalColumns((prev) => [
        ...prev.filter((col) => (col.grade ?? "") !== activeGrade),
        ...normalized,
      ]);
      saveColumnsMutation.mutate({ id, grade: activeGrade, columns: normalized });
    },
    [activeGrade, id, saveColumnsMutation]
  );

  const handleColumnSave = useCallback(
    (columnData: Omit<ExaminationColumn, "id" | "order" | "grade">) => {
      // Name uniqueness is enforced within the active grade only
      const nameLower = columnData.name.trim().toLowerCase();
      const isDuplicate = gradeColumns.some(
        (col) =>
          col.name.toLowerCase() === nameLower &&
          (!editingColumn || col.id !== editingColumn.id)
      );
      if (isDuplicate) return;

      let nextGradeColumns: ExaminationColumn[];

      if (editingColumn) {
        // Edit existing column (stays in the active grade)
        nextGradeColumns = gradeColumns.map((col) =>
          col.id === editingColumn.id
            ? { ...col, ...columnData, name: columnData.name.trim(), grade: activeGrade }
            : col
        );
      } else {
        // Add new column to the active grade
        const newColumn: ExaminationColumn = {
          ...columnData,
          name: columnData.name.trim(),
          id: crypto.randomUUID(),
          grade: activeGrade,
          order: gradeColumns.length,
        };
        nextGradeColumns = [...gradeColumns, newColumn];
      }

      persistGradeColumns(nextGradeColumns);
    },
    [editingColumn, gradeColumns, activeGrade, persistGradeColumns]
  );

  const handleDeleteColumn = useCallback(
    (columnId: string) => {
      persistGradeColumns(gradeColumns.filter((col) => col.id !== columnId));
    },
    [gradeColumns, persistGradeColumns]
  );

  const handleReorderColumn = useCallback(
    (columnId: string, direction: "left" | "right") => {
      const sorted = [...gradeColumns].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((col) => col.id === columnId);
      if (index === -1) return;

      const swapIndex = direction === "left" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= sorted.length) return;

      // Swap positions, then renormalize order 0..n
      const reordered = [...sorted];
      [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
      persistGradeColumns(reordered);
    },
    [gradeColumns, persistGradeColumns]
  );

  // ── Delete examination ─────────────────────────────────────────────────────
  const handleDeleteConfirm = useCallback(() => {
    deleteMutation.mutate(id, {
      onSuccess: () => navigate({ to: "/examinations" }),
    });
  }, [id, deleteMutation, navigate]);

  // ── Per-grade counts for the grade tabs ────────────────────────────────────
  const studentCountByGrade = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of examination?.students ?? []) {
      map.set(s.grade, (map.get(s.grade) ?? 0) + 1);
    }
    return map;
  }, [examination?.students]);

  const columnCountByGrade = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of localColumns) {
      const g = c.grade ?? "";
      if (!g) continue;
      map.set(g, (map.get(g) ?? 0) + 1);
    }
    return map;
  }, [localColumns]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto">
        <BackLink />
        <div className="flex justify-center py-24">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading examination…
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (isError || !examination) {
    return (
      <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto">
        <BackLink />
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 py-20 text-center">
          <AlertCircle className="h-8 w-8 text-destructive/60" />
          <p className="text-sm font-medium text-destructive">
            Failed to load examination.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  // ── Build examination slice for the active grade ───────────────────────────
  // The grid, column sheet, and export all operate on one grade at a time.
  // (Plain const — safe after the early returns above.)
  const examinationWithLocalState: ExaminationDetail = {
    ...examination,
    columns: gradeColumns,
    students: gradeStudents,
    selectedClassIds,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto">
      {/* Back link */}
      <BackLink />

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {examination.name}
          </h1>
          {isSaving && (
            <span className="text-xs text-muted-foreground">Saving…</span>
          )}
        </div>

        <div className="flex gap-2">
          {/* Edit name button */}
          {!isReadOnly && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5"
              onClick={() => setEditNameOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Name
            </Button>
          )}

          {/* Export button — exports the active grade only */}
          <ExaminationExportButton
            examination={examinationWithLocalState}
            fileSuffix={activeGrade ? `-Grade-${activeGrade}` : ""}
          />

          {/* Delete button — admin/super_admin only */}
          {isAdminOrSuperAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
              onClick={() => setDeleteExamOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Class selector — hidden for students */}
      {!isReadOnly && (
        <div className="neo-card rounded-2xl p-5 mb-6">
          <ConfigureClassesDialog
            selectedClassIds={selectedClassIds}
            onApply={(ids) => {
              setSelectedClassIds(ids);
              updateMutation.mutate({ id, selectedClassIds: ids });
            }}
            institutionId={institutionId}
            columns={localColumns}
          />
        </div>
      )}

      {/* Grade tabs — one grade visible at a time, each with own columns */}
      {grades.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4" role="tablist" aria-label="Grades">
          {grades.map((grade) => {
            const isActive = grade === activeGrade;
            const sc = studentCountByGrade.get(grade) ?? 0;
            const cc = columnCountByGrade.get(grade) ?? 0;
            return (
              <button
                key={grade}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveGrade(grade)}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold border transition-all",
                  isActive
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200"
                    : "bg-transparent text-foreground border-border hover:border-indigo-400 hover:text-indigo-600",
                ].join(" ")}
              >
                Grade {grade}
                <span className={`ml-2 text-xs font-normal ${isActive ? "text-indigo-100" : "text-muted-foreground"}`}>
                  {sc} student{sc !== 1 ? "s" : ""} • {cc} column{cc !== 1 ? "s" : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Roster grid */}
      <div className="neo-card rounded-2xl p-5">
        {grades.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {isReadOnly
              ? "No classes have been assigned to this assessment yet."
              : "Select classes above to populate the student roster — each grade gets its own columns."}
          </p>
        ) : (
          <>
            {!isReadOnly && (
              <p className="text-xs text-muted-foreground mb-3">
                Showing Grade {activeGrade} — columns and formulas below apply only to this grade.
                Sections {gradeStudents.length > 0 ? [...new Set(gradeStudents.map((s) => s.section))].join(", ") : "—"} share
                this grade&apos;s columns.
              </p>
            )}
            <StudentRosterGrid
              examination={examinationWithLocalState}
              isReadOnly={isReadOnly}
              onCellChange={handleCellChange}
              onAddColumn={handleAddColumn}
              onEditColumn={handleEditColumn}
              onDeleteColumn={handleDeleteColumn}
              onReorderColumn={handleReorderColumn}
              localCells={localCells}
            />
          </>
        )}
      </div>

      {/* Column config sheet (active grade's columns only) */}
      <ColumnConfigSheet
        open={columnSheetOpen}
        onOpenChange={(open) => {
          setColumnSheetOpen(open);
          if (!open) setEditingColumn(undefined);
        }}
        existingColumns={gradeColumns}
        onSave={handleColumnSave}
        editingColumn={editingColumn}
      />

      {/* Edit name dialog */}
      <ExaminationFormDialog
        open={editNameOpen}
        onOpenChange={setEditNameOpen}
        mode="edit"
        examination={examination}
      />

      {/* Delete examination confirmation */}
      <AlertDialog open={deleteExamOpen} onOpenChange={setDeleteExamOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Examination?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The examination and all its data
              will be permanently removed.
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

// ─── BackLink ─────────────────────────────────────────────────────────────────

function BackLink() {
  return (
    <Link
      to="/examinations"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Examinations
    </Link>
  );
}
