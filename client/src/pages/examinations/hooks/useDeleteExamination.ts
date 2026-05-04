import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { _axios } from "@/lib/axios";

export function useDeleteExamination() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await _axios.delete(`/admin/examinations/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["examinations"] });
      queryClient.removeQueries({ queryKey: ["examination", id] });
      toast.success("Examination deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete examination");
    },
  });
}
