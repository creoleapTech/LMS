// Curriculum Reader (All Authenticated Roles) — ported from Elysia curriculum-reader-controller.ts
// Read-only routes for viewing curriculum data. Uses adminAuth middleware.
import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { eq, asc } from "drizzle-orm";
import { adminAuth } from "../../middleware/admin-auth";
import { chapters, chapterContents } from "../../schema/books";
import {
  quizQuestions,
  quizQuestionOptions,
  quizMatchPairs,
} from "../../schema/junction";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", adminAuth);

// ── quiz helper ────────────────────────────────────────────────────────────

async function loadQuizQuestions(db: ReturnType<typeof getDb>, contentId: string) {
  const questions = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.contentId, contentId))
    .orderBy(asc(quizQuestions.order));

  const result = [];
  for (const q of questions) {
    const [options, matchPairsRows] = await Promise.all([
      db
        .select()
        .from(quizQuestionOptions)
        .where(eq(quizQuestionOptions.questionId, q.id))
        .orderBy(asc(quizQuestionOptions.order)),
      db
        .select()
        .from(quizMatchPairs)
        .where(eq(quizMatchPairs.questionId, q.id))
        .orderBy(asc(quizMatchPairs.order)),
    ]);
    result.push({
      ...q,
      options: options.map((o) => ({ label: o.label, value: o.value })),
      matchPairs: matchPairsRows.map((m) => ({
        leftItem: m.leftItem,
        rightItem: m.rightItem,
      })),
    });
  }
  return result;
}

/** Attach quiz questions to content rows that are quizzes. */
async function enrichContentWithQuizzes(
  db: ReturnType<typeof getDb>,
  rows: any[],
) {
  return Promise.all(
    rows.map(async (row) => {
      if (row.type === "quiz") {
        const questions = await loadQuizQuestions(db, row.id);
        return { ...row, questions };
      }
      return row;
    }),
  );
}

// GET chapters for a grade book (any authenticated role)
app.get("/chapters/:gradeBookId", async (c) => {
  const db = getDb(c.env.DB);
  const gradeBookId = c.req.param("gradeBookId");

  const rows = await db
    .select()
    .from(chapters)
    .where(eq(chapters.gradeBookId, gradeBookId))
    .orderBy(asc(chapters.order));

  return c.json({ success: true, data: rows }, 200);
});

// GET content for a chapter (any authenticated role)
// Reconstructs quiz questions from junction tables
app.get("/content/:chapterId", async (c) => {
  const db = getDb(c.env.DB);
  const chapterId = c.req.param("chapterId");

  const rows = await db
    .select()
    .from(chapterContents)
    .where(eq(chapterContents.chapterId, chapterId))
    .orderBy(asc(chapterContents.order));

  const data = await enrichContentWithQuizzes(db, rows);

  return c.json({ success: true, data }, 200);
});

// GET full gradebook data: chapters with nested content (for Coursera-like sidebar)
app.get("/gradebook/:gradeBookId/full", async (c) => {
  const db = getDb(c.env.DB);
  const gradeBookId = c.req.param("gradeBookId");

  const chapterRows = await db
    .select()
    .from(chapters)
    .where(eq(chapters.gradeBookId, gradeBookId))
    .orderBy(asc(chapters.order));

  const chaptersWithContent = await Promise.all(
    chapterRows.map(async (chapter) => {
      const contentRows = await db
        .select()
        .from(chapterContents)
        .where(eq(chapterContents.chapterId, chapter.id))
        .orderBy(asc(chapterContents.order));

      const content = await enrichContentWithQuizzes(db, contentRows);

      return { ...chapter, content };
    }),
  );

  return c.json({ success: true, data: chaptersWithContent }, 200);
});

export const curriculumReaderController = app;
