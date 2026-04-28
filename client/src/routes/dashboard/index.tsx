import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useAuthStore } from '../../store/userAuthStore';
import { useDashboardStats } from '../../pages/dashboard/useDashboardStats';
import { SuperAdminDashboard } from '../../pages/dashboard/SuperAdminDashboard';
import { AdminDashboard } from '../../pages/dashboard/AdminDashboard';
import { TeacherDashboard } from '../../pages/dashboard/TeacherDashboard';
import { DashboardSkeleton } from '../../pages/dashboard/components/DashboardComponents';
import { DashboardHeader } from '../../pages/dashboard/components/DashboardHeader';
import { _axios } from '../../lib/axios';

// Prefetch function — same query as useDashboardStats with no filters
async function prefetchDashboard(queryClient: any) {
  await queryClient.prefetchQuery({
    queryKey: ['dashboard-stats', undefined],
    queryFn: async () => {
      const { data } = await _axios.get('/admin/dashboard/stats');
      return data as { success: boolean; role: string; data: any };
    },
    staleTime: 60_000,
  });
}

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
        <div className="neo-card bg-gradient-to-br from-rose-50 to-rose-100/50 p-6 text-center">
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
    <div className="min-h-screen">
      <main className="p-6 md:p-8 max-w-screen-2xl mx-auto space-y-6">
        <DashboardHeader />

        {stats ? (
          <>
            {effectiveRole === 'super_admin' && <SuperAdminDashboard data={stats} />}
            {effectiveRole === 'admin' && (
              <AdminDashboard data={stats} filters={filters} onFiltersChange={setFilters} />
            )}
            {(effectiveRole === 'teacher' || effectiveRole === 'staff') && <TeacherDashboard data={stats} />}
          </>
        ) : (
          <div className="neo-card bg-gradient-to-br from-amber-50 to-amber-100/50 p-6 text-center">
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
  loader: ({ context: { queryClient } }) => prefetchDashboard(queryClient),
  component: Dashboard,
});
