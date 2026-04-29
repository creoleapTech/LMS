import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import type { LessonPlan } from "../types";

export function useLessonPlan(id: string) {
  return useQuery<LessonPlan>({
    queryKey: ["lesson-plan", id],
    queryFn: async () => {
      const res = await _axios.get(`/admin/lesson-plans/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}
