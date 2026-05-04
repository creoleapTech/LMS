import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import type { Examination } from "../types";

export interface ExaminationsParams {
  page?: number;
  limit?: number;
  search?: string;
  institutionId?: string;
}

export interface ExaminationsMeta {
  total: number;
  page: number;
  limit: number;
}

export interface ExaminationsResponse {
  data: Examination[];
  meta: ExaminationsMeta;
}

export function useExaminations(params: ExaminationsParams = {}) {
  return useQuery<ExaminationsResponse>({
    queryKey: ["examinations", params],
    queryFn: async () => {
      const res = await _axios.get("/admin/examinations", { params });
      // res.data = { success, data: [...], meta: {...} }
      return { data: res.data.data ?? [], meta: res.data.meta ?? { total: 0, page: 1, limit: 10 } };
    },
  });
}
