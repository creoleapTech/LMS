import {
  BookOpen,
  GraduationCap,
  Users,
  UserCheck,
  TrendingUp,
  BarChart3,
  Clock,
  Activity,
  PieChart as PieChartIcon,
  RotateCcw,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  ComposedChart,
  Legend,
} from 'recharts';
import {
  StatCard,
  SectionHeader,
  DashCard,
  ChartTooltip,
  EmptyState,
} from './components/DashboardComponents';
import { CHART_COLORS, CHART_PALETTE, GENDER_COLORS } from './constants/chart-colors';

interface AdminDashboardProps {
  data: any;
  filters: { year?: number; month?: number; classId?: string };
  onFiltersChange: (f: { year?: number; month?: number; classId?: string }) => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function AdminDashboard({ data, filters, onFiltersChange }: AdminDashboardProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const hasFilters = !!(filters.year || filters.month || filters.classId);

  return (
    <div className="space-y-5">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Curriculum" value={data.curriculumAccessCount || 0} icon={BookOpen} accent="indigo" delay={0} />
        <StatCard title="Classes" value={data.totalClasses} icon={Users} accent="violet" delay={40} />
        <StatCard title="Staff" value={data.totalStaff} subtitle={`${data.activeStaff} active`} icon={UserCheck} accent="emerald" delay={80} />
        <StatCard title="Enrolled Students" value={data.totalStudents} subtitle={`${data.activeStudents} active`} icon={GraduationCap} accent="amber" delay={120} />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 neo-card px-5 py-3">
        <div className="flex items-center gap-2 text-slate-500">
          <Filter size={16} />
          <span className="text-xs font-semibold uppercase tracking-wider">Filters</span>
        </div>
        <select
          value={filters.year || ''}
          onChange={(e) => onFiltersChange({ ...filters, year: e.target.value ? Number(e.target.value) : undefined })}
          className="text-sm rounded-lg px-3 py-1.5 text-slate-700 font-medium neo-inset-rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">All Years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={filters.month || ''}
          onChange={(e) => onFiltersChange({ ...filters, month: e.target.value ? Number(e.target.value) : undefined })}
          className="text-sm rounded-lg px-3 py-1.5 text-slate-700 font-medium neo-inset-rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">All Months</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select
          value={filters.classId || ''}
          onChange={(e) => onFiltersChange({ ...filters, classId: e.target.value || undefined })}
          className="text-sm rounded-lg px-3 py-1.5 text-slate-700 font-medium neo-inset-rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">All Classes</option>
          {data.classSizeDistribution?.map((c: any, i: number) => (
            <option key={i} value={c.class}>{c.class}</option>
          ))}
        </select>
        {hasFilters && (
          <button onClick={() => onFiltersChange({})} className="flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors ml-1 neo-card-flat px-2.5 py-1">
            <RotateCcw size={12} /> Reset
          </button>
        )}
      </div>

      {/* Row 1: Classwise Progress */}
      <DashCard>
        <SectionHeader icon={BarChart3} title="Class-wise Progress" subtitle="Average curriculum completion per class" accent="text-indigo-600 bg-indigo-50" />
        <div className="h-[300px] mt-3">
          {data.classwiseProgress?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.classwiseProgress} layout="vertical" margin={{ left: 10, right: 50, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="classwiseGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ccd3df" strokeOpacity={0.5} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <YAxis dataKey="class" type="category" tick={{ fill: '#334155', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<ChartTooltip />} formatter={(v: any) => [`${v}%`, 'Progress']} />
                <Bar dataKey="avgProgress" name="Progress %" fill="url(#classwiseGrad)" radius={[0, 8, 8, 0]} barSize={22} background={{ fill: '#d4dae6', radius: 8 }}
                  label={{ position: 'right', formatter: (v: any) => `${v}%`, fill: '#334155', fontSize: 11, fontWeight: 700 }}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No class progress data yet" />
          )}
        </div>
      </DashCard>

      {/* Row 2: Student Growth + Sessions + Gender Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <DashCard className="lg:col-span-2">
          <SectionHeader icon={TrendingUp} title="Student Growth & Teaching Sessions" subtitle="Enrollment and session trends" />
          <div className="h-[320px] mt-3">
            {(data.studentGrowth?.length > 0 || data.sessionsByMonth?.length > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={mergeMonthData(data.studentGrowth, data.sessionsByMonth)} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="enrollGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.emerald} stopOpacity={0.6} />
                      <stop offset="50%" stopColor={CHART_COLORS.cyan} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={CHART_COLORS.emerald} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="sessionBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.violet} />
                      <stop offset="100%" stopColor={CHART_COLORS.indigo} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ccd3df" strokeOpacity={0.5} />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
                  <Area yAxisId="left" type="monotone" dataKey="enrollments" name="Enrollments" stroke={CHART_COLORS.emerald} strokeWidth={3} fill="url(#enrollGrad)" dot={{ r: 5, fill: '#fff', stroke: CHART_COLORS.emerald, strokeWidth: 2.5 }} activeDot={{ r: 7, fill: CHART_COLORS.emerald }} />
                  <Bar yAxisId="right" dataKey="sessions" name="Sessions" fill="url(#sessionBarGrad)" radius={[6, 6, 0, 0]} barSize={28} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No data available yet" />
            )}
          </div>
        </DashCard>

        {/* Gender Distribution */}
        <DashCard>
          <SectionHeader icon={PieChartIcon} title="Student Demographics" subtitle="Gender distribution" accent="text-pink-600 bg-pink-50" />
          <div className="h-[320px] mt-3 flex flex-col items-center justify-center">
            {data.genderDistribution?.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <defs>
                      <linearGradient id="genderMaleGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#4f46e5" />
                      </linearGradient>
                      <linearGradient id="genderFemaleGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#f472b6" />
                        <stop offset="100%" stopColor="#db2777" />
                      </linearGradient>
                      <linearGradient id="genderOtherGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="#f59e0b" />
                      </linearGradient>
                    </defs>
                    <Pie
                      data={data.genderDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {data.genderDistribution.map((entry: any, i: number) => {
                        const gradMap: Record<string, string> = { male: 'url(#genderMaleGrad)', female: 'url(#genderFemaleGrad)', other: 'url(#genderOtherGrad)' };
                        return (
                          <Cell
                            key={entry.name}
                            fill={gradMap[entry.name] || CHART_PALETTE[i % CHART_PALETTE.length]}
                          />
                        );
                      })}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-4 mt-1">
                  {data.genderDistribution.map((entry: any, i: number) => (
                    <div key={entry.name} className="flex items-center gap-2 neo-card-flat rounded-full px-3 py-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: (GENDER_COLORS as any)[entry.name] || CHART_PALETTE[i % CHART_PALETTE.length] }} />
                      <span className="text-xs font-bold text-slate-600 capitalize">{entry.name}</span>
                      <span className="text-xs font-extrabold text-slate-900">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState message="No student data yet" />
            )}
          </div>
        </DashCard>
      </div>

      {/* Row 3: Class Engagement + Curriculum Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DashCard>
          <SectionHeader icon={Activity} title="Class Engagement" subtitle="Students & sessions per class" accent="text-cyan-600 bg-cyan-50" />
          <div className="h-[300px] mt-3">
            {data.classSizeDistribution?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mergeClassData(data.classSizeDistribution, data.classActivity)} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="studentsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                    <linearGradient id="sessionsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ccd3df" strokeOpacity={0.5} />
                  <XAxis dataKey="class" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
                  <Bar dataKey="students" name="Students" fill="url(#studentsGrad)" radius={[6, 6, 0, 0]} barSize={26} />
                  <Bar dataKey="sessions" name="Sessions" fill="url(#sessionsGrad)" radius={[6, 6, 0, 0]} barSize={26} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No class data yet" />
            )}
          </div>
        </DashCard>

        <DashCard>
          <SectionHeader icon={BookOpen} title="Curriculum Progress" subtitle="Average teaching completion per book" accent="text-indigo-600 bg-indigo-50" />
          <div className="h-[300px] mt-3">
            {data.teachingProgressByBook?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.teachingProgressByBook} layout="vertical" margin={{ left: 10, right: 40, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="progressGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="50%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ccd3df" strokeOpacity={0.5} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <YAxis dataKey="bookTitle" type="category" tick={{ fill: '#334155', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} width={130} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="avgProgress" name="Progress %" fill="url(#progressGrad)" radius={[0, 8, 8, 0]} barSize={22} background={{ fill: '#d4dae6', radius: 8 }} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No progress data yet" />
            )}
          </div>
        </DashCard>
      </div>

      {/* Row 4: School Progress Gauge + Recent Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DashCard className="flex flex-col items-center justify-center">
          <SectionHeader icon={TrendingUp} title="School Progress" subtitle="Overall teaching completion" accent="text-emerald-600 bg-emerald-50" />
          <div className="h-[260px] w-full mt-3 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="40%"
                outerRadius="95%"
                barSize={22}
                data={[{ value: data.schoolProgress || data.avgTeachingProgress || 0, fill: 'url(#gaugeGrad)' }]}
                startAngle={210}
                endAngle={-30}
              >
                <defs>
                  <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="50%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                <RadialBar
                  dataKey="value"
                  cornerRadius={12}
                  background={{ fill: '#d4dae6' }}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-black text-slate-900 tabular-nums">
                {data.schoolProgress || data.avgTeachingProgress || 0}
              </span>
              <span className="text-sm font-bold text-slate-400 -mt-1">percent</span>
            </div>
          </div>
        </DashCard>

        <DashCard>
          <SectionHeader icon={Clock} title="Recent Sessions" subtitle="Latest teaching sessions" accent="text-emerald-600 bg-emerald-50" />
          <div className="mt-3 space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {data.recentSessions?.length > 0 ? (
              data.recentSessions.map((s: any, idx: number) => {
                const colors = ['bg-gradient-to-r from-indigo-50/80 to-violet-50/80', 'bg-gradient-to-r from-emerald-50/80 to-cyan-50/80', 'bg-gradient-to-r from-rose-50/80 to-pink-50/80', 'bg-gradient-to-r from-amber-50/80 to-orange-50/80', 'bg-gradient-to-r from-sky-50/80 to-blue-50/80'];
                return (
                  <div key={s._id} className={`flex items-start gap-3 p-3 neo-card-flat ${colors[idx % colors.length]} transition-all hover:scale-[1.01]`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0 shadow-lg ${s.status === 'completed' ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30' : 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/30'}`}>
                      {s.duration}m
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-slate-800 leading-tight truncate">{s.teacher}</p>
                      <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                        Class {s.class} &middot; {s.time}
                      </p>
                      {s.topics?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {s.topics.slice(0, 2).map((topic: string, i: number) => (
                            <span key={i} className="text-[10px] bg-white/80 text-slate-600 px-2 py-0.5 rounded-full font-semibold border border-slate-100">{topic}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState message="No sessions yet" />
            )}
          </div>
        </DashCard>
      </div>

      {/* Row 5: Course Distribution + Student Growth */}
      {data.courseDistribution?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <DashCard>
            <SectionHeader icon={PieChartIcon} title="Course Distribution" subtitle="Grade books per curriculum" accent="text-violet-600 bg-violet-50" />
            <div className="h-[300px] mt-3 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {data.courseDistribution.map((_: any, i: number) => (
                      <linearGradient key={`cg${i}`} id={`courseGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={CHART_PALETTE[i % CHART_PALETTE.length]} stopOpacity={1} />
                        <stop offset="100%" stopColor={CHART_PALETTE[(i + 1) % CHART_PALETTE.length]} stopOpacity={0.8} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={data.courseDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                    label={({ name, value }) => `${name} (${value})`}
                  >
                    {data.courseDistribution.map((_: any, i: number) => (
                      <Cell key={i} fill={`url(#courseGrad${i})`} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </DashCard>

          <DashCard>
            <SectionHeader icon={BarChart3} title="Student Growth" subtitle="New enrollments over time" accent="text-rose-600 bg-rose-50" />
            <div className="h-[300px] mt-3">
              {data.studentGrowth?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.studentGrowth} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="roseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.rose} stopOpacity={0.6} />
                        <stop offset="40%" stopColor={CHART_COLORS.pink} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={CHART_COLORS.rose} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ccd3df" strokeOpacity={0.5} />
                    <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="count" name="Students" stroke={CHART_COLORS.rose} strokeWidth={3} fill="url(#roseGrad)" dot={{ r: 5, fill: '#fff', stroke: CHART_COLORS.rose, strokeWidth: 2.5 }} activeDot={{ r: 7, fill: CHART_COLORS.rose }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No enrollment data yet" />
              )}
            </div>
          </DashCard>
        </div>
      )}
    </div>
  );
}

function mergeMonthData(
  studentGrowth: Array<{ month: string; count: number }> | undefined,
  sessionsByMonth: Array<{ month: string; sessions: number; minutes: number }> | undefined
) {
  const map = new Map<string, { month: string; enrollments: number; sessions: number }>();
  for (const s of studentGrowth || []) {
    map.set(s.month, { month: s.month, enrollments: s.count, sessions: 0 });
  }
  for (const s of sessionsByMonth || []) {
    const existing = map.get(s.month);
    if (existing) existing.sessions = s.sessions;
    else map.set(s.month, { month: s.month, enrollments: 0, sessions: s.sessions });
  }
  const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return Array.from(map.values()).sort((a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month));
}

function mergeClassData(
  classSizes: Array<{ class: string; students: number }> | undefined,
  classActivity: Array<{ class: string; sessions: number; minutes: number }> | undefined
) {
  const map = new Map<string, { class: string; students: number; sessions: number }>();
  for (const c of classSizes || []) {
    map.set(c.class, { class: c.class, students: c.students, sessions: 0 });
  }
  for (const c of classActivity || []) {
    const existing = map.get(c.class);
    if (existing) existing.sessions = c.sessions;
    else map.set(c.class, { class: c.class, students: 0, sessions: c.sessions });
  }
  return Array.from(map.values());
}
