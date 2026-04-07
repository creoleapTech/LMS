import { Calendar } from 'lucide-react';
import { useAuthStore } from '@/store/userAuthStore';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardHeader() {
  const { user } = useAuthStore();
  if (!user) return null;

  const fullName = user.name || '';
  const salutationPrefix = user.salutation ? `${user.salutation}. ` : '';

  return (
    <section className="space-y-2">
      {/* Greeting */}
      <p className="text-lg md:text-xl font-semibold text-slate-600">
        {getGreeting()}, {salutationPrefix}{fullName}!
      </p>

      {/* Role badge + date */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-md uppercase tracking-wider">
          {user.role.replace('_', ' ')}
        </span>
        <span className="text-slate-500 text-sm font-semibold flex items-center gap-1.5">
          <Calendar size={14} />
          {new Date().toLocaleDateString('en-US', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      </div>
    </section>
  );
}
