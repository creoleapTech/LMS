import {
  GraduationCap,
  Users,
  UserCheck,
  BookOpen,
  TrendingUp,
  BarChart3,
  Trophy,
  Clock,
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
} from 'recharts';
import {
  StatCard,
  SectionHeader,
  DashCard,
  ProgressBar,
  ChartTooltip,
  EmptyState,
} from './components/DashboardComponents';

export function AdminDashboard({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Students" value={data.totalStudents} subtitle={`${data.activeStudents} active`} icon={GraduationCap} accent="indigo" delay={0} />
        <StatCard title="Total Staff" value={data.totalStaff} subtitle={`${data.activeStaff} active`} icon={Users} accent="emerald" delay={40} />
        <StatCard title="Classes" value={data.totalClasses} icon={UserCheck} accent="violet" delay={80} />
        <StatCard title="Avg Teaching Progress" value={data.avgTeachingProgress} suffix="%" icon={TrendingUp} accent="amber" delay={120} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Growth */}
        <DashCard className="lg:col-span-2">
          <SectionHeader
            icon={TrendingUp}
            title="Student Growth"
            subtitle="New enrollments over the last 6 months"
          />
          <div className="h-[280px] mt-4">
            {data.studentGrowth?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.studentGrowth} margin={{ left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="count" name="Students" stroke="#10b981" strokeWidth={2.5} fill="url(#sgGrad)" dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#10b981' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No enrollment data yet" />
            )}
          </div>
        </DashCard>

        {/* Class Size Distribution */}
        <DashCard>
          <SectionHeader
            icon={BarChart3}
            title="Class Sizes"
            subtitle="Students per class"
            accent="text-violet-600 bg-violet-50"
          />
          <div className="h-[280px] mt-4">
            {data.classSizeDistribution?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.classSizeDistribution} margin={{ left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="class" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="students" name="Students" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No classes yet" />
            )}
          </div>
        </DashCard>
      </div>

      {/* Teacher Leaderboard, Progress by Book, Recent Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teacher Leaderboard */}
        <DashCard>
          <SectionHeader
            icon={Trophy}
            title="Top Teachers"
            subtitle="By teaching progress"
            accent="text-amber-600 bg-amber-50"
          />
          <div className="mt-4 space-y-3">
            {data.teacherLeaderboard?.length > 0 ? (
              data.teacherLeaderboard.map((t: any, i: number) => (
                <div key={t._id} className="flex items-center gap-3 group">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-400'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">{t.name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ProgressBar value={t.avgProgress} className="w-16" />
                    <span className="text-xs font-semibold text-slate-500 tabular-nums w-8 text-right">{t.avgProgress}%</span>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState message="No teaching data yet" />
            )}
          </div>
        </DashCard>

        {/* Teaching Progress by Book */}
        <DashCard>
          <SectionHeader
            icon={BookOpen}
            title="Progress by Book"
            subtitle="Average completion per grade book"
            accent="text-indigo-600 bg-indigo-50"
          />
          <div className="mt-4 space-y-3">
            {data.teachingProgressByBook?.length > 0 ? (
              data.teachingProgressByBook.map((b: any) => (
                <div key={b._id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 truncate max-w-[70%]">{b.bookTitle}</span>
                    <span className="font-semibold text-slate-500 tabular-nums">{b.avgProgress}%</span>
                  </div>
                  <ProgressBar value={b.avgProgress} />
                </div>
              ))
            ) : (
              <EmptyState message="No grade book data yet" />
            )}
          </div>
        </DashCard>

        {/* Recent Sessions */}
        <DashCard>
          <SectionHeader
            icon={Clock}
            title="Recent Sessions"
            subtitle="Latest teaching sessions"
            accent="text-emerald-600 bg-emerald-50"
          />
          <div className="mt-4 space-y-3">
            {data.recentSessions?.length > 0 ? (
              data.recentSessions.map((s: any) => (
                <div key={s._id} className="flex items-start gap-3 group">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${s.status === 'completed' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-slate-800 leading-tight truncate group-hover:text-indigo-600 transition-colors">
                      {s.teacher}
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      Class {s.class} &middot; {s.duration}min &middot; {s.time}
                    </p>
                    {s.topics?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {s.topics.slice(0, 2).map((topic: string, i: number) => (
                          <span key={i} className="text-[10px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded font-medium">{topic}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState message="No sessions yet" />
            )}
          </div>
        </DashCard>
      </div>
    </div>
  );
}
