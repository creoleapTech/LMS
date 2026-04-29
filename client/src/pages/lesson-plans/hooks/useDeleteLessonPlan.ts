import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { _axios } from "@/lib/axios";

export function useDeleteLessonPlan() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await _axios.delete(`/admin/lesson-plans/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["lesson-plans"] });
      queryClient.removeQueries({ queryKey: ["lesson-plan", id] });
      toast.success("Lesson plan deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete lesson plan");
    },
  });
}
