import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import {
  TrendingUp,
  Search,
  Building,
  GraduationCap,
  Users,
  CheckCircle,
  PlayCircle,
  BookOpen,
  Filter,
  RefreshCw,
  Award,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Calendar,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface SchoolOverviewItem {
  id: string;
  name: string;
  isActive: boolean;
  studentsCount: number;
  staffCount: number;
  classesCount: number;
  completionRate: number;
}

interface KPI {
  totalClasses: number;
  ongoingClasses: number;
  completedClasses: number;
  overallCompletionRate: number;
}

interface ChartData {
  distribution: { name: string; value: number }[];
  contentTypeData: { name: string; value: number }[];
}

interface DetailedClassProgress {
  classId: string;
  className: string;
  courseId: string;
  courseTitle: string;
  teacherId: string | null;
  teacherName: string;
  totalChapters: number;
  completedChapters: number;
  totalSubchapters: number;
  completedSubchapters: number;
  progressPercentage: number;
  lastAccessedAt: string | null;
}

interface TeacherLeaderboardItem {
  id: string;
  name: string;
  totalAssigned: number;
  completed: number;
  total: number;
  avgProgress: number;
}

interface SchoolProgressPageProps {
  initialSchoolId?: string;
  lockedToSchool?: boolean;
}

const COLORS = ["#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];

export default function SchoolProgressPage({ initialSchoolId, lockedToSchool }: SchoolProgressPageProps) {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(initialSchoolId || null);

  // Class filters & pagination
  const [classSearch, setClassSearch] = useState("");
  const [classCourse, setClassCourse] = useState("all");
  const [classStatus, setClassStatus] = useState("all");
  const [classPage, setClassPage] = useState(1);

  // Teacher filters & pagination
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teacherPage, setTeacherPage] = useState(1);

  const [activeTab, setActiveTab] = useState<"classes" | "teachers">("classes");

  // Date / class filters
  const [classFilter, setClassFilter] = useState("all");
  const [datePreset, setDatePreset] = useState("all");  // all | today | week | month | custom
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Compute dateFrom/dateTo from preset
  const getDateRange = () => {
    const now = new Date();
    if (datePreset === "today") {
      const d = now.toISOString().slice(0, 10);
      return { from: d, to: d };
    } else if (datePreset === "week") {
      const day = now.getDay();
      const mon = new Date(now);
      mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) };
    } else if (datePreset === "month") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      return { from, to };
    } else if (datePreset === "custom") {
      return { from: dateFrom, to: dateTo };
    }
    return { from: "", to: "" };
  };

  // Query: Schools Overview list
  const schoolsQuery = useQuery<SchoolOverviewItem[]>({
    queryKey: ["school-progress-schools"],
    queryFn: async () => {
      const res = await _axios.get("/admin/school-progress/schools");
      return res.data.data;
    },
    enabled: selectedSchoolId === null,
  });

  // Query: Classes list (for class filter dropdown)
  const classListQuery = useQuery<{ id: string; label: string }[]>({
    queryKey: ["school-progress-classes-list", selectedSchoolId],
    queryFn: async () => {
      const res = await _axios.get(`/admin/school-progress/classes-list?institutionId=${selectedSchoolId}`);
      return res.data.data;
    },
    enabled: selectedSchoolId !== null,
  });

  // Query: Courses metadata list (only when a school is selected)
  const coursesQuery = useQuery<{ id: string; title: string }[]>({
    queryKey: ["school-progress-courses", selectedSchoolId],
    queryFn: async () => {
      const res = await _axios.get(`/admin/school-progress/courses?institutionId=${selectedSchoolId}`);
      return res.data.data;
    },
    enabled: selectedSchoolId !== null,
  });

  // Query: KPIs for the selected school
  const kpisQuery = useQuery<KPI>({
    queryKey: ["school-progress-kpis", selectedSchoolId],
    queryFn: async () => {
      const res = await _axios.get(`/admin/school-progress/kpis?institutionId=${selectedSchoolId}`);
      return res.data.data;
    },
    enabled: selectedSchoolId !== null,
  });

  // Query: Charts for the selected school
  const chartsQuery = useQuery<ChartData>({
    queryKey: ["school-progress-charts", selectedSchoolId],
    queryFn: async () => {
      const res = await _axios.get(`/admin/school-progress/charts?institutionId=${selectedSchoolId}`);
      return res.data.data;
    },
    enabled: selectedSchoolId !== null,
  });

  // Query: Paginated Classes
  const classesQuery = useQuery<{ items: DetailedClassProgress[]; total: number }>({
    queryKey: ["school-progress-classes", selectedSchoolId, classPage, classSearch, classCourse, classStatus, classFilter, datePreset, dateFrom, dateTo],
    queryFn: async () => {
      const range = getDateRange();
      const params = new URLSearchParams({
        institutionId: selectedSchoolId!,
        page: String(classPage),
        limit: "10",
        search: classSearch,
        courseId: classCourse,
        status: classStatus,
        classId: classFilter,
        dateFrom: range.from,
        dateTo: range.to,
      });
      const res = await _axios.get(`/admin/school-progress/classes?${params.toString()}`);
      return res.data.data;
    },
    enabled: selectedSchoolId !== null && activeTab === "classes",
  });

  // Query: Paginated Teachers Leaderboard
  const teachersQuery = useQuery<{ items: TeacherLeaderboardItem[]; total: number }>({
    queryKey: ["school-progress-teachers", selectedSchoolId, teacherPage, teacherSearch],
    queryFn: async () => {
      const res = await _axios.get(
        `/admin/school-progress/teachers?institutionId=${selectedSchoolId}&page=${teacherPage}&limit=10&search=${teacherSearch}`
      );
      return res.data.data;
    },
    enabled: selectedSchoolId !== null && activeTab === "teachers",
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleBackToOverview = () => {
    setSelectedSchoolId(null);
    setClassSearch("");
    setClassCourse("all");
    setClassStatus("all");
    setClassPage(1);
    setTeacherSearch("");
    setTeacherPage(1);
    setActiveTab("classes");
  };

  // RENDER VIEW 1: Schools Grid Overview (only for super_admin)
  if (selectedSchoolId === null && !lockedToSchool) {
    return (
      <div className="p-6 lg:p-8 space-y-8 bg-slate-50/50 dark:bg-slate-950/20 min-h-screen">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Building className="h-6 w-6 text-indigo-600" />
              School-wise Progress
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Select an institution to view detailed curriculum progress reports, class statistics, and teacher performance.
            </p>
          </div>
          <button
            onClick={() => schoolsQuery.refetch()}
            disabled={schoolsQuery.isFetching}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium transition-all shadow-xs active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${schoolsQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {schoolsQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
            <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
            <p className="text-slate-500 font-medium">Loading schools overview...</p>
          </div>
        ) : schoolsQuery.isError ? (
          <div className="p-8 text-center bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-2xl max-w-lg mx-auto">
            <p className="text-red-700 dark:text-red-400 font-semibold mb-2">Error loading institutions</p>
            <button
              onClick={() => schoolsQuery.refetch()}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {schoolsQuery.data?.map((school) => (
              <button
                key={school.id}
                onClick={() => setSelectedSchoolId(school.id)}
                className="w-full text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-all group flex flex-col justify-between min-h-[200px]"
              >
                <div>
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base group-hover:text-indigo-600 transition-colors line-clamp-2">
                      {school.name}
                    </h3>
                    <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      school.isActive 
                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400" 
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}>
                      {school.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 text-slate-500 text-xs font-medium">
                    <div>
                      <p className="text-slate-400 mb-0.5">Classes</p>
                      <p className="text-slate-800 dark:text-slate-200 font-bold font-mono text-sm">{school.classesCount}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-0.5">Students</p>
                      <p className="text-slate-800 dark:text-slate-200 font-bold font-mono text-sm">{school.studentsCount}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-0.5">Staff</p>
                      <p className="text-slate-800 dark:text-slate-200 font-bold font-mono text-sm">{school.staffCount}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400">Curriculum Completion</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">{school.completionRate}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500 group-hover:bg-indigo-600"
                      style={{ width: `${school.completionRate}%` }}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // RENDER VIEW 2: Selected School Drilldown
  const activeSchoolName = lockedToSchool
    ? "My School Progress"
    : schoolsQuery.data?.find((s) => s.id === selectedSchoolId)?.name || "Institution Progress";
  const schoolKpis = kpisQuery.data;
  const schoolCharts = chartsQuery.data;

  return (
    <div className="p-6 lg:p-8 space-y-8 bg-slate-50/50 dark:bg-slate-950/20 min-h-screen">
      {/* Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {!lockedToSchool && (
            <button
              onClick={handleBackToOverview}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-wider mb-2 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Schools List
            </button>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-indigo-600" />
            {activeSchoolName}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Detailed view of classes curriculum completion and teacher performance statistics.
          </p>
        </div>
        <button
          onClick={() => {
            kpisQuery.refetch();
            chartsQuery.refetch();
            if (activeTab === "classes") classesQuery.refetch();
            else teachersQuery.refetch();
          }}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium transition-all shadow-xs"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Stats
        </button>
      </div>

      {/* School specific KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex justify-between items-center">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Classes</p>
            {kpisQuery.isLoading ? (
              <div className="h-7 w-12 bg-slate-100 dark:bg-slate-800 animate-pulse mt-2 rounded-md" />
            ) : (
              <h3 className="text-2xl font-extrabold mt-1 text-slate-900 dark:text-white font-mono">{schoolKpis?.totalClasses || 0}</h3>
            )}
          </div>
          <span className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Users className="h-5 w-5" />
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex justify-between items-center">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Ongoing Classes</p>
            {kpisQuery.isLoading ? (
              <div className="h-7 w-12 bg-slate-100 dark:bg-slate-800 animate-pulse mt-2 rounded-md" />
            ) : (
              <h3 className="text-2xl font-extrabold mt-1 text-slate-900 dark:text-white font-mono">{schoolKpis?.ongoingClasses || 0}</h3>
            )}
          </div>
          <span className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
            <PlayCircle className="h-5 w-5" />
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex justify-between items-center">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Completed Classes</p>
            {kpisQuery.isLoading ? (
              <div className="h-7 w-12 bg-slate-100 dark:bg-slate-800 animate-pulse mt-2 rounded-md" />
            ) : (
              <h3 className="text-2xl font-extrabold mt-1 text-slate-900 dark:text-white font-mono">{schoolKpis?.completedClasses || 0}</h3>
            )}
          </div>
          <span className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <CheckCircle className="h-5 w-5" />
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-indigo-500 text-white shadow-xs flex justify-between items-center">
          <div>
            <p className="text-white/80 text-xs font-semibold uppercase tracking-wider">School Progress</p>
            {kpisQuery.isLoading ? (
              <div className="h-7 w-12 bg-white/20 animate-pulse mt-2 rounded-md" />
            ) : (
              <h3 className="text-2xl font-extrabold mt-1 font-mono">{schoolKpis?.overallCompletionRate || 0}%</h3>
            )}
          </div>
          <span className="p-3 bg-white/20 text-white rounded-xl">
            <GraduationCap className="h-5 w-5" />
          </span>
        </div>
      </div>

      {/* School specific charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Bracket distribution */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col">
          <h3 className="text-base font-bold text-slate-800 dark:text-white mb-4">Class Progress distribution</h3>
          <div className="flex-1 min-h-[220px] max-h-[220px]">
            {chartsQuery.isLoading ? (
              <div className="w-full h-full bg-slate-50 dark:bg-slate-800 animate-pulse rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={0}>
                <BarChart data={schoolCharts?.distribution || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: "rgba(99, 102, 241, 0.05)" }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {(schoolCharts?.distribution || []).map((_: any, index: number) => (
                      <Cell key={index} fill={["#f59e0b", "#fb923c", "#6366f1", "#3b82f6", "#10b981", "#22c55e"][index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Content Type breakdown */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col">
          <h3 className="text-base font-bold text-slate-800 dark:text-white mb-4">Completed Items by Content Type</h3>
          <div className="flex-1 min-h-[220px] max-h-[220px] relative">
            {chartsQuery.isLoading ? (
              <div className="w-full h-full bg-slate-50 dark:bg-slate-800 animate-pulse rounded-lg" />
            ) : !schoolCharts?.contentTypeData || schoolCharts.contentTypeData.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                No content items completed yet in this school.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={0}>
                <PieChart>
                  <Pie
                    data={schoolCharts.contentTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {schoolCharts.contentTypeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Tab Select & Search Header */}
      <div className="space-y-4">
        {/* Tab Buttons */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab("classes")}
            className={`px-5 py-3 text-sm font-semibold tracking-wide border-b-2 transition-all cursor-pointer ${
              activeTab === "classes"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Class-wise Progress Details
          </button>
          <button
            onClick={() => setActiveTab("teachers")}
            className={`px-5 py-3 text-sm font-semibold tracking-wide border-b-2 transition-all cursor-pointer ${
              activeTab === "teachers"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Teacher Completion Leaderboard
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "classes" ? (
          <div className="space-y-4">
            {/* Class Filter bar — row 1: search + dropdowns */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by grade, section, course, or teacher..."
                    value={classSearch}
                    onChange={(e) => { setClassSearch(e.target.value); setClassPage(1); }}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Class Dropdown */}
                  <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300">
                    <Users className="h-4 w-4 text-slate-400 shrink-0" />
                    <select
                      value={classFilter}
                      onChange={(e) => { setClassFilter(e.target.value); setClassPage(1); }}
                      className="bg-transparent text-xs font-semibold focus:outline-hidden border-none cursor-pointer pr-1"
                    >
                      <option value="all">All Classes</option>
                      {classListQuery.data?.map((cl) => (
                        <option key={cl.id} value={cl.id}>{cl.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Course Dropdown */}
                  <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300">
                    <BookOpen className="h-4 w-4 text-slate-400 shrink-0" />
                    <select
                      value={classCourse}
                      onChange={(e) => { setClassCourse(e.target.value); setClassPage(1); }}
                      className="bg-transparent text-xs font-semibold focus:outline-hidden border-none cursor-pointer pr-1"
                    >
                      <option value="all">All Courses</option>
                      {coursesQuery.data?.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status Dropdown */}
                  <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300">
                    <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                    <select
                      value={classStatus}
                      onChange={(e) => { setClassStatus(e.target.value); setClassPage(1); }}
                      className="bg-transparent text-xs font-semibold focus:outline-hidden border-none cursor-pointer pr-1"
                    >
                      <option value="all">All Status</option>
                      <option value="not_started">Not Started (0%)</option>
                      <option value="ongoing">Ongoing (1-99%)</option>
                      <option value="completed">Completed (100%)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Date range row */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0">
                  <Calendar className="h-3.5 w-3.5" /> Last Active
                </span>
                {(["all", "today", "week", "month", "custom"] as const).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => { setDatePreset(preset); setClassPage(1); }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer capitalize ${
                      datePreset === preset
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {preset === "all" ? "All Time" : preset === "today" ? "Today" : preset === "week" ? "This Week" : preset === "month" ? "This Month" : "Custom Range"}
                  </button>
                ))}

                {/* Custom date pickers */}
                {datePreset === "custom" && (
                  <div className="flex items-center gap-2 ml-1">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => { setDateFrom(e.target.value); setClassPage(1); }}
                      className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <span className="text-slate-400 text-xs">to</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => { setDateTo(e.target.value); setClassPage(1); }}
                      className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    {(dateFrom || dateTo) && (
                      <button
                        onClick={() => { setDateFrom(""); setDateTo(""); setClassPage(1); }}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                        title="Clear dates"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Class Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-xs uppercase tracking-wider">
                      <th className="p-4 pl-6">Class</th>
                      <th className="p-4">Assigned Course</th>
                      <th className="p-4">Assigned Teacher</th>
                      <th className="p-4 text-center">Chapters Done</th>
                      <th className="p-4 text-center">Subchapters Done</th>
                      <th className="p-4" title="Based on content viewed/scrolled through. Chapters Done reflects fully completed chapters.">Learning Progress</th>
                      <th className="p-4 pr-6">Last Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 text-sm">
                    {classesQuery.isLoading ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                          Loading classes progress details...
                        </td>
                      </tr>
                    ) : !classesQuery.data?.items || classesQuery.data.items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                          No classes matching the selection criteria.
                        </td>
                      </tr>
                    ) : (
                      classesQuery.data.items.map((item) => (
                        <tr key={item.classId} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                          <td className="p-4 pl-6 font-semibold text-slate-900 dark:text-white">{item.className}</td>
                          <td className="p-4 font-medium">{item.courseTitle}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              item.teacherId 
                                ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400" 
                                : "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400"
                            }`}>
                              {item.teacherName}
                            </span>
                          </td>
                          <td className="p-4 text-center font-bold font-mono">
                            {item.completedChapters} <span className="text-slate-400 font-normal">/ {item.totalChapters}</span>
                          </td>
                          <td className="p-4 text-center font-bold font-mono">
                            {item.completedSubchapters} <span className="text-slate-400 font-normal">/ {item.totalSubchapters}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 max-w-[140px]">
                              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-350 ${
                                    item.progressPercentage === 100
                                      ? "bg-emerald-500"
                                      : item.progressPercentage > 0
                                      ? "bg-indigo-500"
                                      : "bg-slate-300 dark:bg-slate-650"
                                  }`}
                                  style={{ width: `${item.progressPercentage}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold font-mono w-8 text-right">{item.progressPercentage}%</span>
                            </div>
                          </td>
                          <td className="p-4 pr-6 text-xs text-slate-400 font-medium">
                            {formatDate(item.lastAccessedAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Class Pagination */}
              {classesQuery.data && classesQuery.data.total > 10 && (
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Total {classesQuery.data.total} records
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setClassPage((p) => Math.max(1, p - 1))}
                      disabled={classPage === 1}
                      className="p-1.5 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Page {classPage} of {Math.ceil(classesQuery.data.total / 10)}
                    </span>
                    <button
                      onClick={() => setClassPage((p) => Math.min(Math.ceil(classesQuery.data.total / 10), p + 1))}
                      disabled={classPage === Math.ceil(classesQuery.data.total / 10)}
                      className="p-1.5 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Teacher Search bar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search teacher by name..."
                  value={teacherSearch}
                  onChange={(e) => {
                    setTeacherSearch(e.target.value);
                    setTeacherPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Teacher Leaderboard Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-xs uppercase tracking-wider">
                      <th className="p-4 pl-6">Rank</th>
                      <th className="p-4">Teacher Name</th>
                      <th className="p-4 text-center">Assigned Classes</th>
                      <th className="p-4 text-center">Subchapters Completed</th>
                      <th className="p-4 pr-6">Average Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 text-sm">
                    {teachersQuery.isLoading ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                          Loading teacher completion records...
                        </td>
                      </tr>
                    ) : !teachersQuery.data?.items || teachersQuery.data.items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                          No teachers found matching the criteria.
                        </td>
                      </tr>
                    ) : (
                      teachersQuery.data.items.map((item, index) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                          <td className="p-4 pl-6 font-semibold">
                            {(teacherPage - 1) * 10 + index < 3 ? (
                              <span className="inline-flex items-center gap-1 text-amber-500">
                                <Award className="h-4 w-4" />
                                {(teacherPage - 1) * 10 + index + 1}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono pl-1">{(teacherPage - 1) * 10 + index + 1}</span>
                            )}
                          </td>
                          <td className="p-4 font-semibold text-slate-900 dark:text-white">{item.name}</td>
                          <td className="p-4 text-center font-semibold font-mono">{item.totalAssigned}</td>
                          <td className="p-4 text-center font-bold font-mono">
                            {item.completed} <span className="text-slate-400 font-normal">/ {item.total}</span>
                          </td>
                          <td className="p-4 pr-6">
                            <div className="flex items-center gap-2 max-w-[180px]">
                              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-350 ${
                                    item.avgProgress === 100
                                      ? "bg-emerald-500"
                                      : item.avgProgress > 0
                                      ? "bg-indigo-500"
                                      : "bg-slate-300 dark:bg-slate-650"
                                  }`}
                                  style={{ width: `${item.avgProgress}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold font-mono w-8 text-right">{item.avgProgress}%</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Teacher Pagination */}
              {teachersQuery.data && teachersQuery.data.total > 10 && (
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Total {teachersQuery.data.total} records
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTeacherPage((p) => Math.max(1, p - 1))}
                      disabled={teacherPage === 1}
                      className="p-1.5 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Page {teacherPage} of {Math.ceil(teachersQuery.data.total / 10)}
                    </span>
                    <button
                      onClick={() => setTeacherPage((p) => Math.min(Math.ceil(teachersQuery.data.total / 10), p + 1))}
                      disabled={teacherPage === Math.ceil(teachersQuery.data.total / 10)}
                      className="p-1.5 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
