import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import type { ITimetableEntry, IPeriodConfig } from "@/types/timetable";

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
      return res.data;
    },
    enabled: !!date,
    staleTime: 30 * 1000,
  });
}
