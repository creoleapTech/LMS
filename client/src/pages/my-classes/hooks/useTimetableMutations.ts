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
    queryClient.invalidateQueries({ queryKey: ["staff-timetable-month"] });
    queryClient.invalidateQueries({ queryKey: ["staff-timetable-day"] });
    queryClient.invalidateQueries({ queryKey: ["class-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["work-done"] });
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
    mutationFn: async ({ id, date, scope }: { id: string; date?: string; scope?: string }) => {
      const params = new URLSearchParams();
      if (date) params.set("date", date);
      if (scope) params.set("scope", scope);
      const qs = params.toString();
      const url = qs ? `/admin/timetable/${id}?${qs}` : `/admin/timetable/${id}`;
      await _axios.delete(url);
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Entry deleted");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to delete entry");
    },
  });

  const uncompleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { data: res } = await _axios.patch<{
        success: boolean;
        mode: "instance-removed" | "reverted-to-scheduled";
      }>(`/admin/timetable/${id}/uncomplete`);
      return res;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Work done removed — class is scheduled again");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to remove work done");
    },
  });

  return { createEntry, updateEntry, completeEntry, deleteEntry, uncompleteEntry };
}
