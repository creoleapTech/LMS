import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import type { QuizDetail } from "../types";

export function useQuiz(id: string) {
  return useQuery<QuizDetail>({
    queryKey: ["quiz", id],
    queryFn: async () => {
      const res = await _axios.get(`/admin/quizzes/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}
