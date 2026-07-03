import { useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { toast } from "sonner";

export function useUpdateQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const res = await _axios.patch(`/admin/quizzes/${id}`, data);
      return res.data.data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["quizzes"] });
      qc.invalidateQueries({ queryKey: ["quiz", variables.id] });
      toast.success("Quiz updated successfully");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update quiz");
    },
  });
}
