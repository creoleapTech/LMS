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
import { saveFile, deleteFile } from "../../lib/file";
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

    const formData = await c.req.formData();

    const type = formData.get("type") as string;
    const title = formData.get("title") as string;
    const durationMinutes = formData.get("durationMinutes") as string | null;
    const projectInstructions = formData.get("projectInstructions") as string | null;
    const isFree = formData.get("isFree") === "true";
    const order = parseInt(formData.get("order") as string, 10) || 0;
    const questionsRaw = formData.get("questions") as string | null;
    const file = formData.get("file") as File | null;

    // Determine storage folder based on content type
    let videoUrl: string | null = null;
    let fileUrl: string | null = null;

    if (file && typeof file !== "string") {
      const folder = type === "video" ? "content/videos" : "content/docs";
      const result = await saveFile(c.env.BUCKET, file as unknown as File, folder);
      if (result.ok) {
        if (type === "video") {
          videoUrl = result.key;
        } else {
          fileUrl = result.key;
        }
      }
    } else {
      // Allow passing URLs directly for youtube type etc.
      videoUrl = (formData.get("videoUrl") as string) || null;
      fileUrl = (formData.get("fileUrl") as string) || null;
    }

    const id = uuid();
    const now = nowISO();

    const contentData: Record<string, any> = {
      id,
      chapterId,
      type,
      title,
      videoUrl,
      fileUrl,
      durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
      projectInstructions: projectInstructions || null,
      isFree: isFree ? 1 : 0,
      order,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(chapterContents).values(contentData as any);

    // Save quiz questions if type is quiz
    if (type === "quiz" && questionsRaw) {
      try {
        const questions = JSON.parse(questionsRaw);
        if (Array.isArray(questions)) {
          await saveQuizQuestions(db, id, questions);
        }
      } catch {}
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

    const [existing] = await db
      .select()
      .from(chapterContents)
      .where(eq(chapterContents.id, contentId));
    if (!existing) throw new BadRequestError("Content not found");

    const formData = await c.req.formData();

    const updateData: Record<string, any> = { updatedAt: nowISO() };

    const type = formData.get("type") as string | null;
    const title = formData.get("title") as string | null;
    const durationMinutes = formData.get("durationMinutes") as string | null;
    const projectInstructions = formData.get("projectInstructions") as string | null;
    const isFree = formData.get("isFree") as string | null;
    const order = formData.get("order") as string | null;
    const questionsRaw = formData.get("questions") as string | null;
    const file = formData.get("file") as File | null;

    if (type !== null) updateData.type = type;
    if (title !== null) updateData.title = title;
    if (durationMinutes !== null) updateData.durationMinutes = parseInt(durationMinutes, 10);
    if (projectInstructions !== null) updateData.projectInstructions = projectInstructions;
    if (isFree !== null) updateData.isFree = isFree === "true" ? 1 : 0;
    if (order !== null) updateData.order = parseInt(order, 10);

    // Handle file upload
    if (file && typeof file !== "string") {
      const contentType = type || existing.type;
      const folder = contentType === "video" ? "content/videos" : "content/docs";

      // Delete old file from R2
      if (contentType === "video" && existing.videoUrl) {
        await deleteFile(c.env.BUCKET, existing.videoUrl);
      } else if (contentType !== "video" && existing.fileUrl) {
        await deleteFile(c.env.BUCKET, existing.fileUrl);
      }

      const result = await saveFile(c.env.BUCKET, file as unknown as File, folder);
      if (result.ok) {
        if (contentType === "video") {
          updateData.videoUrl = result.key;
        } else {
          updateData.fileUrl = result.key;
        }
      }
    } else {
      // Allow passing URLs directly
      const videoUrl = formData.get("videoUrl") as string | null;
      const fileUrl = formData.get("fileUrl") as string | null;
      if (videoUrl !== null) updateData.videoUrl = videoUrl;
      if (fileUrl !== null) updateData.fileUrl = fileUrl;
    }

    await db.update(chapterContents).set(updateData).where(eq(chapterContents.id, contentId));

    // Replace quiz questions if provided
    if (questionsRaw) {
      try {
        const questions = JSON.parse(questionsRaw);
        if (Array.isArray(questions)) {
          await deleteQuizQuestions(db, contentId);
          await saveQuizQuestions(db, contentId, questions);
        }
      } catch {}
    }

    const [updated] = await db
      .select()
      .from(chapterContents)
      .where(eq(chapterContents.id, contentId));

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

    // Delete files from R2
    if (existing.videoUrl) {
      await deleteFile(c.env.BUCKET, existing.videoUrl);
    }
    if (existing.fileUrl) {
      await deleteFile(c.env.BUCKET, existing.fileUrl);
    }

    // Delete quiz data first
    await deleteQuizQuestions(db, contentId);

    await db.delete(chapterContents).where(eq(chapterContents.id, contentId));

    return c.json({ success: true, message: "Content deleted" }, 200);
  },
);

export const chapterContentController = app;
