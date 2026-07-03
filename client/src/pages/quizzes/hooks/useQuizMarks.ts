import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";

export interface StudentMark {
  id: string;
  studentId: string;
  studentName: string;
  studentUsername: string;
  studentRollNumber: string;
  score: number;
  maxScore: number;
  percentage: number;
  startedAt: string;
  completedAt: string | null;
  timeTakenSeconds: number | null;
  attemptNumber: number;
}

export interface MarksResponse {
  quiz: {
    id: string;
    title: string;
    totalPoints: number;
    passingPoints: number;
  };
  attempts: StudentMark[];
  totalAttempts: number;
}

export function useQuizMarks(quizId: string) {
  return useQuery<MarksResponse>({
    queryKey: ["quiz-marks", quizId],
    queryFn: async () => {
      const res = await _axios.get(`/admin/quizzes/${quizId}/marks`);
      return res.data.data;
    },
    enabled: !!quizId,
  });
}
