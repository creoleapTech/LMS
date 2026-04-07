import { Calendar, GraduationCap } from 'lucide-react';
import { useAuthStore } from '@/store/userAuthStore';
import { useActiveAcademicYear } from '../useAcademicYear';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardHeader() {
  const { user } = useAuthStore();
  if (!user) return null;

  const institutionId =
    typeof user.institutionId === 'object'
      ? user.institutionId._id
      : user.institutionId;
  const institutionName =
    typeof user.institutionId === 'object'
      ? user.institutionId.name
      : undefined;

  const { data: academicYear } = useActiveAcademicYear(institutionId);

  const firstName = user.name?.split(' ')[0] || '';
  const salutationPrefix = user.salutation ? `${user.salutation}. ` : '';

  return (
    <section className="space-y-2">
      {/* Top row: academic year badge */}
      <div className="flex items-center justify-between">
        <div />
        {academicYear ? (
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3.5 py-1.5 rounded-xl">
            <GraduationCap size={14} strokeWidth={2.5} />
            <span className="text-xs font-bold tracking-wide">
              AY {academicYear.label}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 text-slate-400 px-3.5 py-1.5 rounded-xl">
            <GraduationCap size={14} strokeWidth={2.5} />
            <span className="text-xs font-semibold tracking-wide">No Academic Year Set</span>
          </div>
        )}
      </div>

      {/* School name — BIG */}
      {institutionName && (
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {institutionName}
        </h1>
      )}

      {/* Greeting */}
      <p className="text-lg md:text-xl font-semibold text-slate-600">
        {getGreeting()}, {salutationPrefix}{firstName}!
      </p>

      {/* Role badge + date */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-md uppercase tracking-wider">
          {user.role.replace('_', ' ')}
        </span>
        <span className="text-slate-300 text-xs font-medium flex items-center gap-1.5">
          <Calendar size={12} />
          {new Date().toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      </div>
    </section>
  );
}
