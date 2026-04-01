import {
  GraduationCap,
  Clock,
  TrendingUp,
  BookOpen,
  Play,
  Timer,
  Layers,
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import {
  StatCard,
  SectionHeader,
  DashCard,
  ProgressBar,
  EmptyState,
} from './components/DashboardComponents';

export function TeacherDashboard({ data }: { data: any }) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="My Students" value={data.totalStudents} icon={GraduationCap} accent="indigo" delay={0} />
        <StatCard title="Overall Progress" value={data.overallProgress} suffix="%" icon={TrendingUp} accent="emerald" delay={40} />
        <StatCard title="Total Sessions" value={data.totalSessions} icon={Clock} accent="violet" delay={80} />
        <StatCard title="Teaching Minutes" value={data.totalTeachingMinutes} icon={Timer} accent="amber" delay={120} />
      </div>

      {/* Continue Teaching Hero Card */}
      {data.continueTeaching && (
        <DashCard className="relative overflow-hidden border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Book cover or fallback */}
            <div className="w-16 h-20 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-200/50 shrink-0">
              <BookOpen size={28} />
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded uppercase tracking-wider">
                  Continue Teaching
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {data.continueTeaching.lastAccessedLabel}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight truncate">
                {data.continueTeaching.bookTitle}
              </h3>
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
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200/50 active:scale-95 transition-transform"
              >
                <Play size={16} />
                Resume
              </button>
            </div>
          </div>
        </DashCard>
      )}

      {/* My Classes + Progress by Book */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Classes */}
        <DashCard>
          <SectionHeader
            icon={Layers}
            title="My Classes"
            subtitle={`${data.myClasses?.length || 0} assigned classes`}
            accent="text-violet-600 bg-violet-50"
          />
          <div className="mt-4 space-y-3">
            {data.myClasses?.length > 0 ? (
              data.myClasses.map((cls: any) => (
                <div key={cls._id} className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group">
                  {/* Ring progress indicator */}
                  <div className="relative w-11 h-11 shrink-0">
                    <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                      <circle cx="22" cy="22" r="18" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                      <circle
                        cx="22" cy="22" r="18" fill="none"
                        stroke="#6366f1" strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${(cls.avgProgress / 100) * 113} 113`}
                        className="transition-all duration-700"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-600 tabular-nums">
                      {cls.avgProgress}%
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                      {cls.grade ? `Grade ${cls.grade}` : ''}{cls.section ? `–${cls.section}` : ''}
                      {cls.year ? ` (${cls.year})` : ''}
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      {cls.students} students &middot; Last: {cls.lastAccessed}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState message="No classes assigned" />
            )}
          </div>
        </DashCard>

        {/* Progress by Grade Book */}
        <DashCard>
          <SectionHeader
            icon={BookOpen}
            title="Grade Book Progress"
            subtitle="Your teaching progress per book"
          />
          <div className="mt-4 space-y-3">
            {data.progressByGradeBook?.length > 0 ? (
              data.progressByGradeBook.map((p: any) => (
                <div key={p._id} className="p-3 rounded-xl border border-slate-100 space-y-2 hover:border-indigo-100 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{p.bookTitle}</p>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        Grade {p.grade} {p.class ? `· Class ${p.class}` : ''} · {p.completedContent}/{p.totalContent} items
                      </p>
                    </div>
                    <span className="text-sm font-bold text-indigo-600 tabular-nums shrink-0">{Math.round(p.progress)}%</span>
                  </div>
                  <ProgressBar value={p.progress} />
                </div>
              ))
            ) : (
              <EmptyState message="No grade book progress yet" />
            )}
          </div>
        </DashCard>
      </div>

      {/* Recent Sessions */}
      <DashCard>
        <SectionHeader
          icon={Clock}
          title="Recent Sessions"
          subtitle="Your latest teaching sessions"
          accent="text-emerald-600 bg-emerald-50"
        />
        <div className="mt-4">
          {data.recentSessions?.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.recentSessions.map((s: any) => (
                <div key={s._id} className="p-3 rounded-xl border border-slate-100 hover:border-indigo-100 transition-colors space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">Class {s.class}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${s.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      {s.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {s.duration}min &middot; {s.time}
                  </p>
                  {s.topics?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {s.topics.map((topic: string, i: number) => (
                        <span key={i} className="text-[10px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded font-medium">{topic}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No sessions yet" />
          )}
        </div>
      </DashCard>
    </div>
  );
}
