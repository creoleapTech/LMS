import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { _axios } from "@/lib/axios";
import type { CreateExaminationPayload, Examination } from "../types";

export function useCreateExamination() {
  const queryClient = useQueryClient();

  return useMutation<Examination, Error, CreateExaminationPayload>({
    mutationFn: async (payload) => {
      const res = await _axios.post("/admin/examinations", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examinations"] });
      toast.success("Examination created successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create examination");
    },
  });
}
