import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2, Tag } from "lucide-react";
import { useTimetableMutations } from "../hooks/useTimetableMutations";
import type { ITimetableEntry } from "@/types/timetable";

interface WorkDoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: ITimetableEntry;
}

function getClassLabel(classId: ITimetableEntry["classId"]): string {
  if (typeof classId === "object" && classId) {
    return `Grade ${classId.grade || ""}–${classId.section || ""}`;
  }
  return "";
}

function getBookLabel(gradeBookId: ITimetableEntry["gradeBookId"]): string {
  if (typeof gradeBookId === "object" && gradeBookId && gradeBookId.bookTitle) {
    return gradeBookId.bookTitle;
  }
  return "";
}

export function WorkDoneDialog({ open, onOpenChange, entry }: WorkDoneDialogProps) {
  const { completeEntry } = useTimetableMutations();
  const [topicsInput, setTopicsInput] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setTopicsInput(entry?.topicsCovered?.join(", ") || "");
      setNotes(entry?.notes || "");
    }
  }, [open, entry]);

  const handleSubmit = () => {
    if (!entry) return;

    const topics = topicsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    completeEntry.mutate(
      {
        id: entry._id,
        data: {
          topicsCovered: topics.length > 0 ? topics : undefined,
          notes: notes || undefined,
        },
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl p-0">
        <div className="sticky top-0 z-10 bg-white border-b px-6 pt-6 pb-4 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl text-white">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Mark as Completed</DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                {entry && (
                  <>
                    {getClassLabel(entry.classId)}
                    {getBookLabel(entry.gradeBookId) && ` · ${getBookLabel(entry.gradeBookId)}`}
                    {` · Period ${entry.periodNumber}`}
                  </>
                )}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 space-y-4">
          {/* Topics covered */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Tag size={12} />
              Topics Covered
            </Label>
            <Input
              value={topicsInput}
              onChange={(e) => setTopicsInput(e.target.value)}
              placeholder="e.g. Algebra basics, Linear equations (comma separated)"
              className="rounded-xl"
            />
            <p className="text-[10px] text-slate-400">Separate multiple topics with commas</p>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Additional Notes
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did the class go?"
              className="rounded-xl resize-none"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={completeEntry.isPending}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
            >
              {completeEntry.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Mark Completed"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
