import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { _axios } from "@/lib/axios";
import type { CreateLessonPlanPayload, LessonPlan } from "../types";

export function useCreateLessonPlan() {
  const queryClient = useQueryClient();

  return useMutation<LessonPlan, Error, CreateLessonPlanPayload>({
    mutationFn: async (payload) => {
      const res = await _axios.post("/admin/lesson-plans", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-plans"] });
      toast.success("Lesson plan created successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create lesson plan");
    },
  });
}
