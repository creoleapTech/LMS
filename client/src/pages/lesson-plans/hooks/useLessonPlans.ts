import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import type { LessonPlan, PlanStatus } from "../types";

export interface LessonPlansParams {
  teacherId?: string;
  institutionId?: string;
  status?: PlanStatus;
  year?: number;
  month?: number;
  page?: number;
  limit?: number;
}

export function useLessonPlans(params: LessonPlansParams = {}) {
  return useQuery<LessonPlan[]>({
    queryKey: ["lesson-plans", params],
    queryFn: async () => {
      const res = await _axios.get("/admin/lesson-plans", { params });
      return res.data.data;
    },
  });
}
