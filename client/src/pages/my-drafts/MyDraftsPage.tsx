import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { _axios } from "@/lib/axios";
import { toast } from "sonner";
import { Loader2, FileEdit, Trash2, Calendar, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface DraftEntry {
  id: string;
  year: number;
  month: number;
  status: string;
  updatedAt: string;
}

export default function MyDraftsPage() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<DraftEntry | null>(null);

  const fetchDrafts = () => {
    setLoading(true);
    _axios.get("/admin/timetable/my-report-drafts")
      .then((res) => {
        if (res.data?.success) {
          setDrafts(res.data.data || []);
        }
      })
      .catch(() => {
        setDrafts([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

  const handleEditDraft = (draft: DraftEntry) => {
    navigate({
      to: "/reports",
      search: { draftId: draft.id } as any,
    });
  };

  const confirmDelete = (draft: DraftEntry) => {
    setDraftToDelete(draft);
    setDeleteDialogOpen(true);
  };

  const handleDeleteDraft = async () => {
    if (!draftToDelete) return;
    setDeletingId(draftToDelete.id);
    try {
      await _axios.delete(`/admin/timetable/delete-report-draft?id=${draftToDelete.id}`);
      toast.success("Draft deleted");
      setDrafts((prev) => prev.filter((d) => d.id !== draftToDelete.id));
    } catch {
      toast.error("Failed to delete draft");
    } finally {
      setDeletingId(null);
      setDeleteDialogOpen(false);
      setDraftToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">My Drafts</h1>
          <p className="text-muted-foreground text-sm mt-1">Your saved report drafts</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">My Drafts</h1>
        <p className="text-muted-foreground text-sm mt-1">Your saved report drafts</p>
      </div>

      {drafts.length === 0 ? (
        <div className="neo-card rounded-2xl border border-slate-200/80 p-12 text-center">
          <FileEdit className="h-12 w-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 font-semibold text-lg">No drafts saved</p>
          <p className="text-muted-foreground text-sm mt-1">Go to Reports, generate a report, and click "Save Draft" to see it here.</p>
        </div>
      ) : (
        <div className="neo-card rounded-2xl border border-slate-200/80 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 px-5 py-4">
            <h2 className="text-lg font-extrabold text-white tracking-wide">My Drafts</h2>
            <p className="text-sm text-white/80">{drafts.length} draft{drafts.length !== 1 ? "s" : ""} saved</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-4 py-3 text-left font-bold text-slate-700">Month</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-700">Year</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-700">Last Updated</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => (
                  <tr key={draft.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-amber-500" />
                        {MONTH_NAMES[draft.month - 1]}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{draft.year}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {draft.updatedAt
                        ? new Date(draft.updatedAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditDraft(draft)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors"
                        >
                          <Pencil size={12} />
                          Edit
                        </button>
                        <button
                          onClick={() => confirmDelete(draft)}
                          disabled={deletingId === draft.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          {deletingId === draft.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open) { setDeleteDialogOpen(false); setDraftToDelete(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Draft</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the draft for {draftToDelete ? `${MONTH_NAMES[draftToDelete.month - 1]} ${draftToDelete.year}` : ""}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end">
            <DialogClose asChild>
              <Button variant="outline" size="sm">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleDeleteDraft}
              disabled={!!deletingId}
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deletingId ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
