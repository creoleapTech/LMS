import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useAuthStore } from '../../store/userAuthStore';
import { useDashboardStats } from '../../pages/dashboard/useDashboardStats';
import { SuperAdminDashboard } from '../../pages/dashboard/SuperAdminDashboard';
import { AdminDashboard } from '../../pages/dashboard/AdminDashboard';
import { TeacherDashboard } from '../../pages/dashboard/TeacherDashboard';
import { DashboardSkeleton } from '../../pages/dashboard/components/DashboardComponents';
import { DashboardHeader } from '../../pages/dashboard/components/DashboardHeader';

function Dashboard() {
  const { user } = useAuthStore();
  const [filters, setFilters] = useState<{ year?: number; month?: number; classId?: string }>({});

  const role = user?.role;
  const isAdmin = role === 'admin';

  const { data: response, isLoading, isError, error } = useDashboardStats(isAdmin ? filters : undefined);

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

  const effectiveRole = response?.role || user.role;
  const stats = response?.data;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <main className="p-6 md:p-8 max-w-screen-2xl mx-auto space-y-6">
        {/* New Dashboard Header */}
        <DashboardHeader />

        {/* Role-specific dashboard */}
        {stats ? (
          <>
            {effectiveRole === 'super_admin' && <SuperAdminDashboard data={stats} />}
            {effectiveRole === 'admin' && (
              <AdminDashboard data={stats} filters={filters} onFiltersChange={setFilters} />
            )}
            {(effectiveRole === 'teacher' || effectiveRole === 'staff') && <TeacherDashboard data={stats} />}
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
