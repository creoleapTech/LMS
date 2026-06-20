import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { getAuthToken } from "@/lib/auth-token";
import { useAuthStore } from "@/store/userAuthStore";
import type { DiarySession } from "./hooks/useTeachingDiary";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Clock,
  Timer,
  GraduationCap,
  ListTodo,
  CalendarDays,
  Loader2,
  AlertCircle,
  Play,
  Tag,
  RefreshCw,
  Pencil,
} from "lucide-react";

const HEARTBEAT_INTERVAL = 30000;
// Must stay in sync with the server-side STALE_SESSION_MINUTES in
// server-cf/src/modules/staff/class-session-controller.ts
const STALE_THRESHOLD_MINUTES = 5;

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateStr === today.toISOString().split("T")[0]) return "Today";
  if (dateStr === yesterday.toISOString().split("T")[0]) return "Yesterday";

  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getClassLabel(classId: DiarySession["classId"]): string {
  if (typeof classId === "object" && classId) {
    return `Grade ${classId.grade || "?"} - Section ${classId.section || "?"}`;
  }
  return "Unknown Class";
}

function getClassIdString(classId: DiarySession["classId"]): string {
  if (typeof classId === "object" && classId) return classId._id;
  return classId || "";
}

function getElapsed(startTime: string): string {
  const diff = Date.now() - new Date(startTime).getTime();
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Editable Session Dialog ────────────────────────

function EditSessionDialog({
  session,
  open,
  onOpenChange,
  onSaved,
}: {
  session: DiarySession;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [topicsInput, setTopicsInput] = useState("");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (open) {
      setTopicsInput((session.topicsCovered || []).join(", "));
      setRemarks(session.remarks || "");
    }
  }, [open, session]);

  const handleSave = async () => {
    const topics = topicsInput.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      await _axios.patch(`/admin/class-session/${session.id}`, {
        topicsCovered: topics,
        remarks: remarks || undefined,
      });
      onSaved();
      onOpenChange(false);
    } catch {
      // silent
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-0">
        <div className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Edit Session
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {session.startTime && formatTime(session.startTime)}
            {session.endTime && <> – {formatTime(session.endTime)}</>}
          </DialogDescription>
        </div>
        <div className="px-6 pb-6 pt-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Tag size={12} />
              Topics Covered
            </Label>
            <Input
              value={topicsInput}
              onChange={(e) => setTopicsInput(e.target.value)}
              placeholder="e.g. Algebra basics, Linear equations"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Notes / Remarks
            </Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="How did the class go?"
              className="rounded-xl resize-none"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleSave} className="rounded-xl bg-indigo-600 hover:bg-indigo-700">
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────────────

export default function TeachingDiaryPage() {
  const user = useAuthStore((s) => s.user);
  const staffId = user?._id;
  const queryClient = useQueryClient();

  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [editingSession, setEditingSession] = useState<DiarySession | null>(null);

  // ── Fetch classes ──
  const { data: classes = [] } = useQuery<{ _id: string; grade: string; section: string }[]>({
    queryKey: ["my-classes-list", staffId],
    queryFn: async () => {
      const res = await _axios.get("/admin/timetable/my-classes-list");
      return res.data?.data || [];
    },
    enabled: !!staffId,
    staleTime: 5 * 60 * 1000,
  });

  // ── Fetch sessions (last 30 days) ──
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 30);
  const toDateStr = today.toISOString().split("T")[0];
  const fromDateStr = fromDate.toISOString().split("T")[0];

  const {
    data: sessions = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<DiarySession[]>({
    queryKey: ["teaching-diary", staffId, fromDateStr, toDateStr],
    queryFn: async () => {
      const { data: res } = await _axios.get<{
        success: boolean;
        data: DiarySession[];
      }>("/admin/class-session/diary", {
        params: { staffId, fromDate: fromDateStr, toDate: toDateStr },
      });
      return res.data || [];
    },
    enabled: !!staffId,
    staleTime: 60 * 1000,
  });

  const todaySessions = useMemo(
    () => sessions.filter((s) => s.startTime?.startsWith(toDateStr)),
    [sessions, toDateStr],
  );

  const ongoingSession = useMemo(
    () => sessions.find((s) => s.status === "ongoing"),
    [sessions],
  );

  const stoppedRef = useRef(false);
  const [elapsed, setElapsed] = useState("00:00");

  // Auto-close stale sessions silently on mount
  useEffect(() => {
    if (!ongoingSession) return;
    const age = Date.now() - new Date(ongoingSession.updatedAt).getTime();
    if (age > STALE_THRESHOLD_MINUTES * 60 * 1000) {
      stoppedRef.current = true;
      _axios.patch(`/admin/class-session/${ongoingSession.id}/end`, {
        remarks: "[auto-closed: abandoned]",
        topicsCovered: [],
      }).then(() => refetch()).catch(() => {});
    }
  }, []); // only on mount

  // Heartbeat timer
  useEffect(() => {
    if (!ongoingSession) return;
    const age = Date.now() - new Date(ongoingSession.updatedAt).getTime();
    if (age > STALE_THRESHOLD_MINUTES * 60 * 1000) return;
    stoppedRef.current = false;

    const beat = async () => {
      if (stoppedRef.current) return;
      try {
        await _axios.post(`/admin/class-session/heartbeat/${ongoingSession.id}`);
      } catch {
        // silent
      }
    };

    beat();
    const interval = setInterval(beat, HEARTBEAT_INTERVAL);
    return () => clearInterval(interval);
  }, [ongoingSession]);

  // Elapsed timer
  useEffect(() => {
    if (!ongoingSession) {
      setElapsed("00:00");
      return;
    }
    const tick = () => setElapsed(getElapsed(ongoingSession.startTime));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [ongoingSession]);

  // End session on actual tab close / refresh. Use fetch with keepalive + auth
  // header because navigator.sendBeacon cannot set the Authorization header and
  // the quiet-end endpoint is protected by admin-auth.
  useEffect(() => {
    if (!ongoingSession) return;
    const baseUrl = _axios.defaults.baseURL?.replace(/\/api$/, "") || "";
    const handleUnload = () => {
      if (stoppedRef.current) return;
      stoppedRef.current = true;
      const token = getAuthToken();
      if (!token) return;
      fetch(`${baseUrl}/admin/class-session/${ongoingSession.id}/end-quietly`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
    };
  }, [ongoingSession]);

  // ── Actions ──
  const handleStartTeaching = async (classId: string) => {
    try {
      await _axios.post("/admin/class-session/start", { classId });
      refetch();
    } catch {
      // silent
    }
  };

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["teaching-diary"] });
  }, [queryClient]);

  // ── Group & filter ──
  const grouped = useMemo(() => {
    let list = [...sessions];
    if (selectedClassId !== "all") {
      list = list.filter((s) => getClassIdString(s.classId) === selectedClassId);
    }
    const map: Record<string, DiarySession[]> = {};
    for (const s of list) {
      const day = s.startTime ? s.startTime.split("T")[0] : "unknown";
      if (!map[day]) map[day] = [];
      map[day].push(s);
    }
    return Object.entries(map).sort(
      ([a], [b]) => new Date(b).getTime() - new Date(a).getTime(),
    );
  }, [sessions, selectedClassId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-600 text-lg">Failed to load teaching diary.</p>
          <Button onClick={() => refetch()} variant="outline" className="mt-4 rounded-xl">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30">
      <div className="max-w-5xl mx-auto p-6">
        {/* ── Header ── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Teaching Diary</h1>
              <p className="text-sm text-slate-500">
                Track every class you teach — auto-logged topics, precise timing, no data loss
              </p>
            </div>
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-white rounded-2xl shadow-sm border">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-slate-400" />
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="w-56 rounded-xl">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((cls) => (
                  <SelectItem key={cls._id} value={cls._id}>
                    Grade {cls.grade} - Section {cls.section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1" />

          <Button
            onClick={() => refetch()}
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-xl text-slate-500"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        {/* ── Today's teaching bar ── */}
        {selectedClassId !== "all" && (
          <div className="mb-6 p-4 bg-white rounded-2xl border shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-indigo-500" />
                <span className="text-sm font-semibold text-slate-700">
                  {selectedClassId
                    ? `Grade ${classes.find((c) => c._id === selectedClassId)?.grade || "?"} - Section ${classes.find((c) => c._id === selectedClassId)?.section || "?"}`
                    : "Selected Class"}
                </span>
              </div>

              {ongoingSession && getClassIdString(ongoingSession.classId) === selectedClassId ? (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                  </span>
                  <span className="text-sm font-medium text-red-700 tabular-nums">
                    Teaching · {elapsed}
                  </span>
                </div>
              ) : (
                <Button
                  onClick={() => handleStartTeaching(selectedClassId)}
                  size="sm"
                  className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700"
                  disabled={!!ongoingSession}
                >
                  <Play className="h-4 w-4" />
                  Start Teaching
                </Button>
              )}
            </div>

            {/* Today's sessions for this class */}
            {todaySessions.filter((s) => getClassIdString(s.classId) === selectedClassId)
              .length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                {todaySessions
                  .filter((s) => getClassIdString(s.classId) === selectedClassId)
                  .map((s) => (
                    <div key={s.id} className="flex items-center gap-3 text-sm text-slate-600">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        {formatTime(s.startTime)}
                        {s.endTime && <> – {formatTime(s.endTime)}</>}
                      </span>
                      {s.durationMinutes !== null && s.durationMinutes !== undefined && (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Timer className="h-3 w-3" />
                          {s.durationMinutes} min
                        </span>
                      )}
                      {s.topicsCovered && s.topicsCovered.length > 0 && (
                        <span className="text-xs text-slate-400 truncate max-w-[200px]">
                          {s.topicsCovered.join(", ")}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingSession(s)}
                        className="ml-auto text-slate-400 hover:text-indigo-600 rounded-xl"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ── Ongoing session indicator (global) ── */}
        {ongoingSession && Date.now() - new Date(ongoingSession.updatedAt).getTime() < STALE_THRESHOLD_MINUTES * 60 * 1000 && selectedClassId === "all" && (
          <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">
                Teaching {getClassLabel(ongoingSession.classId)}
              </p>
              <p className="text-xs text-green-600 tabular-nums">{elapsed} elapsed</p>
            </div>
            <span className="text-xs text-green-700 font-medium">
              Auto-closes when you leave this page
            </span>
          </div>
        )}

        {/* ── Diary entries ── */}
        {grouped.length === 0 ? (
          <div className="text-center py-16">
            <CalendarDays className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-400 mb-2">
              No teaching sessions found
            </h3>
            <p className="text-slate-400">
              {selectedClassId !== "all"
                ? "Select a different class or start teaching to log sessions."
                : "Start teaching to see your sessions here."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([dateStr, daySessions]) => (
              <div key={dateStr}>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="h-4 w-4 text-indigo-500" />
                  <h2 className="text-lg font-semibold text-slate-800">
                    {formatDateLabel(dateStr)}
                  </h2>
                  <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                    {daySessions.length} session{daySessions.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="space-y-2">
                  {daySessions.map((session) => {
                    const sameClass = selectedClassId !== "all";
                    const isOngoing = session.status === "ongoing";

                    return (
                      <div
                        key={session.id}
                        className={`bg-white rounded-2xl border p-4 transition-shadow hover:shadow-md ${
                          isOngoing ? "border-green-300 ring-1 ring-green-200" : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              {!sameClass && (
                                <span className="text-sm font-semibold text-slate-800">
                                  {getClassLabel(session.classId)}
                                </span>
                              )}
                              <Badge
                                variant="secondary"
                                className={
                                  isOngoing
                                    ? "bg-amber-100 text-amber-700 border-amber-200"
                                    : "bg-green-100 text-green-700 border-green-200"
                                }
                              >
                                {isOngoing ? "Ongoing" : "Completed"}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                              {session.startTime && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {formatTime(session.startTime)}
                                  {session.endTime && <> – {formatTime(session.endTime)}</>}
                                </span>
                              )}
                              {session.durationMinutes !== undefined &&
                                session.durationMinutes !== null && (
                                  <span className="flex items-center gap-1">
                                    <Timer className="h-3.5 w-3.5" />
                                    {session.durationMinutes} min
                                  </span>
                                )}
                              {isOngoing && (
                                <span className="text-xs text-amber-600 font-medium tabular-nums">
                                  {getElapsed(session.startTime)} elapsed
                                </span>
                              )}
                            </div>

                            {(session.topicsCovered && session.topicsCovered.length > 0) || (session.remarks) ? (
                              <div className="mt-2 space-y-1">
                                {session.topicsCovered && session.topicsCovered.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <ListTodo className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    {session.topicsCovered.map((topic, i) => (
                                      <Badge
                                        key={i}
                                        variant="outline"
                                        className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200 rounded-full"
                                      >
                                        {topic}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                                {session.remarks && (
                                  <p className="text-xs text-slate-400 italic ml-1">
                                    {session.remarks}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-300 italic mt-1">
                                No topics logged yet
                              </p>
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingSession(session)}
                            className="shrink-0 text-slate-400 hover:text-indigo-600 rounded-xl"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Edit dialog ── */}
        {editingSession && (
          <EditSessionDialog
            session={editingSession}
            open={!!editingSession}
            onOpenChange={() => setEditingSession(null)}
            onSaved={invalidate}
          />
        )}
      </div>
    </div>
  );
}
