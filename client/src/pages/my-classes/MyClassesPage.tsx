import { useState, useEffect } from "react";
import { MonthCalendar } from "./components/MonthCalendar";
import { DayView } from "./components/DayView";
import { usePeriodConfig } from "./hooks/usePeriodConfig";
import { useTimetableMonth } from "./hooks/useTimetableMonth";
import { useStaffTimetableMonth } from "./hooks/useStaffTimetableMonth";
import { useStaffList } from "./hooks/useStaffList";
import { useAuthStore } from "@/store/userAuthStore";
import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { ChevronLeft, ChevronRight, Sparkles, Building2, Users, Download, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMonthlyReportDownload } from "./hooks/useMonthlyReportDownload";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const today = new Date();

export default function MyClassesPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin";
  const isAdminRole = isSuperAdmin || isAdmin;

  // Admin state
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string>("");
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");

  // Calendar state
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [currentMonth, setCurrentMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  });

  // Derive institution ID for admin (from their auth)
  const adminInstitutionId = isAdmin
    ? (typeof user?.institutionId === "object" ?  user?.institutionId?._id : user?.institutionId) || ""
    : "";
  const effectiveInstitutionId = isSuperAdmin ? selectedInstitutionId : adminInstitutionId;

  // Institutions list (super admin only)
  const { data: institutions = [] } = useQuery<{ _id: string; name: string }[]>({
    queryKey: ["institutions-list"],
    queryFn: async () => {
      const res = await _axios.get("/admin/institutions");
      return res.data?.data ?? [];
    },
    enabled: isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });

  // Staff list for the selected institution (admin/super_admin)
  const { data: staffList = [], isLoading: staffLoading } = useStaffList(
    isAdminRole ? effectiveInstitutionId || null : null
  );

  // Auto-select first institution for super admin
  useEffect(() => {
    if (isSuperAdmin && institutions.length > 0 && !selectedInstitutionId) {
      setSelectedInstitutionId(institutions[0]._id);
    }
  }, [isSuperAdmin, institutions, selectedInstitutionId]);

  // Auto-select first teacher for admin/super admin
  useEffect(() => {
    if (isAdminRole && staffList.length > 0 && !selectedStaffId) {
      setSelectedStaffId(staffList[0]._id);
    }
  }, [isAdminRole, staffList, selectedStaffId]);

  // Teacher mode hooks
  const { data: periodConfig, isLoading: configLoading } = usePeriodConfig();
  const { data: ownMonthData, isLoading: ownMonthLoading } = useTimetableMonth(
    currentMonth.year,
    currentMonth.month
  );

  // Admin mode hooks
  const { data: staffMonthData, isLoading: staffMonthLoading } = useStaffTimetableMonth(
    isAdminRole && selectedStaffId ? selectedStaffId : null,
    isAdminRole ? effectiveInstitutionId || null : null,
    currentMonth.year,
    currentMonth.month
  );

  // Determine which data to use
  const monthData = isAdminRole ? staffMonthData : ownMonthData;
  const monthLoading = isAdminRole ? staffMonthLoading : ownMonthLoading;
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

  const noPeriodConfig = !isAdminRole && !configLoading && !periodConfig;
  const selectedTeacher = staffList.find((s) => s._id === selectedStaffId);
  const { downloadReport, isDownloading } = useMonthlyReportDownload();

  // For admin roles, show timetable only when a teacher is selected
  const showTimetable = isAdminRole ? !!selectedStaffId : !noPeriodConfig;

  return (
    <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto">
      {/* Page Header */}
      {/* Admin Selectors */}
      {isAdminRole && (
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          {/* Institution selector (super admin only) */}
          {isSuperAdmin && (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                <Building2 size={18} />
              </div>
              <Select
                value={selectedInstitutionId}
                onValueChange={(v) => {
                  setSelectedInstitutionId(v);
                  setSelectedStaffId("");
                }}
              >
                <SelectTrigger className="w-64 rounded-xl">
                  <SelectValue placeholder="Select Institution" />
                </SelectTrigger>
                <SelectContent>
                  {institutions.map((inst) => (
                    <SelectItem key={inst._id} value={inst._id}>
                      {inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Teacher selector */}
          {(isAdmin || (isSuperAdmin && selectedInstitutionId)) && (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg text-violet-600">
                <Users size={18} />
              </div>
              <Select
                value={selectedStaffId}
                onValueChange={setSelectedStaffId}
                disabled={staffLoading}
              >
                <SelectTrigger className="w-64 rounded-xl">
                  <SelectValue placeholder={staffLoading ? "Loading teachers..." : "Select Teacher"} />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((staff) => (
                    <SelectItem key={staff._id} value={staff._id}>
                      {staff.name} - {staff.type === "teacher" ? "Teacher" : "Admin"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* No period config warning (teacher mode) */}
      {noPeriodConfig && (
        <div className="neo-card-flat bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <p className="text-amber-800 font-semibold">Period schedule not configured</p>
          <p className="text-amber-600 text-sm mt-1">
            Ask your admin to set up the period/bell schedule in Settings &rarr; Academic.
          </p>
        </div>
      )}

      {/* Admin mode: prompt to select teacher */}
      {isAdminRole && !selectedStaffId && (
        <div className="neo-card-flat rounded-2xl p-12 text-center">
          <Users className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-600 font-semibold text-lg">
            {isSuperAdmin && !selectedInstitutionId
              ? "Select an institution to get started"
              : "Select a teacher to view their timetable"}
          </p>
        </div>
      )}

      {/* Selected teacher info banner */}
      {isAdminRole && selectedTeacher && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 neo-card-flat bg-violet-50 border border-violet-200 rounded-xl">
          <div className="h-8 w-8 rounded-full bg-violet-200 flex items-center justify-center text-violet-700 font-bold text-sm">
            {selectedTeacher.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-violet-900">{selectedTeacher.name}</p>
            <p className="text-xs text-violet-600">{selectedTeacher.email}</p>
          </div>
        </div>
      )}

      {showTimetable && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT: Calendar Panel */}
          <div className="lg:col-span-2 lg:sticky lg:top-8 self-start space-y-4">
            {/* Calendar card */}
            <div className="neo-card border-2 border-indigo-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[var(--neo-bg-alt)] via-[var(--neo-bg-alt)] to-indigo-50/40">
              {/* Colorful header band */}
              <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 px-5 py-4">
                <div className="flex items-center justify-between">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1.5 rounded-lg hover:bg-white/20 text-white/90 hover:text-white transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div className="text-center">
                    <h3 className="text-lg font-extrabold text-white tracking-wide">
                      {MONTH_NAMES[currentMonth.month - 1]}
                    </h3>
                    <p className="text-sm font-medium text-white/90 tracking-widest">
                      {currentMonth.year}
                    </p>
                  </div>
                  <button
                    onClick={handleNextMonth}
                    className="p-1.5 rounded-lg hover:bg-white/20 text-white/90 hover:text-white transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>

              {/* Calendar body */}
              <MonthCalendar
                year={currentMonth.year}
                month={currentMonth.month}
                monthData={monthData?.dates || {}}
                workingDays={workingDays}
                selectedDate={selectedDate}
                onDateClick={handleDateClick}
                isLoading={monthLoading}
              />

              {/* Today button footer */}
              <div className="px-4 pb-4 pt-1">
                <button
                  onClick={handleToday}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 border-2 border-indigo-300 text-indigo-600 text-sm font-bold hover:from-indigo-100 hover:to-violet-100 transition-all"
                >
                  <Sparkles size={14} />
                  Jump to Today
                </button>
              </div>
            </div>

            {/* Mini stats card */}
            {monthData?.dates && (
              <MiniMonthStats monthData={monthData.dates} />
            )}

            {/* Download Report button */}
            <button
              onClick={() =>
                downloadReport({
                  year: currentMonth.year,
                  month: currentMonth.month,
                  staffId: isAdminRole ? selectedStaffId : null,
                  institutionId: isAdminRole ? effectiveInstitutionId : null,
                })
              }
              disabled={isDownloading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-300/30 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isDownloading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {isDownloading ? "Generating Report..." : "Download Monthly Report"}
            </button>
          </div>

          {/* RIGHT: Schedule Panel */}
          <div className="lg:col-span-3">
            <DayView
              date={selectedDate}
              readOnly={isAdminRole}
              staffId={isAdminRole ? selectedStaffId : undefined}
              institutionId={isAdminRole ? effectiveInstitutionId : undefined}
              fallbackPeriodConfig={periodConfig}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Mini Month Stats ─── */
function MiniMonthStats({ monthData }: { monthData: Record<string, { entryCount: number; hasCompleted: boolean }> }) {
  const dates = Object.values(monthData);
  const totalClasses = dates.reduce((sum, d) => sum + d.entryCount, 0);
  const completedDays = dates.filter((d) => d.hasCompleted).length;
  const activeDays = dates.length;

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="neo-card-flat bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl border-2 border-indigo-300 p-3 text-center">
        <p className="text-2xl font-extrabold text-indigo-600">{totalClasses}</p>
        <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mt-0.5">Classes</p>
      </div>
      <div className="neo-card-flat bg-gradient-to-br from-emerald-50 to-cyan-50 rounded-xl border-2 border-emerald-400 p-3 text-center">
        <p className="text-2xl font-extrabold text-emerald-600">{completedDays}</p>
        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mt-0.5">Done Days</p>
      </div>
      <div className="neo-card-flat bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 border-amber-400 p-3 text-center">
        <p className="text-2xl font-extrabold text-amber-600">{activeDays}</p>
        <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mt-0.5">Active Days</p>
      </div>
    </div>
  );
}
