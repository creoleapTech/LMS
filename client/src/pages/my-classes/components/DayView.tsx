import { useState, useMemo } from "react";
import { useTimetableDay } from "../hooks/useTimetableDay";
import { useStaffTimetableDay } from "../hooks/useStaffTimetableDay";
import { useClassSessions } from "../hooks/useClassSessions";
import { useTimetableMutations } from "../hooks/useTimetableMutations";
import { ScheduleEntryDialog } from "./ScheduleEntryDialog";
import { WorkDoneDialog } from "./WorkDoneDialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Pencil,
  Check,
  BookOpen,
  Coffee,
  CheckCircle2,
  Clock,
  Timer,
  GraduationCap,
  Trash2,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { useAuthStore } from "@/store/userAuthStore";
import { useNavigate } from "@tanstack/react-router";
import type { ITimetableEntry, IPeriodSlot, IPeriodConfig, IClassSession } from "@/types/timetable";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const ROW_COLORS = [
  { border: "border-l-indigo-400", badge: "bg-indigo-100 text-indigo-700" },
  { border: "border-l-emerald-400", badge: "bg-emerald-100 text-emerald-700" },
  { border: "border-l-rose-400", badge: "bg-rose-100 text-rose-700" },
  { border: "border-l-amber-400", badge: "bg-amber-100 text-amber-700" },
  { border: "border-l-sky-400", badge: "bg-sky-100 text-sky-700" },
];

const COMPLETED_BORDER = "border-l-emerald-500";

function getClassLabel(classId: ITimetableEntry["classId"]): string {
  if (typeof classId === "object" && classId) {
    return `${classId.grade || ""}–${classId.section || ""}`.replace(/^–|–$/g, "");
  }
  return "";
}

function getAdditionalClassLabel(cls: { grade?: string; section?: string }): string {
  return `${cls.grade || ""}–${cls.section || ""}`.replace(/^–|–$/g, "");
}

function getBookLabel(gradeBookId: ITimetableEntry["gradeBookId"]): string {
  if (typeof gradeBookId === "object" && gradeBookId && gradeBookId.bookTitle) {
    return gradeBookId.bookTitle;
  }
  return "";
}

interface DayViewProps {
  date: Date;
  readOnly?: boolean;
  staffId?: string | null;
  institutionId?: string | null;
  fallbackPeriodConfig?: IPeriodConfig | null;
}

function formatDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTime12Hour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const suffix = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${displayH}:${String(m).padStart(2, "0")} ${suffix}`;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getSessionClassId(session: IClassSession): string {
  if (typeof session.classId === "object" && session.classId) return session.classId._id;
  return session.classId || "";
}

function getSessionMinuteCandidates(iso: string): number[] {
  const d = new Date(iso);
  return [
    d.getUTCHours() * 60 + d.getUTCMinutes(),
    d.getHours() * 60 + d.getMinutes(),
  ];
}

function findSessionForEntryPeriod(
  sessions: IClassSession[],
  entry: ITimetableEntry,
  period: IPeriodSlot,
): IClassSession | undefined {
  const entryClassId = typeof entry.classId === "object" ? entry.classId?._id : entry.classId;
  if (!entryClassId) return undefined;

  const periodStart = parseTimeToMinutes(period.startTime);
  const periodEnd = parseTimeToMinutes(period.endTime);

  return sessions.find((session) => {
    if (getSessionClassId(session) !== entryClassId || !session.startTime) return false;
    const sessionStarts = getSessionMinuteCandidates(session.startTime);
    const sessionEnds = session.endTime ? getSessionMinuteCandidates(session.endTime) : sessionStarts;
    return sessionStarts.some((sessionStart, index) => {
      const sessionEnd = sessionEnds[index] ?? sessionStart;
      return (
        (sessionStart >= periodStart && sessionStart < periodEnd) ||
        (periodStart >= sessionStart && periodStart < Math.max(sessionEnd, sessionStart + 1))
      );
    });
  });
}

export function DayView({
  date,
  readOnly = false,
  staffId,
  institutionId,
  fallbackPeriodConfig,
}: DayViewProps) {
  const dateStr = formatDateString(date);
  const isAdminView = !!staffId && !!institutionId;
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === "super_admin";

  // Freeze dates older than 30 days — always read-only regardless of prop
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(todayMidnight);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateMidnight = new Date(date);
  dateMidnight.setHours(0, 0, 0, 0);
  const isPastDate = dateMidnight < thirtyDaysAgo;
  const effectiveReadOnly = readOnly || isPastDate;

  // Use the appropriate hook based on whether we're viewing own or staff timetable
  const ownData = useTimetableDay(isAdminView ? null : dateStr, isAdminView ? undefined : institutionId || undefined);
  const staffData = useStaffTimetableDay(
    isAdminView ? staffId : null,
    isAdminView ? institutionId : null,
    isAdminView ? dateStr : null
  );

  const { data, isLoading } = isAdminView ? staffData : ownData;

  const [scheduleDialog, setScheduleDialog] = useState<{
    open: boolean;
    periodNumber: number;
    dayOfWeek: number;
    entry?: ITimetableEntry;
  }>({ open: false, periodNumber: 0, dayOfWeek: 0 });

  const [workDoneDialog, setWorkDoneDialog] = useState<{
    open: boolean;
    entry?: ITimetableEntry;
    period?: IPeriodSlot;
    session?: IClassSession;
  }>({ open: false });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    entry?: ITimetableEntry;
  }>({ open: false });

  const [deleteScope, setDeleteScope] = useState<"day" | "future" | null>(null);

  const { deleteEntry } = useTimetableMutations();

  const isRecurringEntry = !!deleteDialog.entry?.isRecurring;

  const handleDelete = () => {
    if (deleteDialog.entry) {
      if (isRecurringEntry && deleteScope === "future") {
        deleteEntry.mutate(
          { id: deleteDialog.entry._id, scope: "future" },
          {
            onSuccess: () => {
              setDeleteDialog({ open: false });
              setDeleteScope(null);
            },
          },
        );
      } else {
        deleteEntry.mutate(
          { id: deleteDialog.entry._id, date: isRecurringEntry ? dateStr : undefined },
          {
            onSuccess: () => {
              setDeleteDialog({ open: false });
              setDeleteScope(null);
            },
          },
        );
      }
    }
  };

  const periodConfig = data?.periodConfig;
  const entries = data?.entries || [];
  const dayPeriods = Array.isArray(periodConfig?.periods) ? periodConfig.periods : [];
  const fallbackPeriods = Array.isArray(fallbackPeriodConfig?.periods)
    ? fallbackPeriodConfig.periods
    : [];
  const periods = dayPeriods.length > 0 ? dayPeriods : fallbackPeriods;
  const sortedPeriods = [...periods].sort((a, b) => a.periodNumber - b.periodNumber);

  const entryMap = new Map<number, ITimetableEntry>();
  for (const entry of entries) {
    entryMap.set(entry.periodNumber, entry);
  }

  // Fetch class sessions for the day
  const effectiveStaffId = isAdminView ? staffId : currentUser?._id;
  const { data: daySessions } = useClassSessions(effectiveStaffId || null, dateStr);
  const navigate = useNavigate();

  const daySessionList = useMemo(() => daySessions || [], [daySessions]);

  const scheduledCount = entries.filter((e) => e.status === "scheduled").length;
  const completedCount = entries.filter((e) => e.status === "completed").length;
  const dow = date.getDay();
  const showActions = !effectiveReadOnly || isSuperAdmin;
  const actionColumnClass = effectiveReadOnly ? "w-[72px]" : "w-[160px]";
  const stickyActionCellClass = `${actionColumnClass} sticky right-0 z-10 bg-[var(--neo-bg)] shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]`;

  // Track non-break period index for color rotation
  let colorIdx = 0;

  return (
    <>
      <div className="neo-card">
        {/* Day header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/30">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
              Schedule For
            </p>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              {DAY_NAMES[date.getDay()]}, {MONTH_NAMES[date.getMonth()]} {date.getDate()}
              {isPastDate && (
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Read-only
                </span>
              )}
            </h2>
          </div>
                {!isLoading && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 neo-inset-sm px-3 py-1.5">
                      {scheduledCount + completedCount} {scheduledCount + completedCount === 1 ? "class" : "classes"}
                    </span>
                    {completedCount > 0 && (
                      <span className="text-xs font-semibold text-emerald-700 bg-gradient-to-br from-emerald-100 to-emerald-50 shadow-[2px_2px_5px_var(--neo-shadow-dark),-2px_-2px_5px_var(--neo-shadow-light)] border border-emerald-200/60 px-3 py-1.5 rounded-full">
                        {completedCount} done
                      </span>
                    )}
                  </div>
                )}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="p-4">
            <Table className="min-w-[640px] table-fixed">
              <TableHeader>
                <TableRow className="bg-[var(--neo-bg-dark)]/40 hover:bg-[var(--neo-bg-dark)]/40 border-b border-white/30">
                  <TableHead className="w-[64px]"><Skeleton className="h-4 w-8" /></TableHead>
                  <TableHead className="w-[132px]"><Skeleton className="h-4 w-16" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                  <TableHead className="w-[90px] hidden sm:table-cell"><Skeleton className="h-4 w-14" /></TableHead>
                  {showActions && <TableHead className={actionColumnClass}><Skeleton className="h-4 w-8" /></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-8 w-8 rounded-lg" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    {showActions && <TableCell className={actionColumnClass}><Skeleton className="h-6 w-6" /></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* No period config */}
        {!isLoading && periods.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-slate-500 font-semibold">No period schedule configured</p>
            <p className="text-slate-400 text-sm mt-1">
              Ask your admin to configure periods in Settings.
            </p>
          </div>
        )}

        {/* Schedule table */}
        {!isLoading && sortedPeriods.length > 0 && (
          <Table className="min-w-[640px] table-fixed">
            <TableHeader>
              <TableRow className="bg-[var(--neo-bg-dark)]/40 hover:bg-[var(--neo-bg-dark)]/40 border-b border-white/30">
                <TableHead className="w-[64px] text-[11px] font-black uppercase tracking-wider text-slate-400 pl-5">
                  Period
                </TableHead>
                <TableHead className="w-[132px] text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Time
                </TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Class / Subject
                </TableHead>
                <TableHead className="w-[90px] text-[11px] font-black uppercase tracking-wider text-slate-400 hidden sm:table-cell">
                  Status
                </TableHead>
                 {showActions && (
                  <TableHead className={`${actionColumnClass} sticky right-0 z-20 bg-[var(--neo-bg-dark)] text-[11px] font-black uppercase tracking-wider text-slate-400 text-right pr-5`}>
                    Actions
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPeriods.map((period) => {
                const entry = entryMap.get(period.periodNumber);
                const isBreak = period.isBreak;
                const isCompleted = entry?.status === "completed";

                if (isBreak) {
                  return (
                    <BreakRow
                      key={period.periodNumber}
                      period={period}
                      readOnly={effectiveReadOnly}
                      showActions={showActions}
                    />
                  );
                }

                const colors = ROW_COLORS[colorIdx % ROW_COLORS.length];
                colorIdx++;

                if (!entry) {
                  return effectiveReadOnly ? (
                    <TableRow
                      key={period.periodNumber}
                      className="border-l-[3px] border-l-slate-200 border-b border-white/20"
                    >
                      <TableCell className="pl-4 align-top pt-3">
                        <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl shadow-[inset_2px_2px_4px_var(--neo-shadow-dark),inset_-2px_-2px_4px_var(--neo-shadow-light)] bg-[var(--neo-bg)] text-slate-500 text-xs font-black">
                          P{period.periodNumber}
                        </span>
                      </TableCell>
                      <TableCell className="align-top pt-3 whitespace-normal">
                        <TimeRange startTime={period.startTime} endTime={period.endTime} muted />
                      </TableCell>
                      <TableCell className="align-top pt-3 whitespace-normal">
                        <span className="text-sm text-slate-400 italic">No class scheduled</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell align-top pt-3">
                        <span className="text-[11px] text-slate-400 font-medium">&mdash;</span>
                      </TableCell>
                      {showActions && (
                        <TableCell className={`${stickyActionCellClass} align-top pt-3 pr-4`} />
                      )}
                    </TableRow>
                  ) : (
                    <EmptyRow
                      key={period.periodNumber}
                      period={period}
                      onAddClick={() =>
                        setScheduleDialog({
                          open: true,
                          periodNumber: period.periodNumber,
                          dayOfWeek: dow,
                        })
                      }
                    />
                  );
                }

                const matchedSession = findSessionForEntryPeriod(daySessionList, entry, period);

                return (
                  <ScheduledRow
                    key={period.periodNumber}
                    period={period}
                    entry={entry}
                    isCompleted={isCompleted}
                    colors={colors}
                    readOnly={effectiveReadOnly}
                    isSuperAdmin={isSuperAdmin}
                    session={matchedSession}
                    onEditClick={() =>
                      setScheduleDialog({
                        open: true,
                        periodNumber: period.periodNumber,
                        dayOfWeek: dow,
                        entry,
                      })
                    }
                    onCompleteClick={() =>
                      setWorkDoneDialog({ open: true, entry, period, session: matchedSession })
                    }
                    onTeachClick={() => {
                      const gbId = typeof entry.gradeBookId === "object" ? entry.gradeBookId?._id : entry.gradeBookId;
                      const gbTitle = typeof entry.gradeBookId === "object" ? entry.gradeBookId?.bookTitle : "";
                      const cId = typeof entry.classId === "object" ? entry.classId?._id : entry.classId;
                      if (cId) {
                        navigate({
                          to: "/curriculum",
                          search: {
                            gradeBookId: gbId || undefined,
                            classId: cId,
                            bookTitle: gbTitle || undefined,
                          },
                        });
                      }
                    }}
                    onDeleteClick={() => setDeleteDialog({ open: true, entry })}
                  />
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <ScheduleEntryDialog
        open={scheduleDialog.open}
        onOpenChange={(open) =>
          setScheduleDialog((prev) => ({ ...prev, open }))
        }
        periodNumber={scheduleDialog.periodNumber}
        dayOfWeek={scheduleDialog.dayOfWeek}
        specificDate={dateStr}
        entry={scheduleDialog.entry}
      />

      <WorkDoneDialog
        open={workDoneDialog.open}
        onOpenChange={(open) =>
          setWorkDoneDialog((prev) => ({ ...prev, open }))
        }
        entry={workDoneDialog.entry}
        date={dateStr}
        period={workDoneDialog.period}
        session={workDoneDialog.session}
      />

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          setDeleteDialog((prev) => ({ ...prev, open }));
          if (!open) setDeleteScope(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRecurringEntry
                ? deleteScope
                  ? deleteScope === "day"
                    ? "Remove for this day?"
                    : "Remove all future?"
                  : "Delete recurring schedule?"
                : "Delete schedule?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRecurringEntry
                ? deleteScope
                  ? deleteScope === "day"
                    ? "Only this day's instance will be removed — other days remain unchanged."
                    : "This will remove the recurring schedule from today onwards. Past classes are preserved."
                  : "This is a recurring class. Choose how to remove it:"
                : "This will remove the scheduled class from your timetable. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Two-option selection for recurring entries when no scope selected */}
          {isRecurringEntry && !deleteScope && (
            <div className="space-y-2 px-1">
              <button
                type="button"
                onClick={() => setDeleteScope("day")}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-left group cursor-pointer"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 border border-indigo-200/60 flex items-center justify-center group-hover:shadow-[2px_2px_5px_var(--neo-shadow-dark),-2px_-2px_5px_var(--neo-shadow-light)] transition-all">
                  <Calendar size={18} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Delete this day only</p>
                  <p className="text-xs text-slate-500">
                    Remove {DAY_NAMES[deleteDialog.entry?.dayOfWeek ?? 0]}&apos;s class. Other days remain unchanged.
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setDeleteScope("future")}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50/50 transition-all text-left group cursor-pointer"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-rose-100 to-rose-50 border border-rose-200/60 flex items-center justify-center group-hover:shadow-[2px_2px_5px_var(--neo-shadow-dark),-2px_-2px_5px_var(--neo-shadow-light)] transition-all">
                  <RefreshCw size={18} className="text-rose-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Delete all future</p>
                  <p className="text-xs text-slate-500">
                    Remove this recurring schedule from today onwards. Past classes stay.
                  </p>
                </div>
              </button>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteDialog({ open: false });
                setDeleteScope(null);
              }}
              className="rounded-xl"
            >
              Cancel
            </AlertDialogCancel>
            {(!isRecurringEntry || deleteScope) && (
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleteEntry.isPending}
                className="rounded-xl bg-rose-600 hover:bg-rose-700"
              >
                {deleteEntry.isPending
                  ? "Removing..."
                  : isRecurringEntry && deleteScope === "future"
                    ? "Remove all future"
                    : isRecurringEntry
                      ? "Remove for today"
                      : "Delete"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ─── Break Row ─── */
function BreakRow({
  period,
  readOnly,
  showActions,
}: {
  period: IPeriodSlot;
  readOnly?: boolean;
  showActions?: boolean;
}) {
  return (
    <TableRow className="bg-amber-50/30 hover:bg-amber-50/30 border-b border-amber-100/40">
      <TableCell colSpan={readOnly && !showActions ? 4 : 5} className="py-3 px-5">
        <div className="flex items-center justify-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300/50 to-transparent" />
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5 shrink-0 bg-gradient-to-br from-amber-100 to-amber-50 px-4 py-1.5 rounded-full shadow-[2px_2px_5px_var(--neo-shadow-dark),-2px_-2px_5px_var(--neo-shadow-light)] border border-amber-200/60">
            <Coffee size={12} />
            {period.label || "Break"} &middot; {formatTime12Hour(period.startTime)}–{formatTime12Hour(period.endTime)}
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300/50 to-transparent" />
        </div>
      </TableCell>
    </TableRow>
  );
}

function TimeRange({
  startTime,
  endTime,
  muted = false,
}: {
  startTime: string;
  endTime: string;
  muted?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0.5 leading-tight">
      <span className={`whitespace-nowrap text-sm font-semibold ${muted ? "text-slate-600" : "text-slate-700"}`}>
        {formatTime12Hour(startTime)}
      </span>
      <span className="whitespace-nowrap text-xs text-slate-500">
        - {formatTime12Hour(endTime)}
      </span>
    </div>
  );
}

/* ─── Scheduled Row ─── */
function ScheduledRow({
  period,
  entry,
  isCompleted,
  colors,
  readOnly = false,
  isSuperAdmin = false,
  session,
  onEditClick,
  onCompleteClick,
  onTeachClick,
  onDeleteClick,
}: {
  period: IPeriodSlot;
  entry: ITimetableEntry;
  isCompleted: boolean;
  colors: { border: string; badge: string };
  readOnly?: boolean;
  isSuperAdmin?: boolean;
  session?: IClassSession;
  onEditClick: () => void;
  onCompleteClick: () => void;
  onTeachClick: () => void;
  onDeleteClick: () => void;
}) {
  const borderColor = isCompleted ? COMPLETED_BORDER : colors.border;
  const badgeColor = isCompleted ? "bg-emerald-100 text-emerald-700" : colors.badge;
  const classLabel = getClassLabel(entry.classId);
  const additionalClasses = entry.additionalClasses || [];
  const bookLabel = getBookLabel(entry.gradeBookId);
  const actionColumnClass = readOnly ? "w-[72px]" : "w-[160px]";
  const stickyActionCellClass = `${actionColumnClass} sticky right-0 z-10 bg-[var(--neo-bg)] shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]`;

  return (
    <TableRow
      className={`border-l-[3px] ${borderColor} hover:bg-white/20 transition-all duration-200 border-b border-white/20 ${
        isCompleted ? "bg-emerald-50/20" : ""
      }`}
    >
      {/* Period badge */}
      <TableCell className="pl-4 align-top pt-3">
        <span
          className={`inline-flex items-center justify-center w-9 h-9 rounded-xl text-xs font-black shadow-[2px_2px_5px_var(--neo-shadow-dark),-2px_-2px_5px_var(--neo-shadow-light)] border border-white/40 ${badgeColor}`}
        >
          P{period.periodNumber}
        </span>
      </TableCell>

      {/* Time */}
      <TableCell className="align-top pt-3 whitespace-normal">
        <TimeRange startTime={period.startTime} endTime={period.endTime} />
      </TableCell>

      {/* Class / Subject */}
      <TableCell className="min-w-0 align-top pt-3 whitespace-normal break-words">
        <div className="min-w-0 space-y-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-800">
              {classLabel || "Class"}
            </span>
            {additionalClasses.map((cls) => (
              <span
                key={cls._id}
                className="text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full"
              >
                + {getAdditionalClassLabel(cls)}
              </span>
            ))}
            {bookLabel && (
              <span className="min-w-0 max-w-full text-[11px] font-semibold text-slate-600 neo-inset-sm px-2.5 py-1 flex items-center gap-1">
                <BookOpen size={10} className="shrink-0" />
                <span className="truncate">{bookLabel}</span>
              </span>
            )}
            {!!entry.isRecurring && (
              <span className="text-[9px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded-full uppercase">
                Recurring
              </span>
            )}
          </div>
          {entry.notes && (
            <p className="text-xs text-slate-500 font-medium truncate max-w-[280px]">
              {entry.notes}
            </p>
          )}
          {entry.chapterTopics && entry.chapterTopics.length > 0 ? (
            <div className="max-h-32 space-y-1.5 overflow-y-auto pr-1">
              {entry.chapterTopics.map((group) => (
                <div key={group.chapterId || "__no_chapter__"} className="min-w-0">
                  {group.chapterTitle && (
                    <p className="max-w-full truncate text-[10px] font-bold text-indigo-600 mb-0.5">{group.chapterTitle}</p>
                  )}
                  <div className="flex min-w-0 flex-wrap gap-1">
                    {group.subtopics.map((st, j) => (
                      <span
                        key={j}
                        className="max-w-full whitespace-normal break-words text-left text-[10px] leading-tight bg-[var(--neo-bg)] shadow-[inset_1px_1px_3px_var(--neo-shadow-dark),inset_-1px_-1px_3px_var(--neo-shadow-light)] text-slate-600 px-2 py-0.5 rounded-full font-semibold"
                      >
                        {st.title}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : entry.topicsCovered && entry.topicsCovered.length > 0 ? (
            <div className="flex max-h-24 min-w-0 flex-wrap gap-1 overflow-y-auto pr-1">
              {entry.topicsCovered.map((t, i) => (
                <span
                  key={i}
                  className="max-w-full whitespace-normal break-words text-left text-[10px] leading-tight bg-[var(--neo-bg)] shadow-[inset_1px_1px_3px_var(--neo-shadow-dark),inset_-1px_-1px_3px_var(--neo-shadow-light)] text-slate-600 px-2 py-0.5 rounded-full font-semibold"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          {isCompleted && session?.durationMinutes && (
            <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
              <Timer size={10} />
              {session.durationMinutes} min session
            </div>
          )}
        </div>
      </TableCell>

      {/* Status */}
      <TableCell className="hidden sm:table-cell align-top pt-3">
        {isCompleted ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200/60 px-2.5 py-1.5 rounded-full shadow-[2px_2px_5px_var(--neo-shadow-dark),-2px_-2px_5px_var(--neo-shadow-light)]">
            <CheckCircle2 size={12} /> Done
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200/60 px-2.5 py-1.5 rounded-full shadow-[2px_2px_5px_var(--neo-shadow-dark),-2px_-2px_5px_var(--neo-shadow-light)]">
            <Clock size={12} /> Sched
          </span>
        )}
      </TableCell>

      {/* Actions (only in non-readOnly mode or for super admin) */}
      {(!readOnly || isSuperAdmin) && (
        <TableCell className={`${stickyActionCellClass} align-top pt-3 text-right pr-4`}>
          <div className="flex items-center justify-end gap-1">
            {!readOnly && (
              <>
                <button
                  onClick={onEditClick}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-xl shadow-[2px_2px_5px_var(--neo-shadow-dark),-2px_-2px_5px_var(--neo-shadow-light)] border border-white/40 bg-gradient-to-145 from-[var(--neo-bg-alt)] to-[var(--neo-bg-dark)] text-slate-500 hover:text-indigo-600 hover:shadow-[3px_3px_8px_var(--neo-shadow-dark),-3px_-3px_8px_var(--neo-shadow-light),0_0_10px_rgba(99,102,241,0.2)] active:shadow-[inset_2px_2px_4px_var(--neo-shadow-dark),inset_-2px_-2px_4px_var(--neo-shadow-light)] transition-all cursor-pointer"
                  title="Edit schedule"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={onCompleteClick}
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-xl shadow-[2px_2px_5px_var(--neo-shadow-dark),-2px_-2px_5px_var(--neo-shadow-light)] border border-white/40 bg-gradient-to-145 from-[var(--neo-bg-alt)] to-[var(--neo-bg-dark)] text-slate-500 hover:text-emerald-600 hover:shadow-[3px_3px_8px_var(--neo-shadow-dark),-3px_-3px_8px_var(--neo-shadow-light),0_0_10px_rgba(16,185,129,0.2)] active:shadow-[inset_2px_2px_4px_var(--neo-shadow-dark),inset_-2px_-2px_4px_var(--neo-shadow-light)] transition-all cursor-pointer`}
                  title={isCompleted ? "Edit work done" : "Mark done"}
                >
                  {isCompleted ? <CheckCircle2 size={14} /> : <Check size={14} />}
                </button>
                {!isCompleted && (
                  <button
                    onClick={onTeachClick}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-xl shadow-[2px_2px_5px_var(--neo-shadow-dark),-2px_-2px_5px_var(--neo-shadow-light)] border border-white/40 bg-gradient-to-145 from-[var(--neo-bg-alt)] to-[var(--neo-bg-dark)] text-slate-500 hover:text-violet-600 hover:shadow-[3px_3px_8px_var(--neo-shadow-dark),-3px_-3px_8px_var(--neo-shadow-light),0_0_10px_rgba(139,92,246,0.2)] active:shadow-[inset_2px_2px_4px_var(--neo-shadow-dark),inset_-2px_-2px_4px_var(--neo-shadow-light)] transition-all cursor-pointer"
                    title="Teach"
                  >
                    <GraduationCap size={14} />
                  </button>
                )}
              </>
            )}
            {!isCompleted && (
              <button
                onClick={onDeleteClick}
                className="inline-flex items-center justify-center w-8 h-8 rounded-xl shadow-[2px_2px_5px_var(--neo-shadow-dark),-2px_-2px_5px_var(--neo-shadow-light)] border border-white/40 bg-gradient-to-145 from-[var(--neo-bg-alt)] to-[var(--neo-bg-dark)] text-slate-500 hover:text-rose-600 hover:shadow-[3px_3px_8px_var(--neo-shadow-dark),-3px_-3px_8px_var(--neo-shadow-light),0_0_10px_rgba(225,29,72,0.2)] active:shadow-[inset_2px_2px_4px_var(--neo-shadow-dark),inset_-2px_-2px_4px_var(--neo-shadow-light)] transition-all cursor-pointer"
                title="Delete schedule"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

/* ─── Empty Row ─── */
function EmptyRow({
  period,
  onAddClick,
}: {
  period: IPeriodSlot;
  onAddClick: () => void;
}) {
  return (
    <TableRow
      className="border-l-[3px] border-l-slate-200 hover:border-l-indigo-300 hover:bg-white/20 transition-all duration-200 border-b border-white/20 group cursor-pointer"
      onClick={onAddClick}
    >
      {/* Period badge */}
      <TableCell className="pl-4 align-top pt-3">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl shadow-[inset_2px_2px_4px_var(--neo-shadow-dark),inset_-2px_-2px_4px_var(--neo-shadow-light)] bg-[var(--neo-bg)] text-slate-500 text-xs font-black group-hover:shadow-[2px_2px_5px_var(--neo-shadow-dark),-2px_-2px_5px_var(--neo-shadow-light)] group-hover:bg-gradient-to-br group-hover:from-indigo-100 group-hover:to-indigo-50 group-hover:text-indigo-700 transition-all">
          P{period.periodNumber}
        </span>
      </TableCell>

      {/* Time */}
      <TableCell className="align-top pt-3 whitespace-normal">
        <TimeRange startTime={period.startTime} endTime={period.endTime} muted />
      </TableCell>

      {/* Empty label */}
      <TableCell className="align-top pt-3 whitespace-normal">
        <span className="inline-flex items-center gap-1.5 text-sm text-slate-400 group-hover:text-indigo-500 transition-colors">
          <Plus size={13} className="opacity-50 group-hover:opacity-100" />
          <span className="italic group-hover:not-italic">Add a class</span>
        </span>
      </TableCell>

      {/* Status */}
      <TableCell className="hidden sm:table-cell align-top pt-3">
        <span className="text-[11px] text-slate-400 font-medium">&mdash;</span>
      </TableCell>

      {/* Add button */}
      <TableCell className="w-[160px] sticky right-0 z-10 bg-[var(--neo-bg)] align-top pt-3 text-right pr-4 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">
        <div
          className="inline-flex items-center justify-center w-8 h-8 rounded-xl shadow-[2px_2px_5px_var(--neo-shadow-dark),-2px_-2px_5px_var(--neo-shadow-light)] border border-white/40 bg-gradient-to-145 from-[var(--neo-bg-alt)] to-[var(--neo-bg-dark)] text-indigo-400 group-hover:text-indigo-600 group-hover:shadow-[3px_3px_8px_var(--neo-shadow-dark),-3px_-3px_8px_var(--neo-shadow-light),0_0_10px_rgba(99,102,241,0.15)] transition-all opacity-60 group-hover:opacity-100"
          aria-label="Add class"
        >
          <Plus size={15} />
        </div>
      </TableCell>
    </TableRow>
  );
}
