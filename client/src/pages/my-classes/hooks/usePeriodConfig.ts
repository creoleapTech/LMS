import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import type { IPeriodConfig } from "@/types/timetable";

export function usePeriodConfig(institutionId?: string) {
  return useQuery<IPeriodConfig | null>({
    queryKey: ["period-config", institutionId || "own"],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (institutionId) params.institutionId = institutionId;
      const { data: res } = await _axios.get<{ success: boolean; data: IPeriodConfig | null }>(
        "/admin/period-config",
        { params }
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
