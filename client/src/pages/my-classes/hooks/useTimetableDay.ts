import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import type { ITimetableEntry, IPeriodConfig } from "@/types/timetable";

function normalizePeriodConfig(periodConfig: IPeriodConfig | null | undefined): IPeriodConfig | null {
  if (!periodConfig) return null;

  return {
    ...periodConfig,
    periods: Array.isArray(periodConfig.periods) ? periodConfig.periods : [],
    workingDays: Array.isArray(periodConfig.workingDays)
      ? periodConfig.workingDays
      : [1, 2, 3, 4, 5],
  };
}

export function useTimetableDay(date: string | null) {
  return useQuery<{ entries: ITimetableEntry[]; periodConfig: IPeriodConfig | null }>({
    queryKey: ["timetable-day", date],
    queryFn: async () => {
      const { data: res } = await _axios.get<{
        success: boolean;
        data: { entries: ITimetableEntry[]; periodConfig: IPeriodConfig | null };
      }>("/admin/timetable/my-day", {
        params: { date },
      });

      return {
        entries: Array.isArray(res.data?.entries) ? res.data.entries : [],
        periodConfig: normalizePeriodConfig(res.data?.periodConfig),
      };
    },
    enabled: !!date,
    staleTime: 30 * 1000,
  });
}
