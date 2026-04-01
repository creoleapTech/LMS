import { useQuery } from '@tanstack/react-query';
import { _axios } from '@/lib/axios';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data } = await _axios.get('/admin/dashboard/stats');
      return data as { success: boolean; role: string; data: any };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
