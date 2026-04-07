import { useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { toast } from "sonner";
import type {
  CreateTimetableEntryDTO,
  CompleteTimetableEntryDTO,
  ITimetableEntry,
} from "@/types/timetable";

export function useTimetableMutations() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["timetable-month"] });
    queryClient.invalidateQueries({ queryKey: ["timetable-day"] });
  };

  const createEntry = useMutation({
    mutationFn: async (dto: CreateTimetableEntryDTO) => {
      const { data: res } = await _axios.post<{
        success: boolean;
        data: ITimetableEntry;
      }>("/admin/timetable", dto);
      return res.data;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Schedule entry created");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to create entry");
    },
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateTimetableEntryDTO> }) => {
      const { data: res } = await _axios.patch<{
        success: boolean;
        data: ITimetableEntry;
      }>(`/admin/timetable/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Schedule entry updated");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to update entry");
    },
  });

  const completeEntry = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CompleteTimetableEntryDTO }) => {
      const { data: res } = await _axios.patch<{
        success: boolean;
        data: ITimetableEntry;
      }>(`/admin/timetable/${id}/complete`, data);
      return res.data;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Marked as completed");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to mark complete");
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      await _axios.delete(`/admin/timetable/${id}`);
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Entry deleted");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to delete entry");
    },
  });

  return { createEntry, updateEntry, completeEntry, deleteEntry };
}
