import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";

export interface IStaffListItem {
  _id: string;
  name: string;
  email: string;
  type: "teacher" | "admin";
  subjects?: string[];
}

export function useStaffList(institutionId: string | null) {
  return useQuery<IStaffListItem[]>({
    queryKey: ["staff-list", institutionId],
    queryFn: async () => {
      const { data: res } = await _axios.get<{
        success: boolean;
        data: IStaffListItem[];
      }>("/admin/timetable/staff-list", {
        params: { institutionId },
      });
      return res.data;
    },
    enabled: !!institutionId,
    staleTime: 2 * 60 * 1000,
  });
}
