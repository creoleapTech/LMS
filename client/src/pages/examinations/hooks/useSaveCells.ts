import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { _axios } from "@/lib/axios";
import type { CellData, SaveCellsPayload } from "../types";

type SaveCellsVariables = { id: string } & SaveCellsPayload;

export function useSaveCells() {
  return useMutation<CellData[], Error, SaveCellsVariables>({
    mutationFn: async ({ id, ...payload }) => {
      const res = await _axios.patch(`/admin/examinations/${id}/cells`, payload);
      return res.data.data;
    },
    onError: () => {
      toast.error("Failed to save cell data");
    },
  });
}
