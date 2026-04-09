import { Calendar } from 'lucide-react';
import { useAuthStore } from '@/store/userAuthStore';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good evening';
}

export function DashboardHeader() {
  const { user } = useAuthStore();
  if (!user) return null;

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const fullName = user.name ? capitalize(user.name) : '';
  const salutationPrefix = user.salutation ? `${capitalize(user.salutation)}. ` : '';

  return (
    <section className="neo-card p-6 relative overflow-hidden">
      {/* Decorative gradient blobs */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-indigo-400 to-violet-500 neo-gradient-blob" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-gradient-to-br from-emerald-400 to-cyan-500 neo-gradient-blob animation-delay-2000" />

      <div className="relative z-10 space-y-2">
        {/* Greeting with gradient text */}
        <p className="text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-800 via-indigo-700 to-violet-700 bg-clip-text text-transparent">
          {getGreeting()}, {salutationPrefix}{fullName}!
        </p>

        {/* Role badge + date */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold bg-gradient-to-r from-indigo-500 to-violet-500 text-white px-3 py-1 rounded-full uppercase tracking-wider shadow-md shadow-indigo-500/20">
            {user.role.replace('_', ' ')}
          </span>
          <span className="text-slate-600 text-sm font-semibold flex items-center gap-1.5">
            <Calendar size={14} />
            {new Date().toLocaleDateString('en-US', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>
    </section>
  );
}
