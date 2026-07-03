import { useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { toast } from "sonner";
import type { CreateQuizValues } from "../types";

export function useCreateQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateQuizValues) => {
      const res = await _axios.post("/admin/quizzes", payload);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quizzes"] });
      toast.success("Quiz created successfully");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create quiz");
    },
  });
}
