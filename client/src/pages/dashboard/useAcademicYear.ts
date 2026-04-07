import { useQuery } from '@tanstack/react-query';
import { _axios } from '@/lib/axios';
import type { IAcademicYear } from '@/types/academic-year';

export function useActiveAcademicYear(institutionId?: string) {
  return useQuery<IAcademicYear | null>({
    queryKey: ['active-academic-year', institutionId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (institutionId) params.set('institutionId', institutionId);
      const { data } = await _axios.get(`/admin/academic-year/active?${params}`);
      return data.data;
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
