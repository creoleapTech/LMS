import { z } from "zod";

// ─── Quiz ──────────────────────────────────────────────────────

export interface Quiz {
  id: string;
  institutionId: string;
  title: string;
  description: string | null;
  createdBy: string;
  totalPoints: number;
  passingPoints: number;
  startDate: string | null;
  endDate: string | null;
  timeLimitMinutes: number | null;
  retakeAllowed: number;
  maxRetakes: number;
  isPublished: number;
  isActive: number;
  isDeleted: number;
  createdAt: string;
  updatedAt: string;
  questionCount?: number;
}

export interface QuizDetail extends Quiz {
  questions: QuizQuestion[];
}

// ─── Question ──────────────────────────────────────────────────

export interface QuizQuestion {
  id: string;
  quizId: string;
  questionText: string;
  questionMediaUrl: string | null;
  questionMediaType: string | null;
  answerType: string;
  correctAnswer: string;
  explanation: string | null;
  points: number;
  order: number;
  options: QuizQuestionOption[];
}

export interface QuizQuestionOption {
  id: string;
  questionId: string;
  text: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  order: number;
}

// ─── Attempt ───────────────────────────────────────────────────

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  score: number;
  maxScore: number;
  startedAt: string;
  completedAt: string | null;
  timeTakenSeconds: number | null;
  attemptNumber: number;
}

// ─── Schemas ───────────────────────────────────────────────────

export const createQuizSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  timeLimitMinutes: z.number().int().min(1).max(1440).optional().nullable(),
  retakeAllowed: z.boolean().optional(),
  maxRetakes: z.number().int().min(0).max(100).optional(),
  passingPoints: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
});

export type CreateQuizValues = z.infer<typeof createQuizSchema>;

export const createQuestionSchema = z.object({
  questionText: z.string().min(1, "Question text is required"),
  answerType: z.enum(["multiple_choice", "true_false"]).default("multiple_choice"),
  correctAnswer: z.string().min(1, "Select the correct answer"),
  explanation: z.string().optional(),
  points: z.number().int().min(0).max(100).default(1),
  options: z
    .array(
      z.object({
        text: z.string().min(1, "Option text is required"),
      }),
    )
    .min(2, "At least 2 options required"),
});

export type CreateQuestionValues = z.infer<typeof createQuestionSchema>;

// ─── API Meta ──────────────────────────────────────────────────

export interface QuizMeta {
  total: number;
  page: number;
  limit: number;
}
