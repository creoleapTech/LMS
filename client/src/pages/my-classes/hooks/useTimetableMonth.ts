import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import type { IMonthSummary } from "@/types/timetable";

export function useTimetableMonth(year: number, month: number, institutionId?: string) {
  return useQuery<{ dates: IMonthSummary }>({
    queryKey: ["timetable-month", year, month, institutionId || "own"],
    queryFn: async () => {
      const params: Record<string, string> = { year: String(year), month: String(month) };
      if (institutionId) params.institutionId = institutionId;
      const { data: res } = await _axios.get<{
        success: boolean;
        data: { dates: IMonthSummary };
      }>("/admin/timetable/my-month", {
        params,
      });
      return res.data;
    },
    staleTime: 60 * 1000,
  });
}
