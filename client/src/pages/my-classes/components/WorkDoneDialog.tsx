import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Loader2, Tag, Clock, Timer, BookOpen, GraduationCap } from "lucide-react";
import { useTimetableMutations } from "../hooks/useTimetableMutations";
import { useClassSessions } from "../hooks/useClassSessions";
import { useAuthStore } from "@/store/userAuthStore";
import { _axios } from "@/lib/axios";
import type { ITimetableEntry, IPeriodSlot, ChapterTopicItem } from "@/types/timetable";

interface WorkDoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: ITimetableEntry;
  date?: string;
  period?: IPeriodSlot;
}

interface Chapter {
  _id: string;
  id: string;
  title: string;
  chapterNumber: number;
}

interface ContentItem {
  _id: string;
  id: string;
  title: string;
  chapterId: string;
  type: string;
}

interface GradeBookFull {
  chapters: (Chapter & { contents: ContentItem[] })[];
}

function getClassLabel(classId: ITimetableEntry["classId"]): string {
  if (typeof classId === "object" && classId) {
    return `Grade ${classId.grade || ""}–${classId.section || ""}`;
  }
  return "";
}

function getClassOptionLabel(cls: { _id: string; grade?: string; section?: string }): string {
  return `${cls.grade || ""}–${cls.section || ""}`;
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
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());
  const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(new Set());
  const [additionalClassId, setAdditionalClassId] = useState("");

  const isCompleted = entry?.status === "completed";

  // Resolve gradeBookId
  const gradeBookId = entry?.gradeBookId
    ? typeof entry.gradeBookId === "object" ? entry.gradeBookId._id : entry.gradeBookId
    : null;

  // Fetch chapters + content for the grade book
  const { data: gradeBookData } = useQuery<GradeBookFull>({
    queryKey: ["gradebook-full", gradeBookId],
    queryFn: async () => {
      const { data: res } = await _axios.get<{ success: boolean; data: GradeBookFull }>(
        `/admin/curriculum-reader/gradebook/${gradeBookId}/full`
      );
      return res.data;
    },
    enabled: !!gradeBookId && open,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch teacher's classes for additional class selector
  const { data: teacherClasses = [] } = useQuery<{ _id: string; grade?: string; section?: string }[]>({
    queryKey: ["my-classes-list"],
    queryFn: async () => {
      const { data: res } = await _axios.get<{ success: boolean; data: any[] }>(
        "/admin/timetable/my-classes-list"
      );
      return res.data ?? [];
    },
    enabled: open,
    staleTime: 2 * 60 * 1000,
  });

  const chapters = useMemo(() => {
    if (!gradeBookData?.chapters) return [];
    return gradeBookData.chapters.map((ch) => ({
      _id: ch._id || ch.id,
      id: ch.id || ch._id,
      title: ch.title || "",
      chapterNumber: ch.chapterNumber || 0,
      contents: (ch.contents || []).map((c) => ({
        _id: c._id || c.id,
        id: c.id || c._id,
        title: c.title || "",
        chapterId: c.chapterId,
        type: c.type,
      })),
    }));
  }, [gradeBookData]);

  const currentClassId = entry?.classId
    ? typeof entry.classId === "object" ? entry.classId._id : entry.classId
    : null;

  // Filter out current class from additional class options
  const availableClasses = teacherClasses.filter((c) => c._id !== currentClassId);

  // Fetch existing class session for this entry + date
  const { data: daySessions } = useClassSessions(
    isCompleted && entry && date ? staffId : null,
    date || null
  );

  const matchedSession = useMemo(() => {
    if (!daySessions || !entry) return null;
    const entryClassId = typeof entry.classId === "object" ? entry.classId?._id : entry.classId;
    return (
      daySessions.find((s) => {
        const sessionClassId = typeof s.classId === "object" ? s.classId?._id : s.classId;
        return sessionClassId === entryClassId;
      }) || null
    );
  }, [daySessions, entry]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open && entry) {
      setSelectedChapterIds(new Set());
      setSelectedContentIds(new Set());
      setAdditionalClassId(
        entry.additionalClassId
          ? (typeof entry.additionalClassId === "object" ? entry.additionalClassId._id : entry.additionalClassId)
          : ""
      );

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

  const toggleChapter = (chapterId: string) => {
    setSelectedChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
        // Also remove all content items from this chapter
        setSelectedContentIds((prevContent) => {
          const content = new Set(prevContent);
          const ch = chapters.find((c) => c.id === chapterId);
          if (ch) {
            for (const ct of ch.contents) {
              content.delete(ct.id);
            }
          }
          return content;
        });
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  const toggleContent = (contentId: string) => {
    setSelectedContentIds((prev) => {
      const next = new Set(prev);
      if (next.has(contentId)) {
        next.delete(contentId);
      } else {
        next.add(contentId);
      }
      return next;
    });
  };

  const buildChapterTopics = (): ChapterTopicItem[] => {
    const items: ChapterTopicItem[] = [];

    for (const ch of chapters) {
      if (!selectedChapterIds.has(ch.id)) continue;
      const chContents = ch.contents.filter((ct) => selectedContentIds.has(ct.id));
      if (chContents.length > 0) {
        for (const ct of chContents) {
          items.push({
            chapterId: ch.id,
            chapterTitle: ch.title,
            contentId: ct.id,
            contentTitle: ct.title,
          });
        }
      } else {
        items.push({
          chapterId: ch.id,
          chapterTitle: ch.title,
        });
      }
    }

    return items;
  };

  const handleSubmit = () => {
    if (!entry) return;

    const topics = topicsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const chapterTopics = buildChapterTopics();

    const payload: Record<string, any> = {
      notes: notes || undefined,
      date,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      durationMinutes: typeof durationMinutes === "number" ? durationMinutes : undefined,
      additionalClassId: additionalClassId || undefined,
    };

    // If chapter topics are selected, use those as the primary source
    if (chapterTopics.length > 0) {
      payload.chapterTopics = chapterTopics;
    }

    // Also include free-text topics if provided
    if (topics.length > 0) {
      payload.topicsCovered = topics;
    }

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
      <DialogContent className="max-w-xl rounded-2xl p-0 max-h-[90vh] overflow-y-auto">
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

        <div className="px-6 pb-6 pt-4 space-y-5">

          {/* ── Additional Class ── */}
          {availableClasses.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <GraduationCap size={12} />
                Combined Class
              </Label>
              <Select value={additionalClassId} onValueChange={setAdditionalClassId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="None (single class)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None (single class)</SelectItem>
                  {availableClasses.map((cls) => (
                    <SelectItem key={cls._id} value={cls._id}>
                      {getClassOptionLabel(cls)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-400">
                Select if two classes were combined into this period
              </p>
            </div>
          )}

          {/* ── Chapters (from curriculum) ── */}
          {chapters.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <BookOpen size={12} />
                Chapters Covered
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {chapters.map((ch) => {
                  const active = selectedChapterIds.has(ch.id);
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => toggleChapter(ch.id)}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-all cursor-pointer ${
                        active
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {ch.title || `Chapter ${ch.chapterNumber}`}
                    </button>
                  );
                })}
              </div>

              {/* Content items for selected chapters */}
              {chapters
                .filter((ch) => selectedChapterIds.has(ch.id))
                .map((ch) => (
                  <div key={ch.id} className="ml-2 pl-3 border-l-2 border-indigo-200 space-y-1 mt-2">
                    <p className="text-[11px] font-bold text-indigo-600">{ch.title}</p>
                    {ch.contents.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {ch.contents.map((ct) => {
                          const active = selectedContentIds.has(ct.id);
                          return (
                            <button
                              key={ct.id}
                              type="button"
                              onClick={() => toggleContent(ct.id)}
                              className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition-all cursor-pointer ${
                                active
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                  : "bg-white text-slate-500 border-slate-300 hover:bg-slate-100"
                              }`}
                            >
                              {ct.title}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">No content items</p>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* ── Free-text topics ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Tag size={12} />
              Additional Topics
            </Label>
            <Input
              value={topicsInput}
              onChange={(e) => setTopicsInput(e.target.value)}
              placeholder="e.g. Algebra basics, Linear equations (comma separated)"
              className="rounded-xl"
            />
            <p className="text-[10px] text-slate-400">Optional: type extra topics not in the curriculum</p>
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
