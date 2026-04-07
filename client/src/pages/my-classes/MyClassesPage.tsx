import { useState } from "react";
import { MonthCalendar } from "./components/MonthCalendar";
import { DayView } from "./components/DayView";
import { usePeriodConfig } from "./hooks/usePeriodConfig";
import { useTimetableMonth } from "./hooks/useTimetableMonth";
import { CalendarDays, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const today = new Date();

export default function MyClassesPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [currentMonth, setCurrentMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  });

  const { data: periodConfig, isLoading: configLoading } = usePeriodConfig();
  const { data: monthData, isLoading: monthLoading } = useTimetableMonth(
    currentMonth.year,
    currentMonth.month
  );

  const workingDays = periodConfig?.workingDays || [1, 2, 3, 4, 5];

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    const clickedMonth = date.getMonth() + 1;
    const clickedYear = date.getFullYear();
    if (clickedMonth !== currentMonth.month || clickedYear !== currentMonth.year) {
      setCurrentMonth({ year: clickedYear, month: clickedMonth });
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 1) return { year: prev.year - 1, month: 12 };
      return { ...prev, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 12) return { year: prev.year + 1, month: 1 };
      return { ...prev, month: prev.month + 1 };
    });
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() + 1 });
    setSelectedDate(now);
  };

  const noPeriodConfig = !configLoading && !periodConfig;

  return (
    <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold flex items-center gap-3 tracking-tight">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl text-white shadow-lg shadow-indigo-300/30">
            <CalendarDays className="h-6 w-6" />
          </div>
          My Timetable
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your class schedule and track teaching activity
        </p>
      </div>

      {noPeriodConfig && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <p className="text-amber-800 font-semibold">Period schedule not configured</p>
          <p className="text-amber-600 text-sm mt-1">
            Ask your admin to set up the period/bell schedule in Settings &rarr; Academic.
          </p>
        </div>
      )}

      {!noPeriodConfig && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT: Calendar Panel */}
          <div className="lg:col-span-2 lg:sticky lg:top-8 self-start">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Month navigation header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold text-slate-800 tracking-wide">
                    {MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToday}
                    className="h-7 px-2.5 text-[11px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg gap-1"
                  >
                    <Calendar size={12} />
                    Today
                  </Button>
                </div>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <MonthCalendar
                year={currentMonth.year}
                month={currentMonth.month}
                monthData={monthData?.dates || {}}
                workingDays={workingDays}
                selectedDate={selectedDate}
                onDateClick={handleDateClick}
                isLoading={monthLoading}
              />
            </div>
          </div>

          {/* RIGHT: Schedule Panel */}
          <div className="lg:col-span-3">
            <DayView date={selectedDate} />
          </div>
        </div>
      )}
    </div>
  );
}
