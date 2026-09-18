import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { _axios } from "@/lib/axios";
import type { CellData, SaveCellsPayload } from "../types";

type SaveCellsVariables = { id: string } & SaveCellsPayload;

export function useSaveCells() {
  const queryClient = useQueryClient();

  return useMutation<CellData[], Error, SaveCellsVariables>({
    mutationFn: async ({ id, ...payload }) => {
      const res = await _axios.patch(`/admin/examinations/${id}/cells`, payload);
      return res.data.data;
    },
    onSuccess: (_data, { id }) => {
      // Reconcile with server truth. The detail page overlays still-unsaved
      // (dirty) edits on top, so in-flight keystrokes are never wiped.
      queryClient.invalidateQueries({ queryKey: ["examination", id] });
    },
    onError: (error) => {
      // Surface the real reason (e.g. grade mismatch, stale column) so a
      // failed save is never mistaken for a saved value.
      toast.error(error.message || "Failed to save cell data");
    },
  });
}
