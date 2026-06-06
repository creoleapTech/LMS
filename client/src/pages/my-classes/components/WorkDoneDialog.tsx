import { useState, useEffect, useMemo } from "react";
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
import { CheckCircle2, Loader2, Tag, Clock, Timer } from "lucide-react";
import { useTimetableMutations } from "../hooks/useTimetableMutations";
import { useClassSessions } from "../hooks/useClassSessions";
import { useAuthStore } from "@/store/userAuthStore";
import type { ITimetableEntry, IPeriodSlot } from "@/types/timetable";

interface WorkDoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: ITimetableEntry;
  date?: string;
  period?: IPeriodSlot;
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

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function getPeriodDurationMinutes(period: IPeriodSlot): number {
  return parseTimeToMinutes(period.endTime) - parseTimeToMinutes(period.startTime);
}

export function WorkDoneDialog({ open, onOpenChange, entry, date, period }: WorkDoneDialogProps) {
  const user = useAuthStore((s) => s.user);
  const staffId = user?._id;
  const { completeEntry } = useTimetableMutations();
  const [topicsInput, setTopicsInput] = useState("");
  const [notes, setNotes] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number | "">("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const isCompleted = entry?.status === "completed";

  // Fetch existing class session for this entry + date
  const { data: daySessions } = useClassSessions(
    isCompleted && entry && date ? staffId : null,
    date || null
  );

  const matchedSession = useMemo(() => {
    if (!daySessions || !entry) return null;
    // Match by classId (string comparison)
    const entryClassId = typeof entry.classId === "object" ? entry.classId?._id : entry.classId;
    return (
      daySessions.find((s) => {
        const sessionClassId = typeof s.classId === "object" ? s.classId?._id : s.classId;
        return sessionClassId === entryClassId;
      }) || null
    );
  }, [daySessions, entry]);

  useEffect(() => {
    if (open && entry) {
      if (matchedSession) {
        setTopicsInput(matchedSession.topicsCovered?.join(", ") || "");
        setNotes(matchedSession.remarks || entry.notes || "");
        setDurationMinutes(matchedSession.durationMinutes ?? "");
        const sStart = matchedSession.startTime
          ? new Date(matchedSession.startTime).toTimeString().slice(0, 5)
          : period?.startTime || "";
        const sEnd = matchedSession.endTime
          ? new Date(matchedSession.endTime).toTimeString().slice(0, 5)
          : period?.endTime || "";
        setStartTime(sStart);
        setEndTime(sEnd);
      } else {
        setTopicsInput(entry.topicsCovered?.join(", ") || "");
        setNotes(entry.notes || "");
        if (period) {
          setDurationMinutes(getPeriodDurationMinutes(period));
          setStartTime(period.startTime);
          setEndTime(period.endTime);
        } else {
          setDurationMinutes("");
          setStartTime("");
          setEndTime("");
        }
      }
    }
  }, [open, entry, period, matchedSession]);

  const handleSubmit = () => {
    if (!entry) return;

    const topics = topicsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      topicsCovered: topics.length > 0 ? topics : undefined,
      notes: notes || undefined,
      date,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      durationMinutes: typeof durationMinutes === "number" ? durationMinutes : undefined,
    };

    completeEntry.mutate(
      { id: entry._id, data: payload },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const dialogTitle = isCompleted ? "Edit Work Done" : "Mark as Completed";
  const submitLabel = completeEntry.isPending
    ? "Saving..."
    : isCompleted
    ? "Save Changes"
    : "Mark Completed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl p-0">
        <div className="sticky top-0 z-10 bg-white border-b px-6 pt-6 pb-4 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl text-white">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">{dialogTitle}</DialogTitle>
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
              Additional Notes / Remarks
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did the class go?"
              className="rounded-xl resize-none"
              rows={3}
            />
          </div>

          {/* Session timing */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Clock size={12} />
                Start
              </Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Clock size={12} />
                End
              </Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Timer size={12} />
                Duration (min)
              </Label>
              <Input
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(e) =>
                  setDurationMinutes(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="rounded-xl"
              />
            </div>
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
                submitLabel
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
