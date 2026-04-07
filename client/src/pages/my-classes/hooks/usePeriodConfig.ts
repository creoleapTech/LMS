import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import type { IPeriodConfig } from "@/types/timetable";

export function usePeriodConfig() {
  return useQuery<IPeriodConfig | null>({
    queryKey: ["period-config"],
    queryFn: async () => {
      const { data: res } = await _axios.get<{ success: boolean; data: IPeriodConfig | null }>(
        "/admin/period-config"
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
