import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Building2,
  Search,
  Loader2,
  Trash2,
  Plus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { _axios } from "@/lib/axios";
import { useExaminations } from "./hooks/useExaminations";
import { useDeleteExamination } from "./hooks/useDeleteExamination";
import { ExaminationFormDialog } from "./components/ExaminationFormDialog";
import type { Examination } from "./types";

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ExaminationsPage
 *
 * List page for examinations. Supports:
 * - Paginated list of examinations rendered as cards
 * - Debounced search by name
 * - Institution selector for super_admin
 * - Create / delete actions
 * - Navigation to examination detail page
 *
 * Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 13.1, 13.2, 13.3, 13.4, 14.1, 14.2, 14.3, 14.4
 */
export default function ExaminationsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";

  // ── Admin selectors (super_admin only) ────────────────────────────────────
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");

  const adminInstitutionId = isAdmin
    ? typeof user?.institutionId === "object"
      ? (user?.institutionId as { _id: string })?._id
      : user?.institutionId ?? ""
    : "";

  const effectiveInstitutionId = isSuperAdmin
    ? selectedInstitutionId
    : adminInstitutionId;

  const { data: institutions = [] } = useQuery<{ _id: string; name: string }[]>({
    queryKey: ["institutions-list"],
    queryFn: async () => {
      const res = await _axios.get("/admin/institutions");
      return res.data?.data ?? [];
    },
    enabled: isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });

  // Auto-select first institution on load
  useEffect(() => {
    if (isSuperAdmin && institutions.length > 0 && !selectedInstitutionId) {
      setSelectedInstitutionId(institutions[0]._id);
    }
  }, [isSuperAdmin, institutions, selectedInstitutionId]);

  // ── Search ────────────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const limit = 10;

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data, isLoading } = useExaminations({
    page,
    limit,
    search,
    institutionId: effectiveInstitutionId || undefined,
  });

  const examinations = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const deleteMutation = useDeleteExamination();

  const handleDeleteConfirm = () => {
    if (!deletingId) return;
    deleteMutation.mutate(deletingId, {
      onSuccess: () => setDeletingId(null),
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Examinations</h1>
        <Button
          onClick={() => setFormOpen(true)}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 gap-2"
        >
          <Plus className="h-4 w-4" />
          New Examination
        </Button>
      </div>

      {/* ── Admin selectors (super_admin only) ────────────────────────────── */}
      {isSuperAdmin && (
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
              <Building2 size={18} />
            </div>
            <Select
              value={selectedInstitutionId}
              onValueChange={(v) => {
                setSelectedInstitutionId(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-64 rounded-xl">
                <SelectValue placeholder="Select Institution" />
              </SelectTrigger>
              <SelectContent>
                {institutions.map((inst) => (
                  <SelectItem key={inst._id} value={inst._id}>
                    {inst.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* ── Search input ──────────────────────────────────────────────────── */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search examinations…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9 rounded-xl"
        />
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : examinations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-muted-foreground text-sm font-medium">
            No examinations yet. Create one to get started.
          </p>
        </div>
      ) : (
        <>
          {/* ── Examination cards ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {examinations.map((examination) => (
              <ExaminationCard
                key={examination.id}
                examination={examination}
                canDelete={isSuperAdmin || isAdmin || isTeacher}
                onDelete={(id) => setDeletingId(id)}
                onClick={(id) =>
                  navigate({ to: "/examinations/$id", params: { id } })
                }
              />
            ))}
          </div>

          {/* ── Pagination ────────────────────────────────────────────────── */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl"
              disabled={page * limit >= total}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {/* ── Create dialog ─────────────────────────────────────────────────── */}
      <ExaminationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode="create"
        onSuccess={(examination) => {
          navigate({ to: "/examinations/$id", params: { id: examination.id } });
        }}
      />

      {/* ── Delete confirmation ───────────────────────────────────────────── */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Examination?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The examination and all associated
              data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── ExaminationCard ──────────────────────────────────────────────────────────

interface ExaminationCardProps {
  examination: Examination;
  canDelete: boolean;
  onDelete: (id: string) => void;
  onClick: (id: string) => void;
}

function ExaminationCard({
  examination,
  canDelete,
  onDelete,
  onClick,
}: ExaminationCardProps) {
  const formattedDate = new Date(examination.createdAt).toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "short", year: "numeric" }
  );

  return (
    <div
      className="neo-card rounded-2xl p-5 cursor-pointer hover:border-indigo-300 transition-all group relative"
      onClick={() => onClick(examination.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(examination.id);
        }
      }}
      aria-label={`Open examination: ${examination.name}`}
    >
      {/* Delete button — always visible */}
      {canDelete && (
        <button
          type="button"
          aria-label={`Delete examination: ${examination.name}`}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(examination.id);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      {/* Examination name */}
      <h3 className="text-base font-semibold text-foreground mb-3 pr-8 leading-snug">
        {examination.name}
      </h3>

      {/* Metadata */}
      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="font-medium">Created:</span>
          <span>{formattedDate}</span>
        </div>
        {examination.createdByName && (
          <div className="flex items-center gap-1.5">
            <span className="font-medium">By:</span>
            <span className="truncate">{examination.createdByName}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="font-medium">Students:</span>
          <span>{examination.studentCount ?? 0}</span>
        </div>
      </div>
    </div>
  );
}
