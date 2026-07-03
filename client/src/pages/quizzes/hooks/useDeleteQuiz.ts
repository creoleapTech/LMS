import { useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { toast } from "sonner";

export function useDeleteQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await _axios.delete(`/admin/quizzes/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quizzes"] });
      toast.success("Quiz deleted successfully");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete quiz");
    },
  });
}
