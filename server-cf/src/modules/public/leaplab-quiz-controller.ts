import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { eq, and, count, desc, sql } from "drizzle-orm";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import {
  institutionQuizzes,
  institutionQuizQuestions,
  institutionQuizQuestionOptions,
  institutionQuizAttempts,
  institutionQuizAttemptAnswers,
} from "../../schema/quiz";
import { students, institutions } from "../../schema/admin";
import { nowISO } from "../../lib/utils";
import { BadRequestError } from "../../lib/errors/bad-request";
import { UnauthorizedError } from "../../lib/errors/unauthorized";
import { adminAuth } from "../../middleware/admin-auth";

const app = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Use adminAuth so student tokens (encoded with teacher key) can access
app.use("*", adminAuth);

// ─── GET /quizzes — list published quizzes for student's institution ───
app.get("/quizzes", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const instId =
    typeof user.institutionId === "object"
      ? (user.institutionId as any)?._id?.toString()
      : user.institutionId?.toString();

  if (!instId) throw new UnauthorizedError("No institution associated");

  const now = new Date().toISOString();

  // Get published quizzes for this institution that are within their date range
  const quizzes = await db
    .select({
      id: institutionQuizzes.id,
      title: institutionQuizzes.title,
      description: institutionQuizzes.description,
      totalPoints: institutionQuizzes.totalPoints,
      passingPoints: institutionQuizzes.passingPoints,
      timeLimitMinutes: institutionQuizzes.timeLimitMinutes,
      retakeAllowed: institutionQuizzes.retakeAllowed,
      maxRetakes: institutionQuizzes.maxRetakes,
      startDate: institutionQuizzes.startDate,
      endDate: institutionQuizzes.endDate,
      createdAt: institutionQuizzes.createdAt,
    })
    .from(institutionQuizzes)
    .where(
      and(
        eq(institutionQuizzes.institutionId, instId),
        eq(institutionQuizzes.isPublished, 1),
        eq(institutionQuizzes.isDeleted, 0),
        eq(institutionQuizzes.isActive, 1),
      ),
    )
    .orderBy(desc(institutionQuizzes.createdAt));

  // Filter by date range in JS and enrich with question count + attempt info
  const enriched = await Promise.all(
    quizzes.map(async (quiz) => {
      // Date filtering
      if (quiz.startDate && now < quiz.startDate) return null;
      if (quiz.endDate && now > quiz.endDate) return null;

      const [qCount] = await db
        .select({ count: count() })
        .from(institutionQuizQuestions)
        .where(
          and(
            eq(institutionQuizQuestions.quizId, quiz.id),
            eq(institutionQuizQuestions.isDeleted, 0),
          ),
        );

      // Check student's attempts
      const [attemptCount] = await db
        .select({ count: count() })
        .from(institutionQuizAttempts)
        .where(
          and(
            eq(institutionQuizAttempts.quizId, quiz.id),
            eq(institutionQuizAttempts.studentId, user.userId as string),
            eq(institutionQuizAttempts.isDeleted, 0),
          ),
        );

      const [lastAttempt] = await db
        .select()
        .from(institutionQuizAttempts)
        .where(
          and(
            eq(institutionQuizAttempts.quizId, quiz.id),
            eq(institutionQuizAttempts.studentId, user.userId as string),
            eq(institutionQuizAttempts.isDeleted, 0),
          ),
        )
        .orderBy(desc(institutionQuizAttempts.attemptNumber))
        .limit(1);

      const canRetake =
        quiz.retakeAllowed === 1 &&
        (quiz.maxRetakes === 0 || (attemptCount?.count ?? 0) < quiz.maxRetakes);

      const hasAttempted = (attemptCount?.count ?? 0) > 0;

      return {
        ...quiz,
        questionCount: qCount?.count ?? 0,
        attemptCount: attemptCount?.count ?? 0,
        canRetake,
        hasAttempted,
        lastScore: lastAttempt?.score ?? null,
        lastMaxScore: lastAttempt?.maxScore ?? null,
      };
    }),
  );

  return c.json(
    { success: true, data: enriched.filter(Boolean) },
    200,
  );
});

// ─── GET /quizzes/:id — get quiz for taking (no correct answers) ──
app.get("/quizzes/:id", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);
  const { id: quizId } = c.req.param();

  const instId =
    typeof user.institutionId === "object"
      ? (user.institutionId as any)?._id?.toString()
      : user.institutionId?.toString();

  const [quiz] = await db
    .select()
    .from(institutionQuizzes)
    .where(
      and(
        eq(institutionQuizzes.id, quizId),
        eq(institutionQuizzes.institutionId, instId!),
        eq(institutionQuizzes.isPublished, 1),
        eq(institutionQuizzes.isDeleted, 0),
      ),
    )
    .limit(1);

  if (!quiz) throw new BadRequestError("Quiz not found");

  // Check date range
  const now = new Date().toISOString();
  if (quiz.startDate && now < quiz.startDate) {
    throw new BadRequestError("Quiz has not started yet");
  }
  if (quiz.endDate && now > quiz.endDate) {
    throw new BadRequestError("Quiz has expired");
  }

  // Check if student can attempt
  const [attemptCount] = await db
    .select({ count: count() })
    .from(institutionQuizAttempts)
    .where(
      and(
        eq(institutionQuizAttempts.quizId, quizId),
        eq(institutionQuizAttempts.studentId, user.userId as string),
        eq(institutionQuizAttempts.isDeleted, 0),
      ),
    );

  if (quiz.retakeAllowed !== 1 && (attemptCount?.count ?? 0) > 0) {
    throw new BadRequestError("You have already attempted this quiz");
  }

  if (quiz.maxRetakes !== 0 && (attemptCount?.count ?? 0) >= quiz.maxRetakes) {
    throw new BadRequestError("Maximum retake attempts reached");
  }

  // Get questions WITHOUT correct answers
  const questions = await db
    .select({
      id: institutionQuizQuestions.id,
      questionText: institutionQuizQuestions.questionText,
      questionMediaUrl: institutionQuizQuestions.questionMediaUrl,
      questionMediaType: institutionQuizQuestions.questionMediaType,
      answerType: institutionQuizQuestions.answerType,
      points: institutionQuizQuestions.points,
      order: institutionQuizQuestions.order,
    })
    .from(institutionQuizQuestions)
    .where(
      and(
        eq(institutionQuizQuestions.quizId, quizId),
        eq(institutionQuizQuestions.isDeleted, 0),
      ),
    )
    .orderBy(institutionQuizQuestions.order);

  const questionsWithOptions = await Promise.all(
    questions.map(async (q) => {
      const options = await db
        .select({
          id: institutionQuizQuestionOptions.id,
          text: institutionQuizQuestionOptions.text,
          mediaUrl: institutionQuizQuestionOptions.mediaUrl,
          mediaType: institutionQuizQuestionOptions.mediaType,
          order: institutionQuizQuestionOptions.order,
        })
        .from(institutionQuizQuestionOptions)
        .where(
          and(
            eq(institutionQuizQuestionOptions.questionId, q.id),
            eq(institutionQuizQuestionOptions.isDeleted, 0),
          ),
        )
        .orderBy(institutionQuizQuestionOptions.order);
      return { ...q, options };
    }),
  );

  return c.json(
    {
      success: true,
      data: {
        ...quiz,
        questions: questionsWithOptions,
        attemptNumber: (attemptCount?.count ?? 0) + 1,
      },
    },
    200,
  );
});

// ─── POST /quizzes/:id/start — start a quiz attempt ──────────────
app.post("/quizzes/:id/start", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);
  const { id: quizId } = c.req.param();

  const instId =
    typeof user.institutionId === "object"
      ? (user.institutionId as any)?._id?.toString()
      : user.institutionId?.toString();

  const [quiz] = await db
    .select()
    .from(institutionQuizzes)
    .where(
      and(
        eq(institutionQuizzes.id, quizId),
        eq(institutionQuizzes.institutionId, instId!),
        eq(institutionQuizzes.isPublished, 1),
        eq(institutionQuizzes.isDeleted, 0),
      ),
    )
    .limit(1);

  if (!quiz) throw new BadRequestError("Quiz not found");

  // Check date range
  const now = new Date().toISOString();
  if (quiz.startDate && now < quiz.startDate) {
    throw new BadRequestError("Quiz has not started yet");
  }
  if (quiz.endDate && now > quiz.endDate) {
    throw new BadRequestError("Quiz has expired");
  }

  // Check existing attempts
  const [attemptCount] = await db
    .select({ count: count() })
    .from(institutionQuizAttempts)
    .where(
      and(
        eq(institutionQuizAttempts.quizId, quizId),
        eq(institutionQuizAttempts.studentId, user.userId as string),
        eq(institutionQuizAttempts.isDeleted, 0),
      ),
    );

  if (quiz.retakeAllowed !== 1 && (attemptCount?.count ?? 0) > 0) {
    throw new BadRequestError("You have already attempted this quiz");
  }

  if (quiz.maxRetakes !== 0 && (attemptCount?.count ?? 0) >= quiz.maxRetakes) {
    throw new BadRequestError("Maximum retake attempts reached");
  }

  // Get total points
  const [totalRow] = await db
    .select({ total: sql<number>`coalesce(sum(${institutionQuizQuestions.points}), 0)` })
    .from(institutionQuizQuestions)
    .where(
      and(
        eq(institutionQuizQuestions.quizId, quizId),
        eq(institutionQuizQuestions.isDeleted, 0),
      ),
    );

  const attemptId = uuid();
  const attemptNumber = (attemptCount?.count ?? 0) + 1;

  await db.insert(institutionQuizAttempts).values({
    id: attemptId,
    quizId,
    studentId: user.userId as string,
    score: 0,
    maxScore: totalRow?.total ?? 0,
    startedAt: nowISO(),
    attemptNumber,
    isDeleted: 0,
    createdAt: nowISO(),
  });

  return c.json(
    {
      success: true,
      data: {
        attemptId,
        quizId,
        attemptNumber,
        maxScore: totalRow?.total ?? 0,
        startedAt: nowISO(),
      },
    },
    201,
  );
});

// ─── POST /quizzes/attempts/:attemptId/submit — submit answers ────
app.post("/quizzes/attempts/:attemptId/submit", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);
  const { attemptId } = c.req.param();

  const body = await c.req.json();
  const rawAnswers: { questionId: string; selectedAnswer: string }[] = body.answers || [];

  // Deduplicate by questionId — keep last answer per question to prevent double-point exploit
  const answersMap = new Map<string, { questionId: string; selectedAnswer: string }>();
  for (const a of rawAnswers) {
    if (a.questionId && typeof a.selectedAnswer === "string") {
      answersMap.set(a.questionId, a);
    }
  }
  const answers = Array.from(answersMap.values());

  // Get attempt
  const [attempt] = await db
    .select()
    .from(institutionQuizAttempts)
    .where(
      and(
        eq(institutionQuizAttempts.id, attemptId),
        eq(institutionQuizAttempts.studentId, user.userId as string),
        eq(institutionQuizAttempts.isDeleted, 0),
      ),
    )
    .limit(1);

  if (!attempt) throw new BadRequestError("Attempt not found");
  if (attempt.completedAt) throw new BadRequestError("Attempt already submitted");

  let totalScore = 0;
  const now = nowISO();

  for (const answer of answers) {
    // Get question with correct answer
    const [question] = await db
      .select()
      .from(institutionQuizQuestions)
      .where(
        and(
          eq(institutionQuizQuestions.id, answer.questionId),
          eq(institutionQuizQuestions.isDeleted, 0),
        ),
      )
      .limit(1);

    if (!question) continue;

    const isCorrect =
      answer.selectedAnswer.toLowerCase().trim() ===
      (question.correctAnswer || "").toLowerCase().trim();

    const pointsAwarded = isCorrect ? (question.points ?? 0) : 0;
    totalScore += pointsAwarded;

    await db.insert(institutionQuizAttemptAnswers).values({
      id: uuid(),
      attemptId,
      questionId: answer.questionId,
      selectedAnswer: answer.selectedAnswer,
      isCorrect: isCorrect ? 1 : 0,
      pointsAwarded,
    });
  }

  // Update attempt
  const timeTaken = attempt.startedAt
    ? Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000)
    : null;

  await db
    .update(institutionQuizAttempts)
    .set({
      score: totalScore,
      completedAt: now,
      timeTakenSeconds: timeTaken,
    })
    .where(eq(institutionQuizAttempts.id, attemptId));

  return c.json(
    {
      success: true,
      data: {
        attemptId,
        score: totalScore,
        maxScore: attempt.maxScore,
        timeTakenSeconds: timeTaken,
        completedAt: now,
      },
    },
    200,
  );
});

// ─── GET /quizzes/attempts/:attemptId/result — get detailed result ──
app.get("/quizzes/attempts/:attemptId/result", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);
  const { attemptId } = c.req.param();

  const [attempt] = await db
    .select()
    .from(institutionQuizAttempts)
    .where(
      and(
        eq(institutionQuizAttempts.id, attemptId),
        eq(institutionQuizAttempts.studentId, user.userId as string),
        eq(institutionQuizAttempts.isDeleted, 0),
      ),
    )
    .limit(1);

  if (!attempt) throw new BadRequestError("Attempt not found");

  const answers = await db
    .select({
      id: institutionQuizAttemptAnswers.id,
      questionId: institutionQuizAttemptAnswers.questionId,
      selectedAnswer: institutionQuizAttemptAnswers.selectedAnswer,
      isCorrect: institutionQuizAttemptAnswers.isCorrect,
      pointsAwarded: institutionQuizAttemptAnswers.pointsAwarded,
      questionText: institutionQuizQuestions.questionText,
      correctAnswer: institutionQuizQuestions.correctAnswer,
      explanation: institutionQuizQuestions.explanation,
      points: institutionQuizQuestions.points,
    })
    .from(institutionQuizAttemptAnswers)
    .innerJoin(
      institutionQuizQuestions,
      eq(institutionQuizAttemptAnswers.questionId, institutionQuizQuestions.id),
    )
    .where(eq(institutionQuizAttemptAnswers.attemptId, attemptId));

  return c.json(
    {
      success: true,
      data: {
        attempt,
        answers,
      },
    },
    200,
  );
});

export { app as leaplabQuizController };
