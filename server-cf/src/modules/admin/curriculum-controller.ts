// Curriculum System (Super Admin Only) — ported from Elysia curriculam-controller.ts
import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { v4 as uuid } from "uuid";
import { nowISO, slugify } from "../../lib/utils";
import { eq, and, like, sql, count, asc, desc } from "drizzle-orm";
import { superAdminAuth } from "../../middleware/super-admin-auth";
import { saveFile, deleteFile } from "../../lib/file";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";
import {
  curricula,
  gradeBooks,
  chapters,
  chapterContents,
} from "../../schema/books";
import {
  curriculumTags,
  curriculumLevels,
  curriculumGrades,
  quizQuestions,
  quizQuestionOptions,
  quizMatchPairs,
  institutionCurriculumAccess,
  institutionAccessibleGradebooks,
} from "../../schema/junction";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// All routes require super_admin auth
app.use("*", superAdminAuth);

// ── helpers ────────────────────────────────────────────────────────────────

function parseBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true";
  return false;
}

function isJsonRequest(contentType: string | undefined): boolean {
  return (contentType ?? "").toLowerCase().includes("application/json");
}

function parseIntSafe(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseInt(v, 10) || 0;
  return 0;
}

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.length > 0) return [v];
  return [];
}

function toIntArray(v: unknown): number[] {
  if (Array.isArray(v)) return v.map((g) => (typeof g === "string" ? parseInt(g, 10) : Number(g)));
  if (typeof v === "string" && v.length > 0) return [parseInt(v, 10)];
  return [];
}

/** Save junction rows for tags, levels, grades for a curriculum. */
async function saveCurriculumJunctions(
  db: ReturnType<typeof getDb>,
  curriculumId: string,
  tags: string[],
  levels: string[],
  grades: number[],
) {
  for (const tag of tags) {
    await db.insert(curriculumTags).values({ id: uuid(), curriculumId, tag });
  }
  for (const level of levels) {
    await db.insert(curriculumLevels).values({ id: uuid(), curriculumId, level });
  }
  for (const grade of grades) {
    await db.insert(curriculumGrades).values({ id: uuid(), curriculumId, grade });
  }
}

/** Delete all junction rows for a curriculum then re-insert. */
async function replaceCurriculumJunctions(
  db: ReturnType<typeof getDb>,
  curriculumId: string,
  tags?: string[],
  levels?: string[],
  grades?: number[],
) {
  if (tags !== undefined) {
    await db.delete(curriculumTags).where(eq(curriculumTags.curriculumId, curriculumId));
    for (const tag of tags) {
      await db.insert(curriculumTags).values({ id: uuid(), curriculumId, tag });
    }
  }
  if (levels !== undefined) {
    await db.delete(curriculumLevels).where(eq(curriculumLevels.curriculumId, curriculumId));
    for (const level of levels) {
      await db.insert(curriculumLevels).values({ id: uuid(), curriculumId, level });
    }
  }
  if (grades !== undefined) {
    await db.delete(curriculumGrades).where(eq(curriculumGrades.curriculumId, curriculumId));
    for (const grade of grades) {
      await db.insert(curriculumGrades).values({ id: uuid(), curriculumId, grade });
    }
  }
}

/** Fetch junction rows and attach to a curriculum row. */
async function attachJunctions(db: ReturnType<typeof getDb>, curriculum: any) {
  const [tags, levels, grades] = await Promise.all([
    db.select().from(curriculumTags).where(eq(curriculumTags.curriculumId, curriculum.id)),
    db.select().from(curriculumLevels).where(eq(curriculumLevels.curriculumId, curriculum.id)),
    db.select().from(curriculumGrades).where(eq(curriculumGrades.curriculumId, curriculum.id)),
  ]);
  return {
    ...curriculum,
    tags: tags.map((t) => t.tag),
    level: levels.map((l) => l.level),
    grades: grades.map((g) => g.grade),
  };
}

/** Save quiz questions (with options and match pairs) for a chapterContent. */
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

    // Insert options
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

    // Insert match pairs
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

/** Load quiz questions with options and match pairs for a content id. */
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
      matchPairs: matchPairsRows.map((m) => ({ leftItem: m.leftItem, rightItem: m.rightItem })),
    });
  }
  return result;
}

/** Delete all quiz data for a content id. */
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

// ===================== CURRICULUM (Branches) =====================

// CREATE curriculum
app.post("/", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Only super_admin can create curriculums");

  const formData = await c.req.formData();
  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || null;
  const isPublished = parseBool(formData.get("isPublished"));
  const tags = toArray(formData.getAll("tags"));
  const levels = toArray(formData.getAll("level"));
  const grades = toIntArray(formData.getAll("grades"));
  const thumbnailFile = formData.get("thumbnail") as File | null;
  const bannerFile = formData.get("banner") as File | null;

  if (!name || name.length < 3) throw new BadRequestError("Name is required (min 3 chars)");

  const db = getDb(c.env.DB);

  // Check existing
  const [existing] = await db.select().from(curricula).where(eq(curricula.name, name)).limit(1);
  if (existing) throw new BadRequestError("Curriculum with this name already exists");

  // Handle file uploads
  let thumbnailKey = "";
  let bannerKey = "";

  if (thumbnailFile) {
    const result = await saveFile(c.env.BUCKET, thumbnailFile, "curriculum/thumbnails");
    if (result.ok) thumbnailKey = result.key;
  }
  if (bannerFile) {
    const result = await saveFile(c.env.BUCKET, bannerFile, "curriculum/banners");
    if (result.ok) bannerKey = result.key;
  }

  const id = uuid();
  const now = nowISO();

  await db.insert(curricula).values({
    id,
    name,
    slug: slugify(name),
    description,
    thumbnail: thumbnailKey || null,
    banner: bannerKey || null,
    isPublished: isPublished ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  });

  // Save junction rows
  await saveCurriculumJunctions(db, id, tags, levels, grades);

  const [created] = await db.select().from(curricula).where(eq(curricula.id, id));
  const data = await attachJunctions(db, created);

  return c.json({ success: true, data }, 201);
});

// LIST curricula (paginated)
app.get("/", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "10", 10);
  const published = c.req.query("published");
  const search = c.req.query("search");
  const skip = (page - 1) * limit;

  const db = getDb(c.env.DB);

  const conditions: any[] = [];
  if (published !== undefined && published !== null) {
    conditions.push(eq(curricula.isPublished, published === "true" ? 1 : 0));
  }
  if (search) {
    conditions.push(like(curricula.name, `%${search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(curricula)
    .where(whereClause)
    .orderBy(asc(curricula.order), desc(curricula.createdAt))
    .limit(limit)
    .offset(skip);

  const [totalRow] = await db
    .select({ count: count() })
    .from(curricula)
    .where(whereClause);

  const total = totalRow?.count ?? 0;

  // Attach junctions to each curriculum
  const data = await Promise.all(rows.map((r) => attachJunctions(db, r)));

  return c.json({ success: true, data, meta: { total, page, limit } }, 200);
});

// GET single curriculum
app.get("/curr/:id", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const [curriculum] = await db.select().from(curricula).where(eq(curricula.id, c.req.param("id")));
  if (!curriculum) throw new BadRequestError("Curriculum not found");

  const data = await attachJunctions(db, curriculum);
  return c.json({ success: true, data }, 200);
});

// UPDATE curriculum
app.patch("/:id", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const [existing] = await db.select().from(curricula).where(eq(curricula.id, id));
  if (!existing) throw new BadRequestError("Curriculum not found");

  const formData = await c.req.formData();
  const updateData: Record<string, any> = {};

  const name = formData.get("name") as string | null;
  if (name) {
    updateData.name = name;
    updateData.slug = slugify(name);
  }

  const description = formData.get("description") as string | null;
  if (description !== null) updateData.description = description;

  const isPublished = formData.get("isPublished");
  if (isPublished !== null) updateData.isPublished = parseBool(isPublished) ? 1 : 0;

  const orderVal = formData.get("order");
  if (orderVal !== null) updateData.order = parseIntSafe(orderVal);

  // Handle file uploads
  const thumbnailFile = formData.get("thumbnail") as File | null;
  const bannerFile = formData.get("banner") as File | null;

  if (thumbnailFile) {
    if (existing.thumbnail) {
      await deleteFile(c.env.BUCKET, existing.thumbnail);
    }
    const result = await saveFile(c.env.BUCKET, thumbnailFile, "curriculum/thumbnails");
    if (result.ok) updateData.thumbnail = result.key;
  }

  if (bannerFile) {
    if (existing.banner) {
      await deleteFile(c.env.BUCKET, existing.banner);
    }
    const result = await saveFile(c.env.BUCKET, bannerFile, "curriculum/banners");
    if (result.ok) updateData.banner = result.key;
  }

  updateData.updatedAt = nowISO();

  await db.update(curricula).set(updateData).where(eq(curricula.id, id));

  // Handle junction updates
  const tagsRaw = formData.getAll("tags");
  const levelsRaw = formData.getAll("level");
  const gradesRaw = formData.getAll("grades");

  await replaceCurriculumJunctions(
    db,
    id,
    tagsRaw.length > 0 ? toArray(tagsRaw) : undefined,
    levelsRaw.length > 0 ? toArray(levelsRaw) : undefined,
    gradesRaw.length > 0 ? toIntArray(gradesRaw) : undefined,
  );

  const [updated] = await db.select().from(curricula).where(eq(curricula.id, id));
  const data = await attachJunctions(db, updated);

  return c.json({ success: true, data }, 200);
});

// DELETE curriculum
app.delete("/:id", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const [curriculum] = await db.select().from(curricula).where(eq(curricula.id, id));
  if (!curriculum) throw new BadRequestError("Curriculum not found");

  // Delete associated files
  if (curriculum.thumbnail) {
    await deleteFile(c.env.BUCKET, curriculum.thumbnail);
  }
  if (curriculum.banner) {
    await deleteFile(c.env.BUCKET, curriculum.banner);
  }

  // Delete junction rows (cascade should handle, but be explicit)
  await db.delete(curriculumTags).where(eq(curriculumTags.curriculumId, id));
  await db.delete(curriculumLevels).where(eq(curriculumLevels.curriculumId, id));
  await db.delete(curriculumGrades).where(eq(curriculumGrades.curriculumId, id));

  await db.delete(curricula).where(eq(curricula.id, id));

  return c.json({ success: true, message: "Curriculum deleted" }, 200);
});

// ===================== GRADE BOOKS =====================

// CREATE gradeBook under curriculum
app.post("/:curriculumId/grades", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const curriculumId = c.req.param("curriculumId");

  const [curriculum] = await db.select().from(curricula).where(eq(curricula.id, curriculumId));
  if (!curriculum) throw new BadRequestError("Curriculum not found");

  const formData = await c.req.formData();
  const grade = parseIntSafe(formData.get("grade"));
  const bookTitle = formData.get("bookTitle") as string;
  const subtitle = (formData.get("subtitle") as string) || null;
  const description = (formData.get("description") as string) || null;
  const isPublished = parseBool(formData.get("isPublished"));
  const coverImageFile = formData.get("coverImage") as File | null;

  // Check existing
  const [existingGrade] = await db
    .select()
    .from(gradeBooks)
    .where(and(eq(gradeBooks.curriculumId, curriculumId), eq(gradeBooks.grade, grade)))
    .limit(1);
  if (existingGrade) throw new BadRequestError("Grade book already exists for this grade");

  let coverImageKey = "";
  if (coverImageFile) {
    const result = await saveFile(c.env.BUCKET, coverImageFile, "gradebook/covers");
    if (result.ok) coverImageKey = result.key;
  }

  const id = uuid();
  const now = nowISO();

  await db.insert(gradeBooks).values({
    id,
    curriculumId,
    grade,
    bookTitle,
    subtitle,
    coverImage: coverImageKey || null,
    description,
    isPublished: isPublished ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db.select().from(gradeBooks).where(eq(gradeBooks.id, id));

  return c.json({ success: true, data: created }, 201);
});

// LIST gradeBooks for a curriculum
app.get("/:curriculumId/grades", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const curriculumId = c.req.param("curriculumId");

  const rows = await db
    .select()
    .from(gradeBooks)
    .where(eq(gradeBooks.curriculumId, curriculumId))
    .orderBy(asc(gradeBooks.grade));

  return c.json({ success: true, data: rows }, 200);
});

// UPDATE gradeBook
app.patch("/gradebook/:id", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const [existing] = await db.select().from(gradeBooks).where(eq(gradeBooks.id, id));
  if (!existing) throw new BadRequestError("Grade book not found");

  const formData = await c.req.formData();
  const updateData: Record<string, any> = {};

  const bookTitle = formData.get("bookTitle") as string | null;
  if (bookTitle !== null) updateData.bookTitle = bookTitle;

  const subtitle = formData.get("subtitle") as string | null;
  if (subtitle !== null) updateData.subtitle = subtitle;

  const description = formData.get("description") as string | null;
  if (description !== null) updateData.description = description;

  const isPublished = formData.get("isPublished");
  if (isPublished !== null) updateData.isPublished = parseBool(isPublished) ? 1 : 0;

  const coverImageFile = formData.get("coverImage") as File | null;
  if (coverImageFile) {
    if (existing.coverImage) {
      await deleteFile(c.env.BUCKET, existing.coverImage);
    }
    const result = await saveFile(c.env.BUCKET, coverImageFile, "gradebook/covers");
    if (result.ok) updateData.coverImage = result.key;
  }

  updateData.updatedAt = nowISO();

  await db.update(gradeBooks).set(updateData).where(eq(gradeBooks.id, id));

  const [updated] = await db.select().from(gradeBooks).where(eq(gradeBooks.id, id));

  return c.json({ success: true, data: updated }, 200);
});

// DELETE gradeBook — cascades chapters, content, files, and institution access
app.delete("/gradebook/:id", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const [gradeBook] = await db.select().from(gradeBooks).where(eq(gradeBooks.id, id));
  if (!gradeBook) throw new BadRequestError("Grade book not found");

  // 1. Delete all chapter content files + quiz data, then content rows
  const chapterRows = await db.select({ id: chapters.id }).from(chapters).where(eq(chapters.gradeBookId, id));
  for (const chapter of chapterRows) {
    const contentRows = await db.select().from(chapterContents).where(eq(chapterContents.chapterId, chapter.id));
    for (const content of contentRows) {
      if (content.fileUrl) await deleteFile(c.env.BUCKET, content.fileUrl);
      if (content.videoUrl) await deleteFile(c.env.BUCKET, content.videoUrl);
      await deleteQuizQuestions(db, content.id);
    }
    await db.delete(chapterContents).where(eq(chapterContents.chapterId, chapter.id));
    // Delete chapter thumbnail
    const [ch] = await db.select({ thumbnail: chapters.thumbnail }).from(chapters).where(eq(chapters.id, chapter.id));
    if (ch?.thumbnail) await deleteFile(c.env.BUCKET, ch.thumbnail);
  }
  await db.delete(chapters).where(eq(chapters.gradeBookId, id));

  // 2. Remove institution access rows (institution_accessible_gradebooks has cascade,
  //    but institution_curriculum_access rows referencing only this book need cleanup)
  await db.delete(institutionAccessibleGradebooks).where(eq(institutionAccessibleGradebooks.gradeBookId, id));

  // 3. Delete cover image from R2
  if (gradeBook.coverImage) {
    await deleteFile(c.env.BUCKET, gradeBook.coverImage);
  }

  // 4. Delete the grade book
  await db.delete(gradeBooks).where(eq(gradeBooks.id, id));

  return c.json({ success: true, message: "Grade book deleted" }, 200);
});

// ===================== CHAPTERS =====================

// LIST chapters for a gradeBook
app.get("/gradebook/:gradeBookId/chapters", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const gradeBookId = c.req.param("gradeBookId");

  const rows = await db
    .select()
    .from(chapters)
    .where(eq(chapters.gradeBookId, gradeBookId))
    .orderBy(asc(chapters.order));

  return c.json({ success: true, data: rows }, 200);
});

// CREATE chapter under gradeBook
app.post("/gradebook/:gradeBookId/chapters", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const gradeBookId = c.req.param("gradeBookId");

  const [gradeBook] = await db.select().from(gradeBooks).where(eq(gradeBooks.id, gradeBookId));
  if (!gradeBook) throw new BadRequestError("Grade book not found");

  const contentType = c.req.header("content-type") || "";
  let body: Record<string, any>;
  let thumbnailFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData();
    body = {
      title: formData.get("title"),
      chapterNumber: Number(formData.get("chapterNumber")),
      description: formData.get("description"),
      learningObjectives: formData.get("learningObjectives"),
    };
    thumbnailFile = formData.get("thumbnail") as File | null;
  } else {
    body = await c.req.json();
  }

  const [countRow] = await db
    .select({ count: count() })
    .from(chapters)
    .where(eq(chapters.gradeBookId, gradeBookId));

  const existingCount = countRow?.count ?? 0;

  let thumbnailKey: string | null = null;
  if (thumbnailFile) {
    const result = await saveFile(c.env.BUCKET, thumbnailFile, "chapters/thumbnails");
    if (result.ok) thumbnailKey = result.key;
  }

  const id = uuid();
  const now = nowISO();

  await db.insert(chapters).values({
    id,
    gradeBookId,
    title: body.title,
    chapterNumber: body.chapterNumber,
    description: body.description || null,
    learningObjectives: body.learningObjectives || null,
    thumbnail: thumbnailKey,
    order: existingCount + 1,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db.select().from(chapters).where(eq(chapters.id, id));

  return c.json({ success: true, data: created }, 201);
});

// REORDER chapters
app.post("/gradebook/:gradeBookId/chapters/reorder", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const gradeBookId = c.req.param("gradeBookId");
  const { order } = await c.req.json();

  if (Array.isArray(order) && order.length > 0) {
    // Two-pass to avoid unique index conflicts on {gradeBookId, order}
    for (let i = 0; i < order.length; i++) {
      await db
        .update(chapters)
        .set({ order: -(i + 1) })
        .where(and(eq(chapters.id, order[i].chapterId), eq(chapters.gradeBookId, gradeBookId)));
    }
    for (const item of order) {
      await db
        .update(chapters)
        .set({ order: item.order })
        .where(and(eq(chapters.id, item.chapterId), eq(chapters.gradeBookId, gradeBookId)));
    }
  }

  return c.json({ success: true, message: "Chapters reordered" }, 200);
});

// UPDATE chapter
app.patch("/chapters/:id", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const contentType = c.req.header("content-type") || "";
  let body: Record<string, any>;
  let thumbnailFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData();
    body = {
      title: formData.get("title"),
      chapterNumber: formData.get("chapterNumber") ? Number(formData.get("chapterNumber")) : undefined,
      description: formData.get("description"),
      learningObjectives: formData.get("learningObjectives"),
    };
    thumbnailFile = formData.get("thumbnail") as File | null;
  } else {
    body = await c.req.json();
  }

  const updateData: Record<string, any> = {};
  if (body.title !== undefined) updateData.title = body.title;
  if (body.chapterNumber !== undefined) updateData.chapterNumber = body.chapterNumber;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.learningObjectives !== undefined) updateData.learningObjectives = body.learningObjectives;

  if (thumbnailFile) {
    const result = await saveFile(c.env.BUCKET, thumbnailFile, "chapters/thumbnails");
    if (result.ok) updateData.thumbnail = result.key;
  }

  updateData.updatedAt = nowISO();

  await db.update(chapters).set(updateData).where(eq(chapters.id, id));

  const [updated] = await db.select().from(chapters).where(eq(chapters.id, id));
  if (!updated) throw new BadRequestError("Chapter not found");

  return c.json({ success: true, data: updated }, 200);
});

// DELETE chapter
app.delete("/chapters/:id", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const chapterId = c.req.param("id");

  // Delete chapter contents first (FK constraint)
  await db.delete(chapterContents).where(eq(chapterContents.chapterId, chapterId));
  
  // Then delete the chapter
  await db.delete(chapters).where(eq(chapters.id, chapterId));

  return c.json({ success: true, message: "Chapter deleted" }, 200);
});

// ===================== CHAPTER CONTENT =====================

// LIST content for a chapter
app.get("/chapter/:chapterId/content", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const chapterId = c.req.param("chapterId");

  const rows = await db
    .select()
    .from(chapterContents)
    .where(eq(chapterContents.chapterId, chapterId))
    .orderBy(asc(chapterContents.order));

  // Attach quiz questions to quiz content
  const data = await Promise.all(
    rows.map(async (row) => {
      if (row.type === "quiz") {
        const questions = await loadQuizQuestions(db, row.id);
        return { ...row, questions };
      }
      return row;
    }),
  );

  return c.json({ success: true, data }, 200);
});

// CREATE content under a chapter
app.post("/chapter/:chapterId/content", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const chapterId = c.req.param("chapterId");

  const [chapter] = await db.select().from(chapters).where(eq(chapters.id, chapterId));
  if (!chapter) throw new BadRequestError("Chapter not found");

  const contentType = c.req.header("content-type");

  let type: string;
  let title: string | null;
  let isFree: boolean;
  let youtubeUrl: string | null;
  let textContent: string | null;
  let questionsRaw: unknown;
  let file: File | null = null;

  if (isJsonRequest(contentType)) {
    const body = (await c.req.json()) as Record<string, any>;

    type = typeof body.type === "string" ? body.type : "";
    title = typeof body.title === "string" ? body.title : null;
    isFree = parseBool(body.isFree);
    youtubeUrl = typeof body.youtubeUrl === "string" ? body.youtubeUrl : null;
    textContent = typeof body.textContent === "string" ? body.textContent : null;
    questionsRaw = body.questions ?? null;
  } else {
    const formData = await c.req.formData();

    type = (formData.get("type") as string) || "";
    title = formData.get("title") as string | null;
    isFree = parseBool(formData.get("isFree"));
    youtubeUrl = formData.get("youtubeUrl") as string | null;
    textContent = formData.get("textContent") as string | null;
    questionsRaw = formData.get("questions");
    file = formData.get("file") as File | null;
  }

  if (!type) {
    throw new BadRequestError("Content type is required");
  }

  const [countRow] = await db
    .select({ count: count() })
    .from(chapterContents)
    .where(eq(chapterContents.chapterId, chapterId));
  const existingCount = countRow?.count ?? 0;

  // Handle file upload
  let fileKey = "";
  if (file) {
    const folder = type === "video" ? "content/videos" : "content/docs";
    const result = await saveFile(c.env.BUCKET, file, folder);
    if (result.ok) fileKey = result.key;
  }

  const id = uuid();
  const now = nowISO();

  const contentData: Record<string, any> = {
    id,
    chapterId,
    type,
    title: title || `${chapter.chapterNumber}.${existingCount + 1}`,
    order: existingCount + 1,
    isFree: isFree ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  };

  if (type === "youtube") {
    contentData.youtubeUrl = youtubeUrl;
  } else if (type === "text") {
    contentData.textContent = textContent;
  } else if (type === "quiz") {
    if (fileKey) contentData.fileUrl = fileKey;
  } else if (type === "video") {
    contentData.videoUrl = fileKey;
  } else {
    // pdf, ppt, activity, project, note, etc.
    contentData.fileUrl = fileKey;
  }

  await db.insert(chapterContents).values(contentData as any);

  // Save quiz questions
  if (type === "quiz" && questionsRaw) {
    try {
      const questions = typeof questionsRaw === "string" ? JSON.parse(questionsRaw) : questionsRaw;
      if (Array.isArray(questions)) {
        await saveQuizQuestions(db, id, questions);
      }
    } catch {
      /* ignore parse errors */
    }
  }

  const [created] = await db.select().from(chapterContents).where(eq(chapterContents.id, id));
  let data: any = created;
  if (type === "quiz") {
    const questions = await loadQuizQuestions(db, id);
    data = { ...created, questions };
  }

  return c.json({ success: true, data }, 201);
});

// DELETE content
app.delete("/content/:id", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const [content] = await db.select().from(chapterContents).where(eq(chapterContents.id, id));
  if (!content) throw new BadRequestError("Content not found");

  // Delete associated files from R2
  if (content.fileUrl) await deleteFile(c.env.BUCKET, content.fileUrl);
  if (content.videoUrl) await deleteFile(c.env.BUCKET, content.videoUrl);

  // Delete quiz data
  await deleteQuizQuestions(db, id);

  await db.delete(chapterContents).where(eq(chapterContents.id, id));

  return c.json({ success: true, message: "Content deleted" }, 200);
});

// UPDATE content — supports title, youtubeUrl, textContent, questions, and file replacement
app.patch("/content/:id", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const [existing] = await db.select().from(chapterContents).where(eq(chapterContents.id, id));
  if (!existing) throw new BadRequestError("Content not found");

  const contentType = c.req.header("content-type") || "";
  const now = nowISO();
  const updateData: Record<string, any> = { updatedAt: now };

  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData();
    const title = formData.get("title") as string | null;
    const youtubeUrl = formData.get("youtubeUrl") as string | null;
    const textContent = formData.get("textContent") as string | null;
    const questionsRaw = formData.get("questions") as string | null;
    const file = formData.get("file") as File | null;

    if (title) updateData.title = title;
    if (youtubeUrl !== null) updateData.youtubeUrl = youtubeUrl;
    if (textContent !== null) updateData.textContent = textContent;

    // Replace file if provided
    if (file && file.size > 0) {
      const folder = existing.type === "video" ? "content/videos" : "content/docs";
      // Delete old file
      if (existing.videoUrl) await deleteFile(c.env.BUCKET, existing.videoUrl);
      if (existing.fileUrl) await deleteFile(c.env.BUCKET, existing.fileUrl);
      const result = await saveFile(c.env.BUCKET, file, folder);
      if (result.ok) {
        if (existing.type === "video") updateData.videoUrl = result.key;
        else updateData.fileUrl = result.key;
      }
    }

    // Replace quiz questions
    if (questionsRaw && existing.type === "quiz") {
      try {
        const questions = JSON.parse(questionsRaw);
        if (Array.isArray(questions)) {
          await deleteQuizQuestions(db, id);
          await saveQuizQuestions(db, id, questions);
        }
      } catch { /* ignore */ }
    }
  } else {
    const body = await c.req.json();
    if (body.title !== undefined) updateData.title = body.title;
    if (body.youtubeUrl !== undefined) updateData.youtubeUrl = body.youtubeUrl;
    if (body.textContent !== undefined) updateData.textContent = body.textContent;

    if (body.questions !== undefined && existing.type === "quiz") {
      try {
        const questions = typeof body.questions === "string" ? JSON.parse(body.questions) : body.questions;
        if (Array.isArray(questions)) {
          await deleteQuizQuestions(db, id);
          await saveQuizQuestions(db, id, questions);
        }
      } catch { /* ignore */ }
    }
  }

  await db.update(chapterContents).set(updateData).where(eq(chapterContents.id, id));

  const [updated] = await db.select().from(chapterContents).where(eq(chapterContents.id, id));
  let data: any = updated;
  if (existing.type === "quiz") {
    const questions = await loadQuizQuestions(db, id);
    data = { ...updated, questions };
  }

  return c.json({ success: true, data }, 200);
});

// REORDER content
app.post("/chapter/:chapterId/content/reorder", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const chapterId = c.req.param("chapterId");
  const { order } = await c.req.json();

  if (Array.isArray(order) && order.length > 0) {
    // Two-pass to avoid unique index conflicts on {chapterId, order}
    for (let i = 0; i < order.length; i++) {
      await db
        .update(chapterContents)
        .set({ order: -(i + 1) })
        .where(
          and(eq(chapterContents.id, order[i].contentId), eq(chapterContents.chapterId, chapterId)),
        );
    }
    for (const item of order) {
      await db
        .update(chapterContents)
        .set({ order: item.order })
        .where(
          and(eq(chapterContents.id, item.contentId), eq(chapterContents.chapterId, chapterId)),
        );
    }
  }

  return c.json({ success: true, message: "Content reordered" }, 200);
});

// ===================== GLOBAL LISTS (For Tabs) =====================

// All grade books (paginated, with curriculum name)
app.get("/all-gradebooks", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "10", 10);
  const search = c.req.query("search");
  const skip = (page - 1) * limit;

  const db = getDb(c.env.DB);

  const conditions: any[] = [];
  if (search) {
    conditions.push(like(gradeBooks.bookTitle, `%${search}%`));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: gradeBooks.id,
      curriculumId: gradeBooks.curriculumId,
      grade: gradeBooks.grade,
      bookTitle: gradeBooks.bookTitle,
      subtitle: gradeBooks.subtitle,
      coverImage: gradeBooks.coverImage,
      description: gradeBooks.description,
      totalChapters: gradeBooks.totalChapters,
      totalVideos: gradeBooks.totalVideos,
      totalActivities: gradeBooks.totalActivities,
      isPublished: gradeBooks.isPublished,
      createdAt: gradeBooks.createdAt,
      updatedAt: gradeBooks.updatedAt,
      curriculumName: curricula.name,
    })
    .from(gradeBooks)
    .leftJoin(curricula, eq(gradeBooks.curriculumId, curricula.id))
    .where(whereClause)
    .orderBy(desc(gradeBooks.createdAt))
    .limit(limit)
    .offset(skip);

  const [totalRow] = await db.select({ count: count() }).from(gradeBooks).where(whereClause);
  const total = totalRow?.count ?? 0;

  return c.json({ success: true, data: rows, meta: { total, page, limit } }, 200);
});

// All chapters (paginated, with gradeBook + curriculum info)
app.get("/all-chapters", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "10", 10);
  const search = c.req.query("search");
  const skip = (page - 1) * limit;

  const db = getDb(c.env.DB);

  const conditions: any[] = [];
  if (search) {
    conditions.push(like(chapters.title, `%${search}%`));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: chapters.id,
      gradeBookId: chapters.gradeBookId,
      title: chapters.title,
      chapterNumber: chapters.chapterNumber,
      description: chapters.description,
      thumbnail: chapters.thumbnail,
      durationMinutes: chapters.durationMinutes,
      isFree: chapters.isFree,
      order: chapters.order,
      createdAt: chapters.createdAt,
      updatedAt: chapters.updatedAt,
      bookTitle: gradeBooks.bookTitle,
      curriculumId: gradeBooks.curriculumId,
      curriculumName: curricula.name,
    })
    .from(chapters)
    .leftJoin(gradeBooks, eq(chapters.gradeBookId, gradeBooks.id))
    .leftJoin(curricula, eq(gradeBooks.curriculumId, curricula.id))
    .where(whereClause)
    .orderBy(desc(chapters.createdAt))
    .limit(limit)
    .offset(skip);

  const [totalRow] = await db.select({ count: count() }).from(chapters).where(whereClause);
  const total = totalRow?.count ?? 0;

  return c.json({ success: true, data: rows, meta: { total, page, limit } }, 200);
});

export const curriculumController = app;
