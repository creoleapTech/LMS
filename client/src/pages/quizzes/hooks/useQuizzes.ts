import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import type { Quiz, QuizMeta } from "../types";

export interface QuizzesParams {
  page?: number;
  limit?: number;
  search?: string;
  institutionId?: string;
}

export interface QuizzesResponse {
  data: Quiz[];
  meta: QuizMeta;
}

export function useQuizzes(params: QuizzesParams = {}) {
  return useQuery<QuizzesResponse>({
    queryKey: ["quizzes", params],
    queryFn: async () => {
      const res = await _axios.get("/admin/quizzes", { params });
      return {
        data: res.data.data ?? [],
        meta: res.data.meta ?? { total: 0, page: 1, limit: 20 },
      };
    },
  });
}
