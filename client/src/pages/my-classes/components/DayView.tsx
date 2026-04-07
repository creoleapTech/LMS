import { useState } from "react";
import { useTimetableDay } from "../hooks/useTimetableDay";
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
import type { ITimetableEntry, IPeriodSlot } from "@/types/timetable";

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
}

function formatDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DayView({ date }: DayViewProps) {
  const dateStr = formatDateString(date);
  const { data, isLoading } = useTimetableDay(dateStr);

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
  const sortedPeriods = periodConfig
    ? [...periodConfig.periods].sort((a, b) => a.periodNumber - b.periodNumber)
    : [];

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
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Day header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
              Schedule For
            </p>
            <h2 className="text-lg font-bold text-slate-900">
              {DAY_NAMES[date.getDay()]}, {MONTH_NAMES[date.getMonth()]} {date.getDate()}
            </h2>
          </div>
          {!isLoading && entries.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {scheduledCount + completedCount} {scheduledCount + completedCount === 1 ? "class" : "classes"}
              </span>
              {completedCount > 0 && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
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
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-slate-200">
                  <TableHead className="w-[64px]"><Skeleton className="h-4 w-8" /></TableHead>
                  <TableHead className="w-[100px]"><Skeleton className="h-4 w-16" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                  <TableHead className="w-[90px] hidden sm:table-cell"><Skeleton className="h-4 w-14" /></TableHead>
                  <TableHead className="w-[72px]"><Skeleton className="h-4 w-8" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-8 w-8 rounded-lg" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-6" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* No period config */}
        {!isLoading && (!periodConfig || periodConfig.periods.length === 0) && (
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
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-slate-200">
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
                <TableHead className="w-[72px] text-[11px] font-black uppercase tracking-wider text-slate-400 text-right pr-5">
                  Actions
                </TableHead>
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
                    />
                  );
                }

                const colors = ROW_COLORS[colorIdx % ROW_COLORS.length];
                colorIdx++;

                if (!entry) {
                  return (
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
function BreakRow({ period }: { period: IPeriodSlot }) {
  return (
    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
      <TableCell colSpan={5} className="py-2.5 px-5">
        <div className="flex items-center justify-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
            <Coffee size={12} />
            {period.label || "Break"} &middot; {period.startTime}–{period.endTime}
          </span>
          <div className="h-px flex-1 bg-slate-200" />
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
  onEditClick,
  onCompleteClick,
}: {
  period: IPeriodSlot;
  entry: ITimetableEntry;
  isCompleted: boolean;
  colors: { border: string; badge: string };
  onEditClick: () => void;
  onCompleteClick: () => void;
}) {
  const borderColor = isCompleted ? COMPLETED_BORDER : colors.border;
  const badgeColor = isCompleted ? "bg-emerald-100 text-emerald-700" : colors.badge;
  const classLabel = getClassLabel(entry.classId);
  const bookLabel = getBookLabel(entry.gradeBookId);

  return (
    <TableRow
      className={`border-l-[3px] ${borderColor} hover:bg-slate-50/50 transition-colors border-b border-slate-100 ${
        isCompleted ? "bg-emerald-50/30" : ""
      }`}
    >
      {/* Period badge */}
      <TableCell className="pl-4">
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-black ${badgeColor}`}
        >
          P{period.periodNumber}
        </span>
      </TableCell>

      {/* Time */}
      <TableCell>
        <span className="text-sm font-semibold text-slate-700">{period.startTime}</span>
        <span className="text-xs text-slate-400 ml-0.5">– {period.endTime}</span>
      </TableCell>

      {/* Class / Subject */}
      <TableCell>
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-800">
              {classLabel || "Class"}
            </span>
            {bookLabel && (
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
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
            <p className="text-xs text-slate-400 font-medium truncate max-w-[280px]">
              {entry.notes}
            </p>
          )}
          {entry.topicsCovered && entry.topicsCovered.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {entry.topicsCovered.map((t, i) => (
                <span
                  key={i}
                  className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-semibold"
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
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
            <CheckCircle2 size={12} /> Done
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-full">
            <Clock size={12} /> Sched
          </span>
        )}
      </TableCell>

      {/* Actions */}
      <TableCell className="text-right pr-4">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onEditClick}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          {!isCompleted && (
            <button
              onClick={onCompleteClick}
              className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors"
              title="Mark done"
            >
              <Check size={14} />
            </button>
          )}
        </div>
      </TableCell>
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
    <TableRow className="border-l-[3px] border-l-transparent hover:bg-indigo-50/30 transition-colors border-b border-slate-100 group">
      {/* Period badge */}
      <TableCell className="pl-4">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-400 text-xs font-black">
          P{period.periodNumber}
        </span>
      </TableCell>

      {/* Time */}
      <TableCell>
        <span className="text-sm font-semibold text-slate-400">{period.startTime}</span>
        <span className="text-xs text-slate-300 ml-0.5">– {period.endTime}</span>
      </TableCell>

      {/* Empty label */}
      <TableCell>
        <span className="text-sm text-slate-400 italic">No class scheduled</span>
      </TableCell>

      {/* Status */}
      <TableCell className="hidden sm:table-cell">
        <span className="text-[11px] text-slate-300 font-medium">&mdash;</span>
      </TableCell>

      {/* Add button */}
      <TableCell className="text-right pr-4">
        <button
          onClick={onAddClick}
          className="p-1.5 rounded-lg bg-indigo-50 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700 transition-colors opacity-0 group-hover:opacity-100"
          title="Add class"
        >
          <Plus size={14} />
        </button>
      </TableCell>
    </TableRow>
  );
}
