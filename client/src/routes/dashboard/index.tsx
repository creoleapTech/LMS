import { createFileRoute } from '@tanstack/react-router';
import { Calendar } from 'lucide-react';
import { useAuthStore } from '../../store/userAuthStore';
import { useDashboardStats } from '../../pages/dashboard/useDashboardStats';
import { SuperAdminDashboard } from '../../pages/dashboard/SuperAdminDashboard';
import { AdminDashboard } from '../../pages/dashboard/AdminDashboard';
import { TeacherDashboard } from '../../pages/dashboard/TeacherDashboard';
import { DashboardSkeleton } from '../../pages/dashboard/components/DashboardComponents';

function Dashboard() {
  const { user } = useAuthStore();
  const { data: response, isLoading, isError, error } = useDashboardStats();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Please log in to view the dashboard.
      </div>
    );
  }

  if (isLoading) return <DashboardSkeleton />;

  if (isError) {
    return (
      <div className="p-8 max-w-screen-2xl mx-auto">
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 text-center">
          <p className="text-sm text-rose-600 font-medium">
            {(error as any)?.message || 'Failed to load dashboard data'}
          </p>
        </div>
      </div>
    );
  }

  const role = response?.role || user.role;
  const stats = response?.data;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <main className="p-6 md:p-8 max-w-screen-2xl mx-auto space-y-6">
        {/* Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Welcome back, {user.name.split(' ')[0]}
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-md uppercase tracking-wider">
                {user.role.replace('_', ' ')}
              </span>
              {typeof user.institutionId === 'object' && user.institutionId?.name && (
                <span className="text-xs text-slate-400 font-medium">{user.institutionId.name}</span>
              )}
              <span className="text-slate-300 text-xs font-medium flex items-center gap-1.5">
                <Calendar size={12} />
                {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </section>

        {/* Role-specific dashboard */}
        {stats ? (
          <>
            {role === 'super_admin' && <SuperAdminDashboard data={stats} />}
            {role === 'admin' && <AdminDashboard data={stats} />}
            {(role === 'teacher' || role === 'staff') && <TeacherDashboard data={stats} />}
          </>
        ) : (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 text-center">
            <p className="text-sm text-amber-600 font-medium">
              {(response as any)?.message || 'No dashboard data available.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export const Route = createFileRoute('/dashboard/')({
  component: Dashboard,
});
