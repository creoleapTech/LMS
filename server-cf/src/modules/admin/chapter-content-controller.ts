// Chapter Content CRUD — ported from Elysia chapterContent-controller.ts
// Uses adminAuth middleware (original checked headers.decoded manually)
import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { v4 as uuid } from "uuid";
import { nowISO } from "../../lib/utils";
import { eq, and, asc } from "drizzle-orm";
import { adminAuth } from "../../middleware/admin-auth";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";
import { chapters, chapterContents } from "../../schema/books";
import {
  quizQuestions,
  quizQuestionOptions,
  quizMatchPairs,
} from "../../schema/junction";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", adminAuth);

// ── quiz helpers (same logic as curriculum-controller) ──────────────────────

async function saveQuizQuestions(
  db: ReturnType<typeof getDb>,
  contentId: string,
  questions: any[],
) {
  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi];
    const questionId = uuid();
    await db.insert(quizQuestions).values({
      id: questionId,
      contentId,
      questionText: q.questionText || q.question || null,
      questionMedia: q.questionMedia || null,
      answerType: q.answerType || q.type || null,
      correctAnswer: q.correctAnswer || null,
      explanation: q.explanation || null,
      points: q.points ?? 1,
      order: qi + 1,
    });

    if (Array.isArray(q.options)) {
      for (let oi = 0; oi < q.options.length; oi++) {
        const opt = q.options[oi];
        await db.insert(quizQuestionOptions).values({
          id: uuid(),
          questionId,
          label: typeof opt === "string" ? opt : opt.label || null,
          value: typeof opt === "string" ? opt : opt.value || null,
          order: oi + 1,
        });
      }
    }

    if (Array.isArray(q.matchPairs)) {
      for (let mi = 0; mi < q.matchPairs.length; mi++) {
        const mp = q.matchPairs[mi];
        await db.insert(quizMatchPairs).values({
          id: uuid(),
          questionId,
          leftItem: mp.leftItem || mp.left || null,
          rightItem: mp.rightItem || mp.right || null,
          order: mi + 1,
        });
      }
    }
  }
}

async function deleteQuizQuestions(db: ReturnType<typeof getDb>, contentId: string) {
  const questions = await db
    .select({ id: quizQuestions.id })
    .from(quizQuestions)
    .where(eq(quizQuestions.contentId, contentId));

  for (const q of questions) {
    await db.delete(quizQuestionOptions).where(eq(quizQuestionOptions.questionId, q.id));
    await db.delete(quizMatchPairs).where(eq(quizMatchPairs.questionId, q.id));
  }
  await db.delete(quizQuestions).where(eq(quizQuestions.contentId, contentId));
}

// CREATE Content
app.post(
  "/:curriculumId/grades/:grade/chapters/:chapterId/content",
  async (c) => {
    const user = c.get("user") as any;
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

    const db = getDb(c.env.DB);
    const chapterId = c.req.param("chapterId");

    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, chapterId));
    if (!chapter) throw new BadRequestError("Chapter not found");

    const body = await c.req.json();

    const id = uuid();
    const now = nowISO();

    const contentData: Record<string, any> = {
      id,
      chapterId,
      type: body.type,
      title: body.title,
      videoUrl: body.videoUrl || null,
      fileUrl: body.fileUrl || null,
      durationMinutes: body.durationMinutes || null,
      projectInstructions: body.projectInstructions || null,
      isFree: body.isFree ? 1 : 0,
      order: body.order,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(chapterContents).values(contentData as any);

    // Save quiz questions if type is quiz
    if (body.type === "quiz" && Array.isArray(body.questions)) {
      await saveQuizQuestions(db, id, body.questions);
    }

    const [created] = await db.select().from(chapterContents).where(eq(chapterContents.id, id));

    return c.json({ success: true, data: created }, 201);
  },
);

// LIST Content for a chapter
app.get(
  "/:curriculumId/grades/:grade/chapters/:chapterId/content",
  async (c) => {
    const user = c.get("user") as any;
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

    const db = getDb(c.env.DB);
    const chapterId = c.req.param("chapterId");

    const rows = await db
      .select()
      .from(chapterContents)
      .where(eq(chapterContents.chapterId, chapterId))
      .orderBy(asc(chapterContents.order));

    return c.json({ success: true, data: rows }, 200);
  },
);

// UPDATE Content
app.patch(
  "/:curriculumId/grades/:grade/chapters/:chapterId/content/:contentId",
  async (c) => {
    const user = c.get("user") as any;
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

    const db = getDb(c.env.DB);
    const contentId = c.req.param("contentId");
    const body = await c.req.json();

    const updateData: Record<string, any> = {};
    if (body.type !== undefined) updateData.type = body.type;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.videoUrl !== undefined) updateData.videoUrl = body.videoUrl;
    if (body.fileUrl !== undefined) updateData.fileUrl = body.fileUrl;
    if (body.durationMinutes !== undefined) updateData.durationMinutes = body.durationMinutes;
    if (body.projectInstructions !== undefined) updateData.projectInstructions = body.projectInstructions;
    if (body.isFree !== undefined) updateData.isFree = body.isFree ? 1 : 0;
    if (body.order !== undefined) updateData.order = body.order;
    updateData.updatedAt = nowISO();

    await db.update(chapterContents).set(updateData).where(eq(chapterContents.id, contentId));

    // Replace quiz questions if provided
    if (Array.isArray(body.questions)) {
      await deleteQuizQuestions(db, contentId);
      await saveQuizQuestions(db, contentId, body.questions);
    }

    const [updated] = await db
      .select()
      .from(chapterContents)
      .where(eq(chapterContents.id, contentId));
    if (!updated) throw new BadRequestError("Content not found");

    return c.json({ success: true, data: updated }, 200);
  },
);

// REORDER Content
app.post(
  "/:curriculumId/grades/:grade/chapters/:chapterId/content/reorder",
  async (c) => {
    const user = c.get("user") as any;
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

    const db = getDb(c.env.DB);
    const chapterId = c.req.param("chapterId");
    const body = await c.req.json();

    if (Array.isArray(body) && body.length > 0) {
      // Two-pass to avoid unique index conflicts on {chapterId, order}
      for (let i = 0; i < body.length; i++) {
        await db
          .update(chapterContents)
          .set({ order: -(i + 1) })
          .where(
            and(
              eq(chapterContents.id, body[i].contentId),
              eq(chapterContents.chapterId, chapterId),
            ),
          );
      }
      for (const item of body) {
        await db
          .update(chapterContents)
          .set({ order: item.order })
          .where(
            and(
              eq(chapterContents.id, item.contentId),
              eq(chapterContents.chapterId, chapterId),
            ),
          );
      }
    }

    return c.json({ success: true, message: "Content reordered" }, 200);
  },
);

// DELETE Content
app.delete(
  "/:curriculumId/grades/:grade/chapters/:chapterId/content/:contentId",
  async (c) => {
    const user = c.get("user") as any;
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

    const db = getDb(c.env.DB);
    const contentId = c.req.param("contentId");

    const [existing] = await db
      .select()
      .from(chapterContents)
      .where(eq(chapterContents.id, contentId));
    if (!existing) throw new BadRequestError("Content not found");

    // Delete quiz data first
    await deleteQuizQuestions(db, contentId);

    await db.delete(chapterContents).where(eq(chapterContents.id, contentId));

    return c.json({ success: true, message: "Content deleted" }, 200);
  },
);

export const chapterContentController = app;
