import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, ChevronLeft, ChevronRight, Building2, Users, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

import { useAuthStore } from "@/store/userAuthStore";
import { _axios } from "@/lib/axios";
import { useStaffList } from "@/pages/my-classes/hooks/useStaffList";
import { MonthCalendar } from "@/pages/my-classes/components/MonthCalendar";
import type { IMonthSummary } from "@/types/timetable";

import { useLessonPlans } from "./hooks/useLessonPlans";
import { useUpdateLessonPlan } from "./hooks/useUpdateLessonPlan";
import { useDeleteLessonPlan } from "./hooks/useDeleteLessonPlan";
import { LessonPlanCard } from "./components/LessonPlanCard";
import { LessonPlanFormDialog } from "./components/LessonPlanFormDialog";
import type { LessonPlan, PlanStatus } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const today = new Date();

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * LessonPlansPage
 *
 * Calendar-based lesson plan view. Left panel: month calendar with dots on
 * days that have plans. Right panel: list of plans for the selected day.
 *
 * Requirements: 1.1, 2.1–2.7, 7.6, 9.1–9.4
 */
export default function LessonPlansPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin";
  const isAdminRole = isSuperAdmin || isAdmin;

  // ── Admin selectors ────────────────────────────────────────────────────────
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");

  const adminInstitutionId = isAdmin
    ? (typeof user?.institutionId === "object"
        ? (user?.institutionId as { _id: string })?._id
        : user?.institutionId) ?? ""
    : "";
  const effectiveInstitutionId = isSuperAdmin
    ? selectedInstitutionId
    : adminInstitutionId;

  const { data: institutions = [] } = useQuery<{ _id: string; name: string }[]>({
    queryKey: ["institutions-list"],
    queryFn: async () => {
      const res = await _axios.get("/admin/institutions");
      return res.data?.data ?? [];
    },
    enabled: isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const { data: staffList = [], isLoading: staffLoading } = useStaffList(
    isAdminRole ? effectiveInstitutionId || null : null,
  );

  useEffect(() => {
    if (isSuperAdmin && institutions.length > 0 && !selectedInstitutionId) {
      setSelectedInstitutionId(institutions[0]._id);
    }
  }, [isSuperAdmin, institutions, selectedInstitutionId]);

  // ── Calendar state ─────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [currentMonth, setCurrentMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  });

  // ── Status filter ──────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<PlanStatus | "all">("all");

  // ── Dialog state ───────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingPlan, setEditingPlan] = useState<LessonPlan | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Data fetching — fetch the whole month ──────────────────────────────────
  const queryParams = {
    ...(isAdminRole && selectedStaffId ? { teacherId: selectedStaffId } : {}),
    ...(isSuperAdmin && selectedInstitutionId
      ? { institutionId: selectedInstitutionId }
      : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    year: currentMonth.year,
    month: currentMonth.month,
  };

  const { data: plans = [], isLoading } = useLessonPlans(queryParams);

  // ── Build IMonthSummary for the calendar ───────────────────────────────────
  const monthSummary = useMemo<IMonthSummary>(() => {
    const summary: IMonthSummary = {};
    for (const plan of plans) {
      const key = plan.date; // already YYYY-MM-DD
      if (!summary[key]) {
        summary[key] = { entryCount: 0, hasCompleted: false };
      }
      summary[key].entryCount += 1;
      if (plan.status === "completed") {
        summary[key].hasCompleted = true;
      }
    }
    return summary;
  }, [plans]);

  // ── Plans for the selected day ─────────────────────────────────────────────
  const selectedDateKey = formatDateKey(selectedDate);
  const plansForDay = useMemo(
    () => plans.filter((p) => p.date === selectedDateKey),
    [plans, selectedDateKey],
  );

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateMutation = useUpdateLessonPlan();
  const deleteMutation = useDeleteLessonPlan();

  // ── Calendar navigation ────────────────────────────────────────────────────
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    const m = date.getMonth() + 1;
    const y = date.getFullYear();
    if (m !== currentMonth.month || y !== currentMonth.year) {
      setCurrentMonth({ year: y, month: m });
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

  // ── Plan handlers ──────────────────────────────────────────────────────────
  const handleNewPlan = () => {
    setEditingPlan(null);
    setFormMode("create");
    setFormOpen(true);
  };

  const handleEdit = (id: string) => {
    const plan = plans.find((p) => p.id === id);
    if (!plan) return;
    setEditingPlan(plan);
    setFormMode("edit");
    setFormOpen(true);
  };

  const handleStatusChange = (id: string, status: PlanStatus) => {
    updateMutation.mutate({ id, status });
  };

  const handleDeleteConfirm = () => {
    if (!deletingId) return;
    deleteMutation.mutate(deletingId, {
      onSuccess: () => setDeletingId(null),
    });
  };

  const isReadOnly = isAdminRole;

  // ── Selected day label ─────────────────────────────────────────────────────
  const selectedDayLabel = selectedDate.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Lesson Plans</h1>
        <div className="flex items-center gap-3">
          {/* Status filter */}
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as PlanStatus | "all")}
          >
            <SelectTrigger className="w-36 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          {!isReadOnly && (
            <Button
              onClick={handleNewPlan}
              className="rounded-xl bg-brand-color hover:bg-brand-color/90 shadow-lg shadow-indigo-500/30"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Lesson Plan
            </Button>
          )}
        </div>
      </div>

      {/* ── Admin selectors ──────────────────────────────────────────────── */}
      {isAdminRole && (
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
                  <SelectValue
                    placeholder={
                      staffLoading ? "Loading teachers…" : "Select Teacher"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* ── Main layout: calendar left + day panel right ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── LEFT: Calendar panel ──────────────────────────────────────── */}
        <div className="lg:col-span-2 lg:sticky lg:top-8 self-start space-y-4">
          <div className="neo-card border-2 border-indigo-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[var(--neo-bg-alt)] via-[var(--neo-bg-alt)] to-indigo-50/40">

            {/* Calendar header band */}
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

            {/* Calendar grid */}
            <MonthCalendar
              year={currentMonth.year}
              month={currentMonth.month}
              monthData={monthSummary}
              workingDays={[0, 1, 2, 3, 4, 5, 6]} // all days are valid for lesson plans
              selectedDate={selectedDate}
              onDateClick={handleDateClick}
              isLoading={isLoading}
            />

            {/* Today button */}
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

          {/* Month summary mini-stats */}
          {plans.length > 0 && (
            <MonthStats plans={plans} />
          )}
        </div>

        {/* ── RIGHT: Day panel ──────────────────────────────────────────── */}
        <div className="lg:col-span-3">
          <div className="neo-card rounded-2xl overflow-hidden">
            {/* Day header */}
            <div className="px-5 py-4 border-b border-white/20 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Selected Day
                </p>
                <h2 className="text-base font-bold text-foreground mt-0.5">
                  {selectedDayLabel}
                </h2>
              </div>
              {!isReadOnly && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl gap-1.5 text-xs"
                  onClick={handleNewPlan}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Plan
                </Button>
              )}
            </div>

            {/* Plans for the day */}
            <div className="p-4">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <span className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0ms]" />
                    <span className="h-2 w-2 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
                    <span className="h-2 w-2 rounded-full bg-purple-400 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              ) : plansForDay.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                  <p className="text-sm font-medium text-muted-foreground">
                    No lesson plans for this day
                  </p>
                  {!isReadOnly && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-xs gap-1.5"
                      onClick={handleNewPlan}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create one
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {plansForDay.map((plan) => (
                    <div
                      key={plan.id}
                      onClick={() =>
                        navigate({ to: "/lesson-plans/$id", params: { id: plan.id } })
                      }
                      className="cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate({ to: "/lesson-plans/$id", params: { id: plan.id } });
                        }
                      }}
                    >
                      <LessonPlanCard
                        plan={plan}
                        onEdit={handleEdit}
                        onDelete={(id) => setDeletingId(id)}
                        onStatusChange={handleStatusChange}
                        readOnly={isReadOnly}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Create / Edit dialog ─────────────────────────────────────────── */}
      <LessonPlanFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        planId={editingPlan?.id}
        selectedDate={formMode === "create" ? selectedDateKey : undefined}
        initialValues={
          editingPlan
            ? {
                title: editingPlan.title,
                subject: editingPlan.subject,
                gradeOrClass: editingPlan.gradeOrClass,
                date: editingPlan.date,
                durationMinutes: editingPlan.durationMinutes,
                learningObjectives: editingPlan.learningObjectives ?? "",
                materialsNeeded: editingPlan.materialsNeeded ?? "",
                introduction: editingPlan.introduction ?? "",
                mainActivity: editingPlan.mainActivity ?? "",
                conclusion: editingPlan.conclusion ?? "",
                assessmentMethod: editingPlan.assessmentMethod ?? "",
                homeworkNotes: editingPlan.homeworkNotes ?? "",
                gradeBookId:
                  typeof editingPlan.gradeBookId === "object" && editingPlan.gradeBookId
                    ? (editingPlan.gradeBookId as { id: string }).id
                    : (editingPlan.gradeBookId as string) ?? "",
                chapterId:
                  typeof editingPlan.chapterId === "object" && editingPlan.chapterId
                    ? (editingPlan.chapterId as { id: string }).id
                    : (editingPlan.chapterId as string) ?? "",
                status: editingPlan.status,
              }
            : undefined
        }
      />

      {/* ── Delete confirmation ──────────────────────────────────────────── */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lesson Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The lesson plan will be permanently
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Month stats mini-card ────────────────────────────────────────────────────

function MonthStats({ plans }: { plans: LessonPlan[] }) {
  const total = plans.length;
  const completed = plans.filter((p) => p.status === "completed").length;
  const draft = plans.filter((p) => p.status === "draft").length;

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="neo-card-flat bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl border-2 border-indigo-300 p-3 text-center">
        <p className="text-2xl font-extrabold text-indigo-600">{total}</p>
        <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mt-0.5">
          Total
        </p>
      </div>
      <div className="neo-card-flat bg-gradient-to-br from-emerald-50 to-cyan-50 rounded-xl border-2 border-emerald-400 p-3 text-center">
        <p className="text-2xl font-extrabold text-emerald-600">{completed}</p>
        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mt-0.5">
          Done
        </p>
      </div>
      <div className="neo-card-flat bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 border-amber-400 p-3 text-center">
        <p className="text-2xl font-extrabold text-amber-600">{draft}</p>
        <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mt-0.5">
          Draft
        </p>
      </div>
    </div>
  );
}
