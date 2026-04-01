import {
  Building2,
  Users,
  UserCheck,
  GraduationCap,
  BookOpen,
  Library,
  FileText,
  Layers,
  TrendingUp,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  StatCard,
  SectionHeader,
  DashCard,
  ProgressBar,
  ChartTooltip,
  ActivityDot,
  EmptyState,
} from './components/DashboardComponents';

const CONTENT_COLORS: Record<string, string> = {
  video: '#6366f1',
  youtube: '#ef4444',
  ppt: '#f59e0b',
  pdf: '#10b981',
  quiz: '#8b5cf6',
  activity: '#06b6d4',
  project: '#ec4899',
  note: '#64748b',
  text: '#a3a3a3',
};

export function SuperAdminDashboard({ data }: { data: any }) {
  const contentPieData = Object.entries(data.contentByType || {}).map(([type, count]) => ({
    name: type,
    value: count as number,
    color: CONTENT_COLORS[type] || '#94a3b8',
  }));

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Institutions" value={data.totalInstitutions} subtitle={`${data.activeInstitutions} active`} icon={Building2} accent="indigo" delay={0} />
        <StatCard title="Total Students" value={data.totalStudents} subtitle={`${data.activeStudents} active`} icon={GraduationCap} accent="emerald" delay={40} />
        <StatCard title="Total Staff" value={data.totalStaff} subtitle={`${data.activeStaff} active`} icon={Users} accent="violet" delay={80} />
        <StatCard title="Classes" value={data.totalClasses} icon={UserCheck} accent="amber" delay={120} />
      </div>

      {/* Content Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Curriculums" value={data.totalCurriculums} subtitle={`${data.publishedCurriculums} published`} icon={BookOpen} accent="sky" delay={160} />
        <StatCard title="Grade Books" value={data.totalGradeBooks} icon={Library} accent="rose" delay={200} />
        <StatCard title="Chapters" value={data.totalChapters} icon={FileText} accent="cyan" delay={240} />
        <StatCard title="Content Items" value={data.totalContent} icon={Layers} accent="violet" delay={280} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Enrollment Trend */}
        <DashCard className="lg:col-span-2">
          <SectionHeader
            icon={TrendingUp}
            title="Enrollment Trend"
            subtitle="New students over the last 6 months"
          />
          <div className="h-[280px] mt-4">
            {data.enrollmentTrend?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.enrollmentTrend} margin={{ left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="enrollGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="count" name="Enrollments" stroke="#6366f1" strokeWidth={2.5} fill="url(#enrollGrad)" dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#6366f1' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No enrollment data yet" />
            )}
          </div>
        </DashCard>

        {/* Content Distribution */}
        <DashCard>
          <SectionHeader
            icon={Layers}
            title="Content Types"
            subtitle="Distribution of content items"
            accent="text-violet-600 bg-violet-50"
          />
          <div className="h-[280px] mt-4 flex items-center justify-center">
            {contentPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={contentPieData}
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {contentPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No content yet" />
            )}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
            {contentPieData.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="capitalize">{item.name}</span>
                <span className="text-slate-400">({item.value})</span>
              </div>
            ))}
          </div>
        </DashCard>
      </div>

      {/* Institution Overview & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Institution table */}
        <DashCard className="lg:col-span-2">
          <SectionHeader
            icon={Building2}
            title="Institution Overview"
            subtitle={`${data.institutionOverview?.length || 0} institutions`}
          />
          <div className="mt-4 overflow-x-auto">
            {data.institutionOverview?.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="text-left pb-3 pr-4">Institution</th>
                    <th className="text-center pb-3 px-3">Students</th>
                    <th className="text-center pb-3 px-3">Staff</th>
                    <th className="text-center pb-3 px-3">Classes</th>
                    <th className="text-left pb-3 pl-3 w-32">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {data.institutionOverview.map((inst: any) => (
                    <tr key={inst._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2 h-2 rounded-full ${inst.isActive ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                          <span className="font-semibold text-slate-800 text-sm">{inst.name}</span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-3 text-slate-600 font-medium tabular-nums">{inst.students}</td>
                      <td className="text-center py-3 px-3 text-slate-600 font-medium tabular-nums">{inst.staff}</td>
                      <td className="text-center py-3 px-3 text-slate-600 font-medium tabular-nums">{inst.classes}</td>
                      <td className="py-3 pl-3">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={inst.avgProgress} className="flex-1" />
                          <span className="text-xs font-semibold text-slate-500 tabular-nums w-8 text-right">{inst.avgProgress}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState message="No institutions found" />
            )}
          </div>
        </DashCard>

        {/* Recent Activity */}
        <DashCard>
          <SectionHeader
            icon={Activity}
            title="Recent Activity"
            subtitle="Latest enrollments & staff"
            accent="text-emerald-600 bg-emerald-50"
          />
          <div className="mt-4 space-y-4">
            {data.recentActivity?.length > 0 ? (
              data.recentActivity.map((item: any, i: number) => (
                <div key={i} className="flex gap-3 items-start group">
                  <ActivityDot type={item.type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-slate-800 font-semibold leading-snug group-hover:text-indigo-600 transition-colors truncate">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      {item.action} &middot; {item.time}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState message="No recent activity" />
            )}
          </div>
        </DashCard>
      </div>
    </div>
  );
}
