import type { IMonthSummary } from "@/types/timetable";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2 } from "lucide-react";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface MonthCalendarProps {
  year: number;
  month: number; // 1-12
  monthData: IMonthSummary;
  workingDays: number[];
  selectedDate: Date | null;
  onDateClick: (date: Date) => void;
  isLoading: boolean;
}

function generateCalendarGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDow = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const grid: (Date | null)[][] = [];
  let currentDay = 1;

  for (let week = 0; week < 6; week++) {
    const row: (Date | null)[] = [];
    for (let dow = 0; dow < 7; dow++) {
      if ((week === 0 && dow < startDow) || currentDay > totalDays) {
        row.push(null);
      } else {
        row.push(new Date(year, month - 1, currentDay));
        currentDay++;
      }
    }
    grid.push(row);
    if (currentDay > totalDays) break;
  }
  return grid;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const today = new Date();
today.setHours(0, 0, 0, 0);
const todayKey = formatDateKey(today);

export function MonthCalendar({
  year,
  month,
  monthData,
  workingDays,
  selectedDate,
  onDateClick,
  isLoading,
}: MonthCalendarProps) {
  const grid = generateCalendarGrid(year, month);
  const selectedKey = selectedDate ? formatDateKey(selectedDate) : null;

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-3 pb-2">
      {/* Day header row */}
      <div className="grid grid-cols-7 mb-2">
        {DAY_SHORT.map((day) => (
          <div
            key={day}
            className="py-1.5 text-center text-[11px] font-extrabold uppercase tracking-widest text-indigo-900"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {grid.flatMap((week, wi) =>
          week.map((date, di) => {
            if (!date) {
              return <div key={`${wi}-${di}`} className="h-12" />;
            }

            const dow = date.getDay();
            const isWorking = workingDays.includes(dow);
            const dateKey = formatDateKey(date);
            const isToday = dateKey === todayKey;
            const isPast = date < today && !isToday;
            const isSelected = dateKey === selectedKey;
            const summary = monthData[dateKey];
            const hasEntries = summary && summary.entryCount > 0;
            const hasCompleted = summary?.hasCompleted;

            return (
              <button
                key={dateKey}
                onClick={() => onDateClick(date)}
                className={`
                  h-12 flex flex-col items-center justify-center rounded-xl transition-all duration-200 relative cursor-pointer
                  ${
                    isSelected
                      ? "bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[3px_3px_8px_rgba(0,0,0,0.15),-2px_-2px_6px_rgba(255,255,255,0.7),0_0_20px_rgba(99,102,241,0.3)] scale-110 border border-white/30 z-10"
                      : isToday
                        ? "bg-gradient-to-145 from-[var(--neo-bg-alt)] to-[var(--neo-bg-dark)] shadow-[3px_3px_8px_var(--neo-shadow-dark),-3px_-3px_8px_var(--neo-shadow-light)] ring-2 ring-indigo-400 border border-white/40"
                        : isPast
                          ? "bg-[var(--neo-bg-dark)]/40 border border-white/10 opacity-50 hover:opacity-70"
                          : hasCompleted
                            ? "bg-gradient-to-145 from-[var(--neo-bg-alt)] to-[var(--neo-bg-dark)] shadow-[3px_3px_8px_var(--neo-shadow-dark),-3px_-3px_8px_var(--neo-shadow-light)] border border-emerald-300/60 hover:shadow-[4px_4px_12px_var(--neo-shadow-dark),-4px_-4px_12px_var(--neo-shadow-light),0_0_12px_rgba(16,185,129,0.2)] hover:scale-105"
                            : hasEntries
                              ? "bg-gradient-to-145 from-[var(--neo-bg-alt)] to-[var(--neo-bg-dark)] shadow-[3px_3px_8px_var(--neo-shadow-dark),-3px_-3px_8px_var(--neo-shadow-light)] border border-indigo-300/60 hover:shadow-[4px_4px_12px_var(--neo-shadow-dark),-4px_-4px_12px_var(--neo-shadow-light),0_0_12px_rgba(99,102,241,0.2)] hover:scale-105"
                              : "bg-gradient-to-145 from-[var(--neo-bg-alt)] to-[var(--neo-bg-dark)] shadow-[2px_2px_5px_var(--neo-shadow-dark),-2px_-2px_5px_var(--neo-shadow-light)] border border-white/30 hover:shadow-[3px_3px_8px_var(--neo-shadow-dark),-3px_-3px_8px_var(--neo-shadow-light)] hover:scale-[1.03] active:shadow-[inset_2px_2px_5px_var(--neo-shadow-dark),inset_-2px_-2px_5px_var(--neo-shadow-light)] active:scale-[0.97]"
                  }
                  ${!isWorking && !isSelected ? "opacity-80" : ""}
                `}
              >
                {/* Date number */}
                <span
                  className={`text-[15px] font-extrabold leading-none ${
                    isSelected
                      ? "text-white"
                      : isToday
                        ? "text-indigo-800"
                        : hasCompleted
                          ? "text-emerald-800"
                          : hasEntries
                            ? "text-indigo-800"
                            : "text-slate-900"
                  }`}
                >
                  {date.getDate()}
                </span>

                {/* Activity indicator */}
                {hasEntries && !isSelected && (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {hasCompleted ? (
                      <CheckCircle2 size={10} className="text-emerald-500" />
                    ) : (
                      <>
                        {Array.from({ length: Math.min(summary.entryCount, 4) }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-1 h-1 rounded-full ${
                              i === 0 ? "bg-indigo-500" : i === 1 ? "bg-violet-500" : i === 2 ? "bg-purple-400" : "bg-fuchsia-400"
                            }`}
                          />
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* Selected date indicator for entries */}
                {isSelected && hasEntries && (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    <div className="w-1 h-1 rounded-full bg-white/80" />
                    <div className="w-1 h-1 rounded-full bg-white/60" />
                    {summary!.entryCount > 2 && <div className="w-1 h-1 rounded-full bg-white/40" />}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
