import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { _axios } from "@/lib/axios";
import type { LessonPlan, UpdateLessonPlanPayload } from "../types";

type UpdateLessonPlanVariables = { id: string } & Partial<UpdateLessonPlanPayload>;

export function useUpdateLessonPlan() {
  const queryClient = useQueryClient();

  return useMutation<LessonPlan, Error, UpdateLessonPlanVariables, { previous?: LessonPlan }>({
    mutationFn: async ({ id, ...payload }) => {
      // If status is the only field being updated, use the dedicated status endpoint
      const keys = Object.keys(payload);
      const isStatusOnly = keys.length === 1 && keys[0] === "status";

      const url = isStatusOnly
        ? `/admin/lesson-plans/${id}/status`
        : `/admin/lesson-plans/${id}`;

      const res = await _axios.patch(url, payload);
      return res.data.data;
    },
    onMutate: async ({ id, status }) => {
      // Only apply optimistic update for status-only changes
      if (status === undefined) return {};

      await queryClient.cancelQueries({ queryKey: ["lesson-plans"] });
      const previous = queryClient.getQueryData<LessonPlan | undefined>([
        "lesson-plan",
        id,
      ]);
      queryClient.setQueryData(["lesson-plan", id], (old: LessonPlan | undefined) =>
        old ? { ...old, status } : old
      );
      return { previous };
    },
    onError: (_err, { id }, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["lesson-plan", id], context.previous);
      }
      toast.error("Failed to update lesson plan");
    },
    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["lesson-plan", id] });
      queryClient.invalidateQueries({ queryKey: ["lesson-plans"] });
    },
  });
}
