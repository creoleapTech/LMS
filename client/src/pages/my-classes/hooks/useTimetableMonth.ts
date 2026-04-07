import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import type { IMonthSummary } from "@/types/timetable";

export function useTimetableMonth(year: number, month: number) {
  return useQuery<{ dates: IMonthSummary }>({
    queryKey: ["timetable-month", year, month],
    queryFn: async () => {
      const { data: res } = await _axios.get<{
        success: boolean;
        data: { dates: IMonthSummary };
      }>("/admin/timetable/my-month", {
        params: { year: String(year), month: String(month) },
      });
      return res.data;
    },
    staleTime: 60 * 1000,
  });
}
