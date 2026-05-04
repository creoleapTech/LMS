import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import type { ExaminationDetail } from "../types";

export function useExamination(id: string) {
  return useQuery<ExaminationDetail>({
    queryKey: ["examination", id],
    queryFn: async () => {
      const res = await _axios.get(`/admin/examinations/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}
