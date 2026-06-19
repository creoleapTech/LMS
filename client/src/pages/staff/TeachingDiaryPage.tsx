import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { useAuthStore } from "@/store/userAuthStore";
import { useTeachingDiary, type DiarySession } from "./hooks/useTeachingDiary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Square,
} from "lucide-react";

interface ClassOption {
  _id: string;
  grade: string;
  section: string;
}

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

export default function TeachingDiaryPage() {
  const user = useAuthStore((s) => s.user);
  const staffId = user?._id;
  const { sessions, isLoading, isError, refetch } = useTeachingDiary();

  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [ongoingSessionId, setOngoingSessionId] = useState<string | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const [elapsed, setElapsed] = useState("00:00");

  const { data: classes = [] } = useQuery<ClassOption[]>({
    queryKey: ["my-classes-list", staffId],
    queryFn: async () => {
      const res = await _axios.get("/admin/timetable/my-classes-list");
      return res.data?.data || [];
    },
    enabled: !!staffId,
    staleTime: 5 * 60 * 1000,
  });

  const filteredSessions = useMemo(() => {
    let list = [...sessions];
    if (selectedClassId !== "all") {
      list = list.filter((s) => getClassIdString(s.classId) === selectedClassId);
    }
    const grouped: Record<string, DiarySession[]> = {};
    for (const s of list) {
      const day = s.startTime ? s.startTime.split("T")[0] : "unknown";
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(s);
    }
    const sorted = Object.entries(grouped).sort(
      ([a], [b]) => new Date(b).getTime() - new Date(a).getTime()
    );
    return sorted;
  }, [sessions, selectedClassId]);

  const ongoingSession = sessions.find((s) => s.status === "ongoing");
  const isTeaching = !!ongoingSession;

  useEffect(() => {
    if (!ongoingSession) {
      setOngoingSessionId(null);
      startTimeRef.current = null;
      setElapsed("00:00");
      return;
    }
    setOngoingSessionId(ongoingSession.id);
    startTimeRef.current = new Date(ongoingSession.startTime);

    const tick = () => {
      if (!startTimeRef.current) return;
      const diff = Date.now() - startTimeRef.current.getTime();
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [ongoingSession]);

  const handleStartTeaching = async () => {
    if (!selectedClassId || selectedClassId === "all") return;
    try {
      const res = await _axios.post("/admin/class-session/start", {
        classId: selectedClassId,
      });
      setOngoingSessionId(res.data?.data?.id || null);
      refetch();
    } catch {
      // Non-critical
    }
  };

  const handleStopTeaching = async () => {
    if (!ongoingSessionId) return;
    try {
      await _axios.patch(`/admin/class-session/${ongoingSessionId}/end`, {
        remarks: "",
        topicsCovered: [],
      });
      setOngoingSessionId(null);
      startTimeRef.current = null;
      setElapsed("00:00");
      refetch();
    } catch {
      // Non-critical
    }
  };

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
          <Button onClick={() => refetch()} variant="outline" className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Teaching Diary</h1>
              <p className="text-sm text-slate-500">
                Your last 30 days of teaching activity
              </p>
            </div>
          </div>
        </div>

        {/* Controls bar */}
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

          {/* Live teaching indicator / start-stop */}
          {selectedClassId !== "all" && (
            <div className="flex items-center gap-3">
              {isTeaching && ongoingSession ? (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                  </span>
                  <span className="text-sm font-medium text-red-700">
                    Teaching · {elapsed}
                  </span>
                  <Button
                    onClick={handleStopTeaching}
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 rounded-xl"
                  >
                    <Square className="h-3.5 w-3.5" />
                    Stop
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleStartTeaching}
                  size="sm"
                  className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700"
                >
                  <Play className="h-4 w-4" />
                  Start Teaching
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Diary entries */}
        {filteredSessions.length === 0 ? (
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
            {filteredSessions.map(([dateStr, daySessions]) => (
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

                <div className="space-y-3">
                  {daySessions.map((session) => {
                    const classLabel = getClassLabel(session.classId);
                    const isSameClass =
                      selectedClassId !== "all" ||
                      (typeof session.classId === "object" && session.classId);

                    return (
                      <div
                        key={session.id}
                        className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              {isSameClass && (
                                <span className="text-sm font-semibold text-slate-800">
                                  {classLabel}
                                </span>
                              )}
                              <Badge
                                variant="secondary"
                                className={
                                  session.status === "ongoing"
                                    ? "bg-amber-100 text-amber-700 border-amber-200"
                                    : "bg-green-100 text-green-700 border-green-200"
                                }
                              >
                                {session.status === "ongoing" ? "Ongoing" : "Completed"}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                              {session.startTime && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {formatTime(session.startTime)}
                                  {session.endTime && (
                                    <> – {formatTime(session.endTime)}</>
                                  )}
                                </span>
                              )}
                              {session.durationMinutes !== undefined &&
                                session.durationMinutes !== null && (
                                  <span className="flex items-center gap-1">
                                    <Timer className="h-3.5 w-3.5" />
                                    {session.durationMinutes} min
                                  </span>
                                )}
                            </div>

                            {session.topicsCovered &&
                              session.topicsCovered.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                  <ListTodo className="h-3.5 w-3.5 text-slate-400" />
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
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
