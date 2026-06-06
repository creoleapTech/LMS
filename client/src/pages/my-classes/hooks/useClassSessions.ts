import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import type { IClassSession } from "@/types/timetable";

export function useClassSessions(staffId: string | null | undefined, date: string | null) {
  return useQuery<IClassSession[]>({
    queryKey: ["class-sessions", staffId, date],
    queryFn: async () => {
      const { data: res } = await _axios.get<{
        success: boolean;
        data: IClassSession[];
      }>("/admin/class-session/my-history", {
        params: { staffId, date },
      });
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!staffId && !!date,
    staleTime: 30 * 1000,
  });
}
