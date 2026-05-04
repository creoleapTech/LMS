import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";

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
import { ClassSelectorPanel } from "./components/ClassSelectorPanel";
import { StudentRosterGrid } from "./components/StudentRosterGrid";
import { ColumnConfigSheet } from "./components/ColumnConfigSheet";
import { ExaminationFormDialog } from "./components/ExaminationFormDialog";
import { ExaminationExportButton } from "./components/ExaminationExportButton";
import type { ExaminationColumn, ExaminationDetail } from "./types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExaminationDetailPageProps {
  id: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ExaminationDetailPage
 *
 * Full spreadsheet editor for a single examination.
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
  const [localColumns, setLocalColumns] = useState<ExaminationColumn[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [columnSheetOpen, setColumnSheetOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<ExaminationColumn | undefined>(undefined);
  const [deleteExamOpen, setDeleteExamOpen] = useState(false);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Debounce ref ───────────────────────────────────────────────────────────
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track dirty cells for the debounced save
  const dirtyCellsRef = useRef<Map<string, string>>(new Map());

  // ── Initialize local state from server data ────────────────────────────────
  useEffect(() => {
    if (!examination) return;

    // Build localCells map from examination.cells
    const cellMap = new Map<string, string>();
    for (const cell of examination.cells) {
      cellMap.set(`${cell.studentId}:${cell.columnId}`, cell.value);
    }
    setLocalCells(cellMap);
    setLocalColumns(examination.columns);
    setSelectedClassIds(examination.selectedClassIds);
  }, [examination]);

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
            onSettled: () => {
              setIsSaving(false);
              dirtyCellsRef.current.clear();
            },
          }
        );
      }, 500);
    },
    [id, saveCellsMutation]
  );

  // ── Class selection change ─────────────────────────────────────────────────
  const handleClassSelectionChange = useCallback(
    (ids: string[]) => {
      setSelectedClassIds(ids);
      updateMutation.mutate({ id, selectedClassIds: ids });
    },
    [id, updateMutation]
  );

  // ── Column operations ──────────────────────────────────────────────────────

  const handleAddColumn = useCallback(() => {
    setEditingColumn(undefined);
    setColumnSheetOpen(true);
  }, []);

  const handleEditColumn = useCallback((column: ExaminationColumn) => {
    setEditingColumn(column);
    setColumnSheetOpen(true);
  }, []);

  const handleColumnSave = useCallback(
    (columnData: Omit<ExaminationColumn, "id" | "order">) => {
      let updatedColumns: ExaminationColumn[];

      if (editingColumn) {
        // Edit existing column
        updatedColumns = localColumns.map((col) =>
          col.id === editingColumn.id
            ? { ...col, ...columnData }
            : col
        );
      } else {
        // Add new column
        const newColumn: ExaminationColumn = {
          ...columnData,
          id: crypto.randomUUID(),
          order: localColumns.length,
        };
        updatedColumns = [...localColumns, newColumn];
      }

      setLocalColumns(updatedColumns);
      saveColumnsMutation.mutate({ id, columns: updatedColumns });
    },
    [editingColumn, localColumns, id, saveColumnsMutation]
  );

  const handleDeleteColumn = useCallback(
    (columnId: string) => {
      const updatedColumns = localColumns.filter((col) => col.id !== columnId);
      setLocalColumns(updatedColumns);
      saveColumnsMutation.mutate({ id, columns: updatedColumns });
    },
    [localColumns, id, saveColumnsMutation]
  );

  const handleReorderColumn = useCallback(
    (columnId: string, direction: "left" | "right") => {
      const sorted = [...localColumns].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((col) => col.id === columnId);
      if (index === -1) return;

      const swapIndex = direction === "left" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= sorted.length) return;

      // Swap order values
      const updatedColumns = localColumns.map((col) => {
        if (col.id === sorted[index].id) {
          return { ...col, order: sorted[swapIndex].order };
        }
        if (col.id === sorted[swapIndex].id) {
          return { ...col, order: sorted[index].order };
        }
        return col;
      });

      setLocalColumns(updatedColumns);
      saveColumnsMutation.mutate({ id, columns: updatedColumns });
    },
    [localColumns, id, saveColumnsMutation]
  );

  // ── Delete examination ─────────────────────────────────────────────────────
  const handleDeleteConfirm = useCallback(() => {
    deleteMutation.mutate(id, {
      onSuccess: () => navigate({ to: "/examinations" }),
    });
  }, [id, deleteMutation, navigate]);

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

  // ── Derive institution id ──────────────────────────────────────────────────
  const institutionId =
    typeof examination.institutionId === "string"
      ? examination.institutionId
      : (examination.institutionId as { _id: string })?._id ?? "";

  // ── Build examination with local state for rendering ──────────────────────
  const examinationWithLocalState: ExaminationDetail = {
    ...examination,
    columns: localColumns,
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

          {/* Export button */}
          <ExaminationExportButton examination={examinationWithLocalState} />

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
          <ClassSelectorPanel
            selectedClassIds={selectedClassIds}
            onSelectionChange={handleClassSelectionChange}
            institutionId={institutionId}
          />
        </div>
      )}

      {/* Roster grid */}
      <div className="neo-card rounded-2xl p-5">
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
      </div>

      {/* Column config sheet */}
      <ColumnConfigSheet
        open={columnSheetOpen}
        onOpenChange={(open) => {
          setColumnSheetOpen(open);
          if (!open) setEditingColumn(undefined);
        }}
        existingColumns={localColumns}
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
