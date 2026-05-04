import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { _axios } from "@/lib/axios";
import type { ExaminationColumn } from "../types";

type SaveColumnsVariables = { id: string; columns: ExaminationColumn[] };

export function useSaveColumns() {
  const queryClient = useQueryClient();

  return useMutation<ExaminationColumn[], Error, SaveColumnsVariables>({
    mutationFn: async ({ id, columns }) => {
      const res = await _axios.put(`/admin/examinations/${id}/columns`, { columns });
      return res.data.data;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["examination", id] });
      toast.success("Columns saved");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save columns");
    },
  });
}
