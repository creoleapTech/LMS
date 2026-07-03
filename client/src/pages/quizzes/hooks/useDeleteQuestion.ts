import { useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { toast } from "sonner";

export function useDeleteQuestion(quizId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (questionId: string) => {
      await _axios.delete(`/admin/quizzes/${quizId}/questions/${questionId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quiz", quizId] });
      qc.invalidateQueries({ queryKey: ["quizzes"] });
      toast.success("Question deleted successfully");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err.message || "Failed to delete question";
      toast.error(msg);
    },
  });
}
