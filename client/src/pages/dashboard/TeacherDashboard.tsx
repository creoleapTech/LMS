import {
  GraduationCap,
  Clock,
  TrendingUp,
  BookOpen,
  Play,
  Timer,
  Layers,
  Activity,
  Target,
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import {
  StatCard,
  SectionHeader,
  DashCard,
  ProgressBar,
  ChartTooltip,
  EmptyState,
} from './components/DashboardComponents';
import { CHART_COLORS, CHART_PALETTE } from './constants/chart-colors';

export function TeacherDashboard({ data }: { data: any }) {
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="My Students" value={data.totalStudents} icon={GraduationCap} accent="indigo" delay={0} />
        <StatCard title="Overall Progress" value={data.overallProgress} suffix="%" icon={TrendingUp} accent="emerald" delay={40} />
        <StatCard title="Total Sessions" value={data.totalSessions} icon={Clock} accent="violet" delay={80} />
        <StatCard title="Teaching Minutes" value={data.totalTeachingMinutes} icon={Timer} accent="amber" delay={120} />
      </div>

      {/* Continue Teaching Hero Card */}
      {data.continueTeaching && (
        <DashCard className="relative overflow-hidden border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/60">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.08),_transparent_60%)]" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-16 h-20 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-300/50 shrink-0">
              <BookOpen size={28} />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 border border-indigo-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Continue Teaching
                </span>
                <span className="text-[11px] text-slate-400 font-medium">{data.continueTeaching.lastAccessedLabel}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight truncate">{data.continueTeaching.bookTitle}</h3>
              <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                <span>Grade {data.continueTeaching.grade}</span>
                {data.continueTeaching.class && <span>Class {data.continueTeaching.class}</span>}
                <span className="tabular-nums">{data.continueTeaching.completedContent}/{data.continueTeaching.totalContent} items</span>
              </div>
              <ProgressBar value={data.continueTeaching.progress} className="max-w-sm" />
            </div>
            <div className="shrink-0">
              <button
                onClick={() => navigate({
                  to: '/curriculum',
                  search: {
                    gradeBookId: data.continueTeaching.gradeBookId,
                    classId: data.continueTeaching.classId,
                    bookTitle: data.continueTeaching.bookTitle,
                  },
                })}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold rounded-xl hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-300/40 active:scale-95"
              >
                <Play size={16} /> Resume
              </button>
            </div>
          </div>
        </DashCard>
      )}

      {/* Charts Row: Teaching Activity + Class Progress Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DashCard>
          <SectionHeader icon={Activity} title="Teaching Activity" subtitle="Sessions per month over last 6 months" accent="text-rose-600 bg-rose-50" />
          <div className="h-[300px] mt-3">
            {data.sessionsByMonth?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.sessionsByMonth} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="teachActivityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.rose} stopOpacity={0.55} />
                      <stop offset="40%" stopColor={CHART_COLORS.pink} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={CHART_COLORS.rose} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="sessions"
                    name="Sessions"
                    stroke={CHART_COLORS.rose}
                    strokeWidth={3}
                    fill="url(#teachActivityGrad)"
                    dot={{ r: 6, fill: '#fff', stroke: CHART_COLORS.rose, strokeWidth: 2.5 }}
                    activeDot={{ r: 8, fill: CHART_COLORS.rose, stroke: '#fff', strokeWidth: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No session data available yet" />
            )}
          </div>
        </DashCard>

        <DashCard>
          <SectionHeader icon={Target} title="Class-wise Progress" subtitle="Your teaching progress per class" accent="text-violet-600 bg-violet-50" />
          <div className="h-[300px] mt-3">
            {data.progressByClass?.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={data.progressByClass} cx="50%" cy="50%" outerRadius="80%">
                  <defs>
                    <linearGradient id="radarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.indigo} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={CHART_COLORS.violet} stopOpacity={0.15} />
                    </linearGradient>
                  </defs>
                  <PolarGrid stroke="#c7d2fe" strokeWidth={1} />
                  <PolarAngleAxis dataKey="classLabel" tick={{ fill: '#334155', fontSize: 12, fontWeight: 700 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Radar
                    name="Progress"
                    dataKey="avgProgress"
                    stroke={CHART_COLORS.indigo}
                    fill="url(#radarGrad)"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: CHART_COLORS.indigo, stroke: '#fff', strokeWidth: 2 }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            ) : data.progressByClass?.length === 1 ? (
              <div className="flex flex-col items-center justify-center h-full space-y-4">
                <div className="relative w-36 h-36">
                  <svg className="w-36 h-36 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke="url(#ringGrad)"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${(data.progressByClass[0].avgProgress / 100) * 264} 264`}
                    />
                    <defs>
                      <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.indigo} />
                        <stop offset="100%" stopColor={CHART_COLORS.violet} />
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-3xl font-black text-slate-900 tabular-nums">
                    {data.progressByClass[0].avgProgress}%
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-600 bg-indigo-50 px-3 py-1 rounded-full">
                  Class {data.progressByClass[0].classLabel}
                </p>
              </div>
            ) : (
              <EmptyState message="No class progress data" />
            )}
          </div>
        </DashCard>
      </div>

      {/* My Classes + Progress by Book */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DashCard>
          <SectionHeader icon={Layers} title="My Classes" subtitle={`${data.myClasses?.length || 0} assigned classes`} accent="text-violet-600 bg-violet-50" />
          <div className="mt-3 space-y-2">
            {data.myClasses?.length > 0 ? (
              data.myClasses.map((cls: any, idx: number) => {
                const gradients = [
                  'bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-100',
                  'bg-gradient-to-r from-emerald-50 to-cyan-50 border-emerald-100',
                  'bg-gradient-to-r from-rose-50 to-pink-50 border-rose-100',
                  'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-100',
                  'bg-gradient-to-r from-sky-50 to-blue-50 border-sky-100',
                ];
                const ringColors = [CHART_COLORS.indigo, CHART_COLORS.emerald, CHART_COLORS.rose, CHART_COLORS.amber, CHART_COLORS.sky];
                const color = ringColors[idx % ringColors.length];
                return (
                  <div key={cls._id} className={`flex items-center gap-4 p-3 rounded-xl border ${gradients[idx % gradients.length]} transition-all hover:scale-[1.01] group`}>
                    <div className="relative w-12 h-12 shrink-0">
                      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                        <circle cx="24" cy="24" r="20" fill="none" stroke="#e2e8f0" strokeWidth="5" />
                        <circle
                          cx="24" cy="24" r="20" fill="none"
                          stroke={color}
                          strokeWidth="5"
                          strokeLinecap="round"
                          strokeDasharray={`${(cls.avgProgress / 100) * 126} 126`}
                          className="transition-all duration-700"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-slate-700 tabular-nums">
                        {cls.avgProgress}%
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                        {cls.grade ? `Grade ${cls.grade}` : ''}{cls.section ? `–${cls.section}` : ''}
                        {cls.year ? ` (${cls.year})` : ''}
                      </p>
                      <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                        {cls.students} students &middot; Last: {cls.lastAccessed}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState message="No classes assigned" />
            )}
          </div>
        </DashCard>

        <DashCard>
          <SectionHeader icon={BookOpen} title="Grade Book Progress" subtitle="Your teaching progress per book" />
          {data.progressByGradeBook?.length > 0 && (
            <div className="h-[180px] mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.progressByGradeBook} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                  <defs>
                    {data.progressByGradeBook.map((_: any, i: number) => (
                      <linearGradient key={`bg${i}`} id={`bookGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_PALETTE[i % CHART_PALETTE.length]} />
                        <stop offset="100%" stopColor={CHART_PALETTE[(i + 2) % CHART_PALETTE.length]} stopOpacity={0.7} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                  <XAxis dataKey="bookTitle" tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="progress" name="Progress %" radius={[8, 8, 0, 0]} barSize={30} background={{ fill: '#f1f5f9', radius: 8 }}>
                    {data.progressByGradeBook.map((_: any, i: number) => (
                      <Cell key={i} fill={`url(#bookGrad${i})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-3 space-y-2">
            {data.progressByGradeBook?.length > 0 ? (
              data.progressByGradeBook.map((p: any, idx: number) => {
                const colors = ['from-indigo-500 to-violet-500', 'from-emerald-500 to-cyan-500', 'from-rose-500 to-pink-500', 'from-amber-500 to-orange-500', 'from-sky-500 to-blue-500'];
                const bgs = ['bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-100', 'bg-gradient-to-r from-emerald-50 to-cyan-50 border-emerald-100', 'bg-gradient-to-r from-rose-50 to-pink-50 border-rose-100', 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-100', 'bg-gradient-to-r from-sky-50 to-blue-50 border-sky-100'];
                return (
                  <div key={p._id} className={`p-3 rounded-xl border space-y-2 ${bgs[idx % bgs.length]} transition-all hover:scale-[1.01]`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{p.bookTitle}</p>
                        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                          Grade {p.grade} {p.class ? `· Class ${p.class}` : ''} · {p.completedContent}/{p.totalContent} items
                        </p>
                      </div>
                      <span className="text-sm font-black text-slate-900 tabular-nums shrink-0 bg-white/70 px-2 py-0.5 rounded-lg">{Math.round(p.progress)}%</span>
                    </div>
                    <div className="h-2.5 bg-white/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${colors[idx % colors.length]} rounded-full transition-all duration-700`}
                        style={{ width: `${Math.min(100, Math.max(0, p.progress))}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState message="No grade book progress yet" />
            )}
          </div>
        </DashCard>
      </div>

      {/* Recent Sessions */}
      <DashCard>
        <SectionHeader icon={Clock} title="Recent Sessions" subtitle="Your latest teaching sessions" accent="text-emerald-600 bg-emerald-50" />
        <div className="mt-3">
          {data.recentSessions?.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.recentSessions.map((s: any, idx: number) => {
                const gradients = ['bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-100', 'bg-gradient-to-br from-emerald-50 to-cyan-50 border-emerald-100', 'bg-gradient-to-br from-rose-50 to-pink-50 border-rose-100', 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100', 'bg-gradient-to-br from-sky-50 to-blue-50 border-sky-100', 'bg-gradient-to-br from-purple-50 to-fuchsia-50 border-purple-100'];
                return (
                  <div key={s._id} className={`p-3.5 rounded-xl border ${gradients[idx % gradients.length]} space-y-2 transition-all hover:scale-[1.02]`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-800">Class {s.class}</span>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${s.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {s.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black text-white px-2 py-0.5 rounded-md ${s.status === 'completed' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gradient-to-r from-amber-500 to-amber-600'}`}>
                        {s.duration}min
                      </span>
                      <span className="text-[11px] text-slate-500 font-semibold">{s.time}</span>
                    </div>
                    {s.topics?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.topics.map((topic: string, i: number) => (
                          <span key={i} className="text-[10px] bg-white/80 text-slate-600 px-2 py-0.5 rounded-full font-semibold border border-white">{topic}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState message="No sessions yet" />
          )}
        </div>
      </DashCard>
    </div>
  );
}
