import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { _axios } from "@/lib/axios";
import type { Examination, UpdateExaminationPayload } from "../types";

type UpdateExaminationVariables = { id: string } & Partial<UpdateExaminationPayload>;

export function useUpdateExamination() {
  const queryClient = useQueryClient();

  return useMutation<Examination, Error, UpdateExaminationVariables>({
    mutationFn: async ({ id, ...payload }) => {
      const res = await _axios.patch(`/admin/examinations/${id}`, payload);
      return res.data.data;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["examinations"] });
      queryClient.invalidateQueries({ queryKey: ["examination", id] });
      toast.success("Examination updated successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update examination");
    },
  });
}
