import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
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
import { institutions, students } from "../../schema/admin";
import { saveFile } from "../../lib/file";
import { nowISO } from "../../lib/utils";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";
import { adminAuth } from "../../middleware/admin-auth";

const app = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

app.use("*", adminAuth);

// ─── Helpers ───────────────────────────────────────────────────

function assertInstitutionAccess(user: Record<string, any>, institutionId: string) {
  if (user.role !== "super_admin") {
    const userInstId =
      typeof user.institutionId === "object"
        ? (user.institutionId as any)?._id?.toString()
        : user.institutionId?.toString();
    if (userInstId !== institutionId) {
      throw new ForbiddenError("Access denied to this institution");
    }
  }
}

async function recalcQuizPoints(db: ReturnType<typeof getDb>, quizId: string) {
  const [total] = await db
    .select({ total: sql<number>`coalesce(sum(${institutionQuizQuestions.points}), 0)` })
    .from(institutionQuizQuestions)
    .where(and(eq(institutionQuizQuestions.quizId, quizId), eq(institutionQuizQuestions.isDeleted, 0)));

  await db
    .update(institutionQuizzes)
    .set({ totalPoints: total?.total ?? 0, updatedAt: nowISO() })
    .where(eq(institutionQuizzes.id, quizId));
}

// ─── Zod Schemas ───────────────────────────────────────────────

const createQuizSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  institutionId: z.string().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  timeLimitMinutes: z.number().int().min(1).max(1440).optional().nullable(),
  retakeAllowed: z.boolean().optional(),
  maxRetakes: z.number().int().min(0).max(100).optional(),
  passingPoints: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
});

const createQuestionSchema = z.object({
  questionText: z.string().min(1, "Question text is required").max(2000, "Question too long"),
  answerType: z.enum(["multiple_choice", "true_false"]).default("multiple_choice"),
  correctAnswer: z.string().min(1, "Correct answer is required").max(500, "Answer too long"),
  explanation: z.string().max(2000, "Explanation too long").optional().or(z.literal("")),
  points: z.number().int().min(0).max(100).default(1),
  options: z
    .array(
      z.object({
        text: z.string().min(1),
        mediaUrl: z.string().optional().nullable(),
        mediaType: z.enum(["image", "video"]).optional().nullable(),
      }),
    )
    .min(2, "At least 2 options required"),
});

// ─── QUIZ CRUD ─────────────────────────────────────────────────

// GET / — list quizzes for institution
app.get("/", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const institutionId = c.req.query("institutionId");
  const search = c.req.query("search");
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const limit = Math.min(100, parseInt(c.req.query("limit") || "20", 10));
  const offset = (page - 1) * limit;

  const conditions: any[] = [eq(institutionQuizzes.isDeleted, 0)];

  if (institutionId) {
    conditions.push(eq(institutionQuizzes.institutionId, institutionId));
  } else if (user.role !== "super_admin") {
    const instId =
      typeof user.institutionId === "object"
        ? (user.institutionId as any)?._id?.toString()
        : user.institutionId?.toString();
    if (instId) conditions.push(eq(institutionQuizzes.institutionId, instId));
  }

  if (search) {
    conditions.push(sql`${institutionQuizzes.title} LIKE ${`%${search}%`}`);
  }

  const [totalRow] = await db
    .select({ count: count() })
    .from(institutionQuizzes)
    .where(and(...conditions));

  const rows = await db
    .select()
    .from(institutionQuizzes)
    .where(and(...conditions))
    .orderBy(desc(institutionQuizzes.createdAt))
    .limit(limit)
    .offset(offset);

  // Enrich with question count
  const enriched = await Promise.all(
    rows.map(async (quiz) => {
      const [qCount] = await db
        .select({ count: count() })
        .from(institutionQuizQuestions)
        .where(and(eq(institutionQuizQuestions.quizId, quiz.id), eq(institutionQuizQuestions.isDeleted, 0)));
      return { ...quiz, questionCount: qCount?.count ?? 0 };
    }),
  );

  return c.json(
    { success: true, data: enriched, meta: { total: totalRow?.count ?? 0, page, limit } },
    200,
  );
});

// POST / — create quiz
app.post("/", zValidator("json", createQuizSchema), async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);
  const body = c.req.valid("json");

  const instId =
    typeof user.institutionId === "object"
      ? (user.institutionId as any)?._id?.toString()
      : user.institutionId?.toString() || body.institutionId;

  if (!instId) throw new BadRequestError("No institution associated with your account");

  assertInstitutionAccess(user, instId);

  const id = uuid();
  const now = nowISO();

  const [quiz] = await db
    .insert(institutionQuizzes)
    .values({
      id,
      institutionId: instId,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      createdBy: (user.id || user.userId) as string,
      startDate: body.startDate || null,
      endDate: body.endDate || null,
      timeLimitMinutes: body.timeLimitMinutes || null,
      retakeAllowed: body.retakeAllowed ? 1 : 0,
      maxRetakes: body.maxRetakes ?? 0,
      passingPoints: body.passingPoints ?? 0,
      isPublished: body.isPublished ? 1 : 0,
      totalPoints: 0,
      isActive: 1,
      isDeleted: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json({ success: true, data: quiz }, 201);
});

// GET /:id — get quiz with questions
app.get("/:id", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);
  const { id } = c.req.param();

  const [quiz] = await db
    .select()
    .from(institutionQuizzes)
    .where(and(eq(institutionQuizzes.id, id), eq(institutionQuizzes.isDeleted, 0)))
    .limit(1);

  if (!quiz) throw new BadRequestError("Quiz not found");
  assertInstitutionAccess(user, quiz.institutionId);

  const questions = await db
    .select()
    .from(institutionQuizQuestions)
    .where(and(eq(institutionQuizQuestions.quizId, id), eq(institutionQuizQuestions.isDeleted, 0)))
    .orderBy(institutionQuizQuestions.order);

  // Fetch options for each question
  const questionsWithOptions = await Promise.all(
    questions.map(async (q) => {
      const options = await db
        .select()
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
    { success: true, data: { ...quiz, questions: questionsWithOptions } },
    200,
  );
});

// PATCH /:id — update quiz
app.patch("/:id", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);
  const { id } = c.req.param();
  const body = await c.req.json();

  const [existing] = await db
    .select()
    .from(institutionQuizzes)
    .where(and(eq(institutionQuizzes.id, id), eq(institutionQuizzes.isDeleted, 0)))
    .limit(1);

  if (!existing) throw new BadRequestError("Quiz not found");
  assertInstitutionAccess(user, existing.institutionId);

  // Validate no negative values
  if (body.passingPoints !== undefined && body.passingPoints < 0) {
    throw new BadRequestError("Passing points cannot be negative");
  }
  if (body.maxRetakes !== undefined && body.maxRetakes < 0) {
    throw new BadRequestError("Max retakes cannot be negative");
  }
  if (body.timeLimitMinutes !== undefined && body.timeLimitMinutes !== null && body.timeLimitMinutes < 0) {
    throw new BadRequestError("Time limit cannot be negative");
  }

  // If publishing, require at least one question
  if (body.isPublished === true || body.isPublished === 1) {
    const [qCount] = await db
      .select({ count: count() })
      .from(institutionQuizQuestions)
      .where(and(eq(institutionQuizQuestions.quizId, id), eq(institutionQuizQuestions.isDeleted, 0)));
    if ((qCount?.count ?? 0) === 0) {
      throw new BadRequestError("Cannot publish a quiz without questions. Add at least one question first.");
    }

    // Validate passing points does not exceed total points from questions
    const passingPts = body.passingPoints ?? existing.passingPoints ?? 0;
    if (passingPts > 0) {
      const [totalRow] = await db
        .select({ total: sql<number>`coalesce(sum(${institutionQuizQuestions.points}), 0)` })
        .from(institutionQuizQuestions)
        .where(and(eq(institutionQuizQuestions.quizId, id), eq(institutionQuizQuestions.isDeleted, 0)));
      if (passingPts > (totalRow?.total ?? 0)) {
        throw new BadRequestError("Passing points cannot exceed total question points");
      }
    }
  }

  const updateData: Record<string, any> = { updatedAt: nowISO() };
  if (body.title !== undefined) updateData.title = body.title.trim();
  if (body.description !== undefined) updateData.description = body.description?.trim() || null;
  if (body.startDate !== undefined) updateData.startDate = body.startDate || null;
  if (body.endDate !== undefined) updateData.endDate = body.endDate || null;
  if (body.timeLimitMinutes !== undefined) updateData.timeLimitMinutes = body.timeLimitMinutes || null;
  if (body.retakeAllowed !== undefined) updateData.retakeAllowed = body.retakeAllowed ? 1 : 0;
  if (body.maxRetakes !== undefined) updateData.maxRetakes = body.maxRetakes;
  if (body.passingPoints !== undefined) updateData.passingPoints = body.passingPoints;
  if (body.isPublished !== undefined) updateData.isPublished = body.isPublished ? 1 : 0;

  await db.update(institutionQuizzes).set(updateData).where(eq(institutionQuizzes.id, id));

  const [updated] = await db
    .select()
    .from(institutionQuizzes)
    .where(eq(institutionQuizzes.id, id))
    .limit(1);

  return c.json({ success: true, data: updated }, 200);
});

// DELETE /:id — soft delete quiz
app.delete("/:id", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);
  const { id } = c.req.param();

  const [existing] = await db
    .select()
    .from(institutionQuizzes)
    .where(and(eq(institutionQuizzes.id, id), eq(institutionQuizzes.isDeleted, 0)))
    .limit(1);

  if (!existing) throw new BadRequestError("Quiz not found");
  assertInstitutionAccess(user, existing.institutionId);

  await db
    .update(institutionQuizzes)
    .set({ isDeleted: 1, updatedAt: nowISO() })
    .where(eq(institutionQuizzes.id, id));

  return c.json({ success: true, message: "Quiz deleted successfully" }, 200);
});

// ─── QUESTION CRUD ─────────────────────────────────────────────

// POST /:id/questions — add question to quiz
app.post("/:id/questions", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);
  const { id: quizId } = c.req.param();

  const [quiz] = await db
    .select()
    .from(institutionQuizzes)
    .where(and(eq(institutionQuizzes.id, quizId), eq(institutionQuizzes.isDeleted, 0)))
    .limit(1);

  if (!quiz) throw new BadRequestError("Quiz not found");
  assertInstitutionAccess(user, quiz.institutionId);

  // Handle both JSON and FormData
  const contentType = c.req.header("content-type") || "";
  let questionText = "";
  let answerType = "multiple_choice";
  let correctAnswer = "";
  let explanation = "";
  let points = 1;
  let options: { text: string; mediaUrl?: string | null; mediaType?: string | null }[] = [];
  let questionMediaUrl: string | null = null;
  let questionMediaType: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData();
    questionText = (formData.get("questionText") as string) || "";
    answerType = (formData.get("answerType") as string) || "multiple_choice";
    correctAnswer = (formData.get("correctAnswer") as string) || "";
    explanation = (formData.get("explanation") as string) || "";
    points = parseInt(formData.get("points") as string) || 1;

    // Question image
    const qMedia = formData.get("questionMedia");
    if (qMedia && qMedia instanceof File && qMedia.size > 0) {
      const ext = qMedia.name.split(".").pop() || "png";
      const result = await saveFile(c.env.BUCKET, qMedia, `quizzes/${quizId}/questions`);
      if (result.ok) {
        questionMediaUrl = result.key;
        questionMediaType = ext.match(/mp4|webm|mov/) ? "video" : "image";
      }
    }

    // Parse options from form data
    const optionsRaw = formData.get("options");
    if (optionsRaw && typeof optionsRaw === "string") {
      try {
        options = JSON.parse(optionsRaw);
      } catch {}
    }

    // Option images
    for (let i = 0; i < options.length; i++) {
      const optFile = formData.get(`optionMedia_${i}`);
      if (optFile && optFile instanceof File && optFile.size > 0) {
        const result = await saveFile(c.env.BUCKET, optFile, `quizzes/${quizId}/options`);
        if (result.ok) {
          options[i].mediaUrl = result.key;
          const ext = optFile.name.split(".").pop() || "png";
          options[i].mediaType = ext.match(/mp4|webm|mov/) ? "video" : "image";
        }
      }
    }
  } else {
    const body = await c.req.json();
    questionText = body.questionText || "";
    answerType = body.answerType || "multiple_choice";
    correctAnswer = body.correctAnswer || "";
    explanation = body.explanation || "";
    points = body.points ?? 1;
    options = body.options || [];
  }

  if (!questionText.trim()) throw new BadRequestError("questionText is required");
  if (!correctAnswer.trim()) throw new BadRequestError("correctAnswer is required");
  if (options.length < 2) throw new BadRequestError("At least 2 options required");

  // Get next order
  const [maxOrder] = await db
    .select({ order: institutionQuizQuestions.order })
    .from(institutionQuizQuestions)
    .where(and(eq(institutionQuizQuestions.quizId, quizId), eq(institutionQuizQuestions.isDeleted, 0)))
    .orderBy(desc(institutionQuizQuestions.order))
    .limit(1);

  const nextOrder = (maxOrder?.order ?? -1) + 1;
  const questionId = uuid();
  const now = nowISO();

  // Insert question
  await db.insert(institutionQuizQuestions).values({
    id: questionId,
    quizId,
    questionText: questionText.trim(),
    questionMediaUrl,
    questionMediaType,
    answerType,
    correctAnswer: correctAnswer.trim(),
    explanation: explanation?.trim() || null,
    points,
    order: nextOrder,
    isDeleted: 0,
    createdAt: now,
    updatedAt: now,
  });

  // Insert options
  const optionValues = options.map((opt, idx) => ({
    id: uuid(),
    questionId,
    text: opt.text?.trim() || null,
    mediaUrl: opt.mediaUrl || null,
    mediaType: opt.mediaType || null,
    order: idx,
    isDeleted: 0,
  }));

  if (optionValues.length > 0) {
    await db.insert(institutionQuizQuestionOptions).values(optionValues);
  }

  // Recalculate total points
  await recalcQuizPoints(db, quizId);

  const [question] = await db
    .select()
    .from(institutionQuizQuestions)
    .where(eq(institutionQuizQuestions.id, questionId))
    .limit(1);

  const savedOptions = await db
    .select()
    .from(institutionQuizQuestionOptions)
    .where(eq(institutionQuizQuestionOptions.questionId, questionId))
    .orderBy(institutionQuizQuestionOptions.order);

  return c.json(
    { success: true, data: { ...question, options: savedOptions } },
    201,
  );
});

// PATCH /:quizId/questions/:questionId — update question
app.patch("/:quizId/questions/:questionId", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);
  const { quizId, questionId } = c.req.param();

  const [quiz] = await db
    .select()
    .from(institutionQuizzes)
    .where(and(eq(institutionQuizzes.id, quizId), eq(institutionQuizzes.isDeleted, 0)))
    .limit(1);

  if (!quiz) throw new BadRequestError("Quiz not found");
  assertInstitutionAccess(user, quiz.institutionId);

  const [existing] = await db
    .select()
    .from(institutionQuizQuestions)
    .where(and(eq(institutionQuizQuestions.id, questionId), eq(institutionQuizQuestions.isDeleted, 0)))
    .limit(1);

  if (!existing) throw new BadRequestError("Question not found");

  const contentType = c.req.header("content-type") || "";
  const updateData: Record<string, any> = { updatedAt: nowISO() };

  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData();
    if (formData.get("questionText")) updateData.questionText = (formData.get("questionText") as string).trim();
    if (formData.get("answerType")) updateData.answerType = formData.get("answerType");
    if (formData.get("correctAnswer")) updateData.correctAnswer = (formData.get("correctAnswer") as string).trim();
    if (formData.get("explanation") !== undefined) updateData.explanation = (formData.get("explanation") as string) || null;
    if (formData.get("points")) updateData.points = parseInt(formData.get("points") as string);

    const qMedia = formData.get("questionMedia");
    if (qMedia && qMedia instanceof File && qMedia.size > 0) {
      const result = await saveFile(c.env.BUCKET, qMedia, `quizzes/${quizId}/questions`);
      if (result.ok) {
        updateData.questionMediaUrl = result.key;
        const ext = qMedia.name.split(".").pop() || "png";
        updateData.questionMediaType = ext.match(/mp4|webm|mov/) ? "video" : "image";
      }
    }

    // Update options if provided
    const optionsRaw = formData.get("options");
    if (optionsRaw && typeof optionsRaw === "string") {
      try {
        const newOptions: { text: string; mediaUrl?: string | null; mediaType?: string | null }[] = JSON.parse(optionsRaw);

        // Soft-delete old options
        await db
          .update(institutionQuizQuestionOptions)
          .set({ isDeleted: 1 })
          .where(eq(institutionQuizQuestionOptions.questionId, questionId));

        // Insert new options
        for (let i = 0; i < newOptions.length; i++) {
          const opt = newOptions[i];
          let mediaUrl = opt.mediaUrl || null;
          let mediaType = opt.mediaType || null;

          const optFile = formData.get(`optionMedia_${i}`);
          if (optFile && optFile instanceof File && optFile.size > 0) {
            const result = await saveFile(c.env.BUCKET, optFile, `quizzes/${quizId}/options`);
            if (result.ok) {
              mediaUrl = result.key;
              const ext = optFile.name.split(".").pop() || "png";
              mediaType = ext.match(/mp4|webm|mov/) ? "video" : "image";
            }
          }

          await db.insert(institutionQuizQuestionOptions).values({
            id: uuid(),
            questionId,
            text: opt.text?.trim() || null,
            mediaUrl,
            mediaType,
            order: i,
            isDeleted: 0,
          });
        }
      } catch {}
    }
  } else {
    const body = await c.req.json();
    if (body.questionText !== undefined) updateData.questionText = body.questionText.trim();
    if (body.answerType !== undefined) updateData.answerType = body.answerType;
    if (body.correctAnswer !== undefined) updateData.correctAnswer = body.correctAnswer.trim();
    if (body.explanation !== undefined) updateData.explanation = body.explanation || null;
    if (body.points !== undefined) updateData.points = body.points;

    // Replace options if provided
    if (body.options && Array.isArray(body.options)) {
      await db
        .update(institutionQuizQuestionOptions)
        .set({ isDeleted: 1 })
        .where(eq(institutionQuizQuestionOptions.questionId, questionId));

      for (let i = 0; i < body.options.length; i++) {
        const opt = body.options[i];
        await db.insert(institutionQuizQuestionOptions).values({
          id: uuid(),
          questionId,
          text: opt.text?.trim() || null,
          mediaUrl: opt.mediaUrl || null,
          mediaType: opt.mediaType || null,
          order: i,
          isDeleted: 0,
        });
      }
    }
  }

  await db
    .update(institutionQuizQuestions)
    .set(updateData)
    .where(eq(institutionQuizQuestions.id, questionId));

  await recalcQuizPoints(db, quizId);

  const [updated] = await db
    .select()
    .from(institutionQuizQuestions)
    .where(eq(institutionQuizQuestions.id, questionId))
    .limit(1);

  const options = await db
    .select()
    .from(institutionQuizQuestionOptions)
    .where(and(eq(institutionQuizQuestionOptions.questionId, questionId), eq(institutionQuizQuestionOptions.isDeleted, 0)))
    .orderBy(institutionQuizQuestionOptions.order);

  return c.json({ success: true, data: { ...updated, options } }, 200);
});

// DELETE /:quizId/questions/:questionId
app.delete("/:quizId/questions/:questionId", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);
  const { quizId, questionId } = c.req.param();

  const [quiz] = await db
    .select()
    .from(institutionQuizzes)
    .where(and(eq(institutionQuizzes.id, quizId), eq(institutionQuizzes.isDeleted, 0)))
    .limit(1);

  if (!quiz) throw new BadRequestError("Quiz not found");
  assertInstitutionAccess(user, quiz.institutionId);

  await db
    .update(institutionQuizQuestions)
    .set({ isDeleted: 1, updatedAt: nowISO() })
    .where(eq(institutionQuizQuestions.id, questionId));

  await recalcQuizPoints(db, quizId);

  return c.json({ success: true, message: "Question deleted" }, 200);
});

// ─── CSV EXPORT ────────────────────────────────────────────────

// GET /:id/export-csv
app.get("/:id/export-csv", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);
  const { id: quizId } = c.req.param();

  const [quiz] = await db
    .select()
    .from(institutionQuizzes)
    .where(and(eq(institutionQuizzes.id, quizId), eq(institutionQuizzes.isDeleted, 0)))
    .limit(1);

  if (!quiz) throw new BadRequestError("Quiz not found");
  assertInstitutionAccess(user, quiz.institutionId);

  const questions = await db
    .select()
    .from(institutionQuizQuestions)
    .where(and(eq(institutionQuizQuestions.quizId, quizId), eq(institutionQuizQuestions.isDeleted, 0)))
    .orderBy(institutionQuizQuestions.order);

  const csvRows: string[] = [];
  csvRows.push("questionText,answerType,correctAnswer,explanation,points,option1,option2,option3,option4,option5,option6");

  for (const q of questions) {
    const options = await db
      .select()
      .from(institutionQuizQuestionOptions)
      .where(and(eq(institutionQuizQuestionOptions.questionId, q.id), eq(institutionQuizQuestionOptions.isDeleted, 0)))
      .orderBy(institutionQuizQuestionOptions.order);

    const optTexts = options.map((o) => o.text || "");
    while (optTexts.length < 6) optTexts.push("");

    const escape = (s: string) => `"${(s || "").replace(/"/g, '""')}"`;
    csvRows.push(
      [
        escape(q.questionText),
        escape(q.answerType || "multiple_choice"),
        escape(q.correctAnswer || ""),
        escape(q.explanation || ""),
        String(q.points ?? 1),
        ...optTexts.map(escape),
      ].join(","),
    );
  }

  const csvContent = csvRows.join("\n");
  return c.json({ success: true, data: csvContent, filename: `${quiz.title || "quiz"}.csv` }, 200);
});

// ─── CSV IMPORT ────────────────────────────────────────────────

// POST /:id/import-csv
app.post("/:id/import-csv", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);
  const { id: quizId } = c.req.param();

  const [quiz] = await db
    .select()
    .from(institutionQuizzes)
    .where(and(eq(institutionQuizzes.id, quizId), eq(institutionQuizzes.isDeleted, 0)))
    .limit(1);

  if (!quiz) throw new BadRequestError("Quiz not found");
  assertInstitutionAccess(user, quiz.institutionId);

  const formData = await c.req.formData();
  const csvFile = formData.get("file");

  if (!csvFile || !(csvFile instanceof File)) {
    throw new BadRequestError("CSV file is required");
  }

  const csvText = await csvFile.text();
  const lines = csvText.split("\n").filter((l) => l.trim());

  if (lines.length < 2) {
    throw new BadRequestError("CSV must have a header row and at least one question");
  }

  // Parse CSV (simple parser — handles quoted fields)
  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          result.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  }

  const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ""));
  const now = nowISO();
  let imported = 0;

  // Get next order number
  const [maxOrder] = await db
    .select({ order: institutionQuizQuestions.order })
    .from(institutionQuizQuestions)
    .where(and(eq(institutionQuizQuestions.quizId, quizId), eq(institutionQuizQuestions.isDeleted, 0)))
    .orderBy(desc(institutionQuizQuestions.order))
    .limit(1);

  let nextOrder = (maxOrder?.order ?? -1) + 1;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    header.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });

    const questionText = row["questiontext"] || row["question"] || "";
    if (!questionText.trim()) continue;

    const answerType = row["answertype"] || row["type"] || "multiple_choice";
    const correctAnswer = row["correctanswer"] || row["answer"] || "";
    const explanation = row["explanation"] || "";
    const points = parseInt(row["points"] || "1") || 1;

    // Collect options from option1..option6
    const options: string[] = [];
    for (let j = 1; j <= 6; j++) {
      const opt = row[`option${j}`] || "";
      if (opt.trim()) options.push(opt.trim());
    }

    if (options.length < 2) continue;

    const questionId = uuid();

    await db.insert(institutionQuizQuestions).values({
      id: questionId,
      quizId,
      questionText: questionText.trim(),
      answerType,
      correctAnswer: correctAnswer.trim(),
      explanation: explanation || null,
      points,
      order: nextOrder++,
      isDeleted: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Insert options
    for (let j = 0; j < options.length; j++) {
      await db.insert(institutionQuizQuestionOptions).values({
        id: uuid(),
        questionId,
        text: options[j],
        order: j,
        isDeleted: 0,
      });
    }

    imported++;
  }

  await recalcQuizPoints(db, quizId);

  return c.json(
    { success: true, message: `Imported ${imported} question(s)`, data: { imported } },
    201,
  );
});

// ─── STUDENT MARKS ────────────────────────────────────────────

// GET /:id/marks — list all student attempts for this quiz
app.get("/:id/marks", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);
  const { id: quizId } = c.req.param();

  const [quiz] = await db
    .select()
    .from(institutionQuizzes)
    .where(and(eq(institutionQuizzes.id, quizId), eq(institutionQuizzes.isDeleted, 0)))
    .limit(1);

  if (!quiz) throw new BadRequestError("Quiz not found");
  assertInstitutionAccess(user, quiz.institutionId);

  // Get all attempts for this quiz
  const attempts = await db
    .select({
      id: institutionQuizAttempts.id,
      studentId: institutionQuizAttempts.studentId,
      score: institutionQuizAttempts.score,
      maxScore: institutionQuizAttempts.maxScore,
      startedAt: institutionQuizAttempts.startedAt,
      completedAt: institutionQuizAttempts.completedAt,
      timeTakenSeconds: institutionQuizAttempts.timeTakenSeconds,
      attemptNumber: institutionQuizAttempts.attemptNumber,
    })
    .from(institutionQuizAttempts)
    .where(
      and(
        eq(institutionQuizAttempts.quizId, quizId),
        eq(institutionQuizAttempts.isDeleted, 0),
      ),
    )
    .orderBy(desc(institutionQuizAttempts.createdAt));

  // Try to resolve student names from students table
  const studentIds = [...new Set(attempts.map((a) => a.studentId))];
  let studentMap: Record<string, { name: string; username: string; rollNumber: string }> = {};

  if (studentIds.length > 0) {
    const studentRows = await db
      .select({
        id: students.id,
        name: students.name,
        username: students.username,
        rollNumber: students.rollNumber,
      })
      .from(students)
      .where(sql`${students.id} IN ${studentIds}`);

    for (const s of studentRows) {
      studentMap[s.id] = {
        name: s.name || "Unknown",
        username: s.username || "",
        rollNumber: s.rollNumber || "",
      };
    }
  }

  // Enrich attempts with student info
  const enriched = attempts.map((a) => ({
    ...a,
    studentName: studentMap[a.studentId]?.name || a.studentId,
    studentUsername: studentMap[a.studentId]?.username || "",
    studentRollNumber: studentMap[a.studentId]?.rollNumber || "",
    percentage: a.maxScore > 0 ? Math.round(((a.score ?? 0) / a.maxScore) * 100) : 0,
  }));

  return c.json(
    {
      success: true,
      data: {
        quiz: {
          id: quiz.id,
          title: quiz.title,
          totalPoints: quiz.totalPoints,
          passingPoints: quiz.passingPoints,
        },
        attempts: enriched,
        totalAttempts: enriched.length,
      },
    },
    200,
  );
});

// ─── IMAGE UPLOAD (standalone) ─────────────────────────────────

// POST /upload-image — upload image for question/option
app.post("/upload-image", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const formData = await c.req.formData();
  const file = formData.get("file");
  const folder = (formData.get("folder") as string) || "quizzes";

  if (!file || !(file instanceof File)) {
    throw new BadRequestError("File is required");
  }

  const result = await saveFile(c.env.BUCKET, file, folder);
  if (!result.ok) {
    throw new BadRequestError("Failed to upload image");
  }

  const ext = file.name.split(".").pop() || "png";
  const mediaType = ext.match(/mp4|webm|mov/) ? "video" : "image";

  return c.json(
    { success: true, data: { url: result.key, mediaType } },
    201,
  );
});

export { app as quizController };
