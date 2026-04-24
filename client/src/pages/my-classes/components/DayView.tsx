import { useState } from "react";
import { useTimetableDay } from "../hooks/useTimetableDay";
import { useStaffTimetableDay } from "../hooks/useStaffTimetableDay";
import { ScheduleEntryDialog } from "./ScheduleEntryDialog";
import { WorkDoneDialog } from "./WorkDoneDialog";
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
} from "lucide-react";
import type { ITimetableEntry, IPeriodSlot, IPeriodConfig } from "@/types/timetable";

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

export function DayView({
  date,
  readOnly = false,
  staffId,
  institutionId,
  fallbackPeriodConfig,
}: DayViewProps) {
  const dateStr = formatDateString(date);
  const isAdminView = !!staffId && !!institutionId;

  // Freeze past dates — always read-only regardless of prop
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const dateMidnight = new Date(date);
  dateMidnight.setHours(0, 0, 0, 0);
  const isPastDate = dateMidnight < todayMidnight;
  const effectiveReadOnly = readOnly || isPastDate;

  // Use the appropriate hook based on whether we're viewing own or staff timetable
  const ownData = useTimetableDay(isAdminView ? null : dateStr);
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
  }>({ open: false });

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

  const scheduledCount = entries.filter((e) => e.status === "scheduled").length;
  const completedCount = entries.filter((e) => e.status === "completed").length;
  const dow = date.getDay();

  // Track non-break period index for color rotation
  let colorIdx = 0;

  return (
    <>
      <div className="neo-card overflow-hidden">
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
            <Table>
              <TableHeader>
                <TableRow className="bg-[var(--neo-bg-dark)]/40 hover:bg-[var(--neo-bg-dark)]/40 border-b border-white/30">
                  <TableHead className="w-[64px]"><Skeleton className="h-4 w-8" /></TableHead>
                  <TableHead className="w-[100px]"><Skeleton className="h-4 w-16" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                  <TableHead className="w-[90px] hidden sm:table-cell"><Skeleton className="h-4 w-14" /></TableHead>
                  {!effectiveReadOnly && <TableHead className="w-[72px]"><Skeleton className="h-4 w-8" /></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-8 w-8 rounded-lg" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    {!effectiveReadOnly && <TableCell><Skeleton className="h-6 w-6" /></TableCell>}
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
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--neo-bg-dark)]/40 hover:bg-[var(--neo-bg-dark)]/40 border-b border-white/30">
                <TableHead className="w-[64px] text-[11px] font-black uppercase tracking-wider text-slate-400 pl-5">
                  Period
                </TableHead>
                <TableHead className="w-[110px] text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Time
                </TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Class / Subject
                </TableHead>
                <TableHead className="w-[90px] text-[11px] font-black uppercase tracking-wider text-slate-400 hidden sm:table-cell">
                  Status
                </TableHead>
                {!effectiveReadOnly && (
                  <TableHead className="w-[72px] text-[11px] font-black uppercase tracking-wider text-slate-400 text-right pr-5">
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
                      <TableCell className="pl-4">
                        <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl shadow-[inset_2px_2px_4px_var(--neo-shadow-dark),inset_-2px_-2px_4px_var(--neo-shadow-light)] bg-[var(--neo-bg)] text-slate-500 text-xs font-black">
                          P{period.periodNumber}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-semibold text-slate-600">{period.startTime}</span>
                        <span className="text-xs text-slate-500 ml-0.5">– {period.endTime}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-400 italic">No class scheduled</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-[11px] text-slate-400 font-medium">&mdash;</span>
                      </TableCell>
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

                return (
                  <ScheduledRow
                    key={period.periodNumber}
                    period={period}
                    entry={entry}
                    isCompleted={isCompleted}
                    colors={colors}
                    readOnly={effectiveReadOnly}
                    onEditClick={() =>
                      setScheduleDialog({
                        open: true,
                        periodNumber: period.periodNumber,
                        dayOfWeek: dow,
                        entry,
                      })
                    }
                    onCompleteClick={() =>
                      setWorkDoneDialog({ open: true, entry })
                    }
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
      />
    </>
  );
}

/* ─── Break Row ─── */
function BreakRow({ period, readOnly }: { period: IPeriodSlot; readOnly?: boolean }) {
  return (
    <TableRow className="bg-amber-50/30 hover:bg-amber-50/30 border-b border-amber-100/40">
      <TableCell colSpan={readOnly ? 4 : 5} className="py-3 px-5">
        <div className="flex items-center justify-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300/50 to-transparent" />
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5 shrink-0 bg-gradient-to-br from-amber-100 to-amber-50 px-4 py-1.5 rounded-full shadow-[2px_2px_5px_var(--neo-shadow-dark),-2px_-2px_5px_var(--neo-shadow-light)] border border-amber-200/60">
            <Coffee size={12} />
            {period.label || "Break"} &middot; {period.startTime}–{period.endTime}
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300/50 to-transparent" />
        </div>
      </TableCell>
    </TableRow>
  );
}

/* ─── Scheduled Row ─── */
function ScheduledRow({
  period,
  entry,
  isCompleted,
  colors,
  readOnly,
  onEditClick,
  onCompleteClick,
}: {
  period: IPeriodSlot;
  entry: ITimetableEntry;
  isCompleted: boolean;
  colors: { border: string; badge: string };
  readOnly?: boolean;
  onEditClick: () => void;
  onCompleteClick: () => void;
}) {
  const borderColor = isCompleted ? COMPLETED_BORDER : colors.border;
  const badgeColor = isCompleted ? "bg-emerald-100 text-emerald-700" : colors.badge;
  const classLabel = getClassLabel(entry.classId);
  const bookLabel = getBookLabel(entry.gradeBookId);

  return (
    <TableRow
      className={`border-l-[3px] ${borderColor} hover:bg-white/20 transition-all duration-200 border-b border-white/20 ${
        isCompleted ? "bg-emerald-50/20" : ""
      }`}
    >
      {/* Period badge */}
      <TableCell className="pl-4">
        <span
          className={`inline-flex items-center justify-center w-9 h-9 rounded-xl text-xs font-black shadow-[2px_2px_5px_var(--neo-shadow-dark),-2px_-2px_5px_var(--neo-shadow-light)] border border-white/40 ${badgeColor}`}
        >
          P{period.periodNumber}
        </span>
      </TableCell>

      {/* Time */}
      <TableCell>
        <span className="text-sm font-semibold text-slate-700">{period.startTime}</span>
        <span className="text-xs text-slate-500 ml-0.5">– {period.endTime}</span>
      </TableCell>

      {/* Class / Subject */}
      <TableCell>
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-800">
              {classLabel || "Class"}
            </span>
            {bookLabel && (
              <span className="text-[11px] font-semibold text-slate-600 neo-inset-sm px-2.5 py-1 flex items-center gap-1">
                <BookOpen size={10} />
                {bookLabel}
              </span>
            )}
            {entry.isRecurring && (
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
          {entry.topicsCovered && entry.topicsCovered.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {entry.topicsCovered.map((t, i) => (
                <span
                  key={i}
                  className="text-[10px] bg-[var(--neo-bg)] shadow-[inset_1px_1px_3px_var(--neo-shadow-dark),inset_-1px_-1px_3px_var(--neo-shadow-light)] text-slate-600 px-2 py-0.5 rounded-full font-semibold"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </TableCell>

      {/* Status */}
      <TableCell className="hidden sm:table-cell">
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

      {/* Actions (only in non-readOnly mode) */}
      {!readOnly && (
        <TableCell className="text-right pr-4">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={onEditClick}
              className="inline-flex items-center justify-center w-8 h-8 rounded-xl shadow-[2px_2px_5px_var(--neo-shadow-dark),-2px_-2px_5px_var(--neo-shadow-light)] border border-white/40 bg-gradient-to-145 from-[var(--neo-bg-alt)] to-[var(--neo-bg-dark)] text-slate-500 hover:text-indigo-600 hover:shadow-[3px_3px_8px_var(--neo-shadow-dark),-3px_-3px_8px_var(--neo-shadow-light),0_0_10px_rgba(99,102,241,0.2)] active:shadow-[inset_2px_2px_4px_var(--neo-shadow-dark),inset_-2px_-2px_4px_var(--neo-shadow-light)] transition-all cursor-pointer"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
            {!isCompleted && (
              <button
                onClick={onCompleteClick}
                className="inline-flex items-center justify-center w-8 h-8 rounded-xl shadow-[2px_2px_5px_var(--neo-shadow-dark),-2px_-2px_5px_var(--neo-shadow-light)] border border-white/40 bg-gradient-to-145 from-[var(--neo-bg-alt)] to-[var(--neo-bg-dark)] text-slate-500 hover:text-emerald-600 hover:shadow-[3px_3px_8px_var(--neo-shadow-dark),-3px_-3px_8px_var(--neo-shadow-light),0_0_10px_rgba(16,185,129,0.2)] active:shadow-[inset_2px_2px_4px_var(--neo-shadow-dark),inset_-2px_-2px_4px_var(--neo-shadow-light)] transition-all cursor-pointer"
                title="Mark done"
              >
                <Check size={14} />
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
      <TableCell className="pl-4">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl shadow-[inset_2px_2px_4px_var(--neo-shadow-dark),inset_-2px_-2px_4px_var(--neo-shadow-light)] bg-[var(--neo-bg)] text-slate-500 text-xs font-black group-hover:shadow-[2px_2px_5px_var(--neo-shadow-dark),-2px_-2px_5px_var(--neo-shadow-light)] group-hover:bg-gradient-to-br group-hover:from-indigo-100 group-hover:to-indigo-50 group-hover:text-indigo-700 transition-all">
          P{period.periodNumber}
        </span>
      </TableCell>

      {/* Time */}
      <TableCell>
        <span className="text-sm font-semibold text-slate-600">{period.startTime}</span>
        <span className="text-xs text-slate-500 ml-0.5">– {period.endTime}</span>
      </TableCell>

      {/* Empty label */}
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-sm text-slate-400 group-hover:text-indigo-500 transition-colors">
          <Plus size={13} className="opacity-50 group-hover:opacity-100" />
          <span className="italic group-hover:not-italic">Add a class</span>
        </span>
      </TableCell>

      {/* Status */}
      <TableCell className="hidden sm:table-cell">
        <span className="text-[11px] text-slate-400 font-medium">&mdash;</span>
      </TableCell>

      {/* Add button */}
      <TableCell className="text-right pr-4">
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
