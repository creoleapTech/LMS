import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import type { ITimetableEntry, IPeriodConfig } from "@/types/timetable";

export function useStaffTimetableDay(
  staffId: string | null,
  institutionId: string | null,
  date: string | null
) {
  return useQuery<{ entries: ITimetableEntry[]; periodConfig: IPeriodConfig | null }>({
    queryKey: ["staff-timetable-day", staffId, institutionId, date],
    queryFn: async () => {
      const { data: res } = await _axios.get<{
        success: boolean;
        data: { entries: ITimetableEntry[]; periodConfig: IPeriodConfig | null };
      }>("/admin/timetable/staff-day", {
        params: { staffId, institutionId, date },
      });
      return res.data;
    },
    enabled: !!staffId && !!institutionId && !!date,
    staleTime: 30 * 1000,
  });
}
