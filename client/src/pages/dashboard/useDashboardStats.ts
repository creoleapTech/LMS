import { useQuery } from '@tanstack/react-query';
import { _axios } from '@/lib/axios';

interface DashboardFilters {
  year?: number;
  month?: number;
  classId?: string;
}

export function useDashboardStats(filters?: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard-stats', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.year) params.set('year', String(filters.year));
      if (filters?.month) params.set('month', String(filters.month));
      if (filters?.classId) params.set('classId', filters.classId);
      const qs = params.toString();
      const { data } = await _axios.get(`/admin/dashboard/stats${qs ? `?${qs}` : ''}`);
      return data as { success: boolean; role: string; data: any };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
