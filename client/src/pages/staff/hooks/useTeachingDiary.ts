import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { useAuthStore } from "@/store/userAuthStore";

export interface DiarySession {
  id: string;
  staffId: string;
  institutionId: string;
  classId: { _id: string; grade?: string; section?: string } | string | null;
  courseId?: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  remarks?: string;
  topicsCovered?: string[];
  status: "ongoing" | "completed";
  createdAt: string;
  updatedAt: string;
}

export function useTeachingDiary() {
  const user = useAuthStore((s) => s.user);
  const staffId = user?._id;

  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 30);
  const toDateStr = today.toISOString().split("T")[0];
  const fromDateStr = fromDate.toISOString().split("T")[0];

  const diaryQuery = useQuery<DiarySession[]>({
    queryKey: ["teaching-diary", staffId, fromDateStr, toDateStr],
    queryFn: async () => {
      const { data: res } = await _axios.get<{
        success: boolean;
        data: DiarySession[];
      }>("/admin/class-session/diary", {
        params: { staffId, fromDate: fromDateStr, toDate: toDateStr },
      });
      return res.data || [];
    },
    enabled: !!staffId,
    staleTime: 30 * 1000,
  });

  return {
    sessions: diaryQuery.data || [],
    isLoading: diaryQuery.isLoading,
    isError: diaryQuery.isError,
    error: diaryQuery.error,
    refetch: diaryQuery.refetch,
  };
}
