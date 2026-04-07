import type { IMonthSummary } from "@/types/timetable";
import { Skeleton } from "@/components/ui/skeleton";

const DAY_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

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
      <div className="p-3">
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Day header */}
      <div className="grid grid-cols-7 px-2">
        {DAY_SHORT.map((day, i) => (
          <div
            key={day}
            className={`py-2 text-center text-[11px] font-bold uppercase tracking-wider ${
              workingDays.includes(i) ? "text-slate-500" : "text-slate-300"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 px-2 pb-3">
        {grid.flatMap((week, wi) =>
          week.map((date, di) => {
            if (!date) {
              return (
                <div key={`${wi}-${di}`} className="h-11" />
              );
            }

            const dow = date.getDay();
            const isWorking = workingDays.includes(dow);
            const dateKey = formatDateKey(date);
            const isToday = dateKey === todayKey;
            const isSelected = dateKey === selectedKey;
            const summary = monthData[dateKey];

            return (
              <button
                key={dateKey}
                onClick={() => isWorking && onDateClick(date)}
                disabled={!isWorking}
                className={`h-11 flex flex-col items-center justify-center rounded-lg transition-all relative ${
                  isWorking
                    ? "hover:bg-indigo-50 cursor-pointer"
                    : "cursor-default"
                } ${
                  isSelected
                    ? "bg-indigo-50 ring-2 ring-indigo-500"
                    : ""
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                    isToday
                      ? "bg-indigo-600 text-white"
                      : isSelected
                        ? "text-indigo-700 font-extrabold"
                        : isWorking
                          ? "text-slate-700"
                          : "text-slate-300"
                  }`}
                >
                  {date.getDate()}
                </span>

                {/* Dot indicators */}
                {summary && (
                  <div className="flex items-center gap-0.5 absolute bottom-0.5">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        summary.hasCompleted ? "bg-emerald-500" : "bg-indigo-400"
                      }`}
                    />
                    {summary.entryCount > 1 && (
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          summary.hasCompleted ? "bg-emerald-400" : "bg-indigo-300"
                        }`}
                      />
                    )}
                    {summary.entryCount > 3 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-300" />
                    )}
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
