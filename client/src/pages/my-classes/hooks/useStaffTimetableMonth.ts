import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import type { IMonthSummary } from "@/types/timetable";

export function useStaffTimetableMonth(
  staffId: string | null,
  institutionId: string | null,
  year: number,
  month: number
) {
  return useQuery<{ dates: IMonthSummary }>({
    queryKey: ["staff-timetable-month", staffId, institutionId, year, month],
    queryFn: async () => {
      const { data: res } = await _axios.get<{
        success: boolean;
        data: { dates: IMonthSummary };
      }>("/admin/timetable/staff-month", {
        params: {
          staffId,
          institutionId,
          year: String(year),
          month: String(month),
        },
      });
      return res.data;
    },
    enabled: !!staffId && !!institutionId,
    staleTime: 60 * 1000,
  });
}
