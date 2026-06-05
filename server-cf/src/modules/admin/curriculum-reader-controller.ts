// Curriculum Reader (All Authenticated Roles) — ported from Elysia curriculum-reader-controller.ts
// Read-only routes for viewing curriculum data. Uses adminAuth middleware.
import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { eq, asc, inArray } from "drizzle-orm";
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

async function enrichContentWithQuizzes(
  db: ReturnType<typeof getDb>,
  rows: any[],
) {
  const quizRows = rows.filter((r) => r.type === "quiz");
  if (quizRows.length === 0) return rows;

  const contentIds = quizRows.map((r) => r.id);

  // Batch fetch all questions for these content items
  const allQuestions = await db
    .select()
    .from(quizQuestions)
    .where(inArray(quizQuestions.contentId, contentIds))
    .orderBy(asc(quizQuestions.order));

  const questionIds = allQuestions.map((q) => q.id);

  // Batch fetch options and match pairs for all questions
  const [allOptions, allMatchPairs] = await Promise.all([
    questionIds.length > 0
      ? db
          .select()
          .from(quizQuestionOptions)
          .where(inArray(quizQuestionOptions.questionId, questionIds))
          .orderBy(asc(quizQuestionOptions.order))
      : Promise.resolve([]),
    questionIds.length > 0
      ? db
          .select()
          .from(quizMatchPairs)
          .where(inArray(quizMatchPairs.questionId, questionIds))
          .orderBy(asc(quizMatchPairs.order))
      : Promise.resolve([]),
  ]);

  // Group options and match pairs by questionId
  const optionsMap = new Map<string, typeof allOptions[0][]>();
  for (const o of allOptions) {
    const arr = optionsMap.get(o.questionId) || [];
    arr.push(o);
    optionsMap.set(o.questionId, arr);
  }

  const matchPairsMap = new Map<string, typeof allMatchPairs[0][]>();
  for (const m of allMatchPairs) {
    const arr = matchPairsMap.get(m.questionId) || [];
    arr.push(m);
    matchPairsMap.set(m.questionId, arr);
  }

  // Group questions by contentId
  const questionsMap = new Map<string, any[]>();
  for (const q of allQuestions) {
    const arr = questionsMap.get(q.contentId) || [];
    arr.push({
      ...q,
      options: (optionsMap.get(q.id) || []).map((o) => ({ label: o.label, value: o.value })),
      matchPairs: (matchPairsMap.get(q.id) || []).map((m) => ({
        leftItem: m.leftItem,
        rightItem: m.rightItem,
      })),
    });
    questionsMap.set(q.contentId, arr);
  }

  return rows.map((row) => {
    if (row.type === "quiz") {
      return { ...row, questions: questionsMap.get(row.id) || [] };
    }
    return row;
  });
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

  const chapterIds = chapterRows.map((c) => c.id);

  // Batch fetch all content for all chapters
  const allContentRows = chapterIds.length > 0
    ? await db
        .select()
        .from(chapterContents)
        .where(inArray(chapterContents.chapterId, chapterIds))
        .orderBy(asc(chapterContents.order))
    : [];

  const enrichedContent = await enrichContentWithQuizzes(db, allContentRows);

  // Group content by chapterId
  const contentByChapter = new Map<string, any[]>();
  for (const content of enrichedContent) {
    const arr = contentByChapter.get(content.chapterId) || [];
    arr.push(content);
    contentByChapter.set(content.chapterId, arr);
  }

  const chaptersWithContent = chapterRows.map((chapter) => ({
    ...chapter,
    content: contentByChapter.get(chapter.id) || [],
  }));

  return c.json({ success: true, data: chaptersWithContent }, 200);
});

export const curriculumReaderController = app;
