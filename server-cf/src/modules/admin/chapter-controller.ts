// Chapter CRUD — ported from Elysia chapter-controller.ts
// Uses adminAuth middleware (original checked headers.decoded manually)
import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { v4 as uuid } from "uuid";
import { nowISO } from "../../lib/utils";
import { eq, and, asc, count } from "drizzle-orm";
import { adminAuth } from "../../middleware/admin-auth";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";
import { chapters, gradeBooks } from "../../schema/books";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", adminAuth);

// CREATE Chapter — find gradeBook by curriculumId + grade, then create chapter
app.post("/:curriculumId/grades/:grade/chapters", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const curriculumId = c.req.param("curriculumId");
  const grade = parseInt(c.req.param("grade"), 10);

  const [gradeBook] = await db
    .select()
    .from(gradeBooks)
    .where(and(eq(gradeBooks.curriculumId, curriculumId), eq(gradeBooks.grade, grade)))
    .limit(1);
  if (!gradeBook) throw new BadRequestError("Grade book not found");

  const body = await c.req.json();

  const id = uuid();
  const now = nowISO();

  await db.insert(chapters).values({
    id,
    gradeBookId: gradeBook.id,
    title: body.title,
    chapterNumber: body.chapterNumber,
    description: body.description || null,
    isFree: body.isFree ? 1 : 0,
    order: body.order,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db.select().from(chapters).where(eq(chapters.id, id));

  return c.json({ success: true, data: created }, 201);
});

// LIST Chapters by curriculum + grade
app.get("/:curriculumId/grades/:grade/chapters", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const curriculumId = c.req.param("curriculumId");
  const grade = parseInt(c.req.param("grade"), 10);

  const [gradeBook] = await db
    .select()
    .from(gradeBooks)
    .where(and(eq(gradeBooks.curriculumId, curriculumId), eq(gradeBooks.grade, grade)))
    .limit(1);
  if (!gradeBook) throw new BadRequestError("Grade book not found");

  const rows = await db
    .select()
    .from(chapters)
    .where(eq(chapters.gradeBookId, gradeBook.id))
    .orderBy(asc(chapters.order));

  return c.json({ success: true, data: rows }, 200);
});

// UPDATE Chapter
app.patch("/:curriculumId/grades/:grade/chapters/:chapterId", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const chapterId = c.req.param("chapterId");
  const body = await c.req.json();

  const updateData: Record<string, any> = {};
  if (body.title !== undefined) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.isFree !== undefined) updateData.isFree = body.isFree ? 1 : 0;
  if (body.order !== undefined) updateData.order = body.order;
  updateData.updatedAt = nowISO();

  await db.update(chapters).set(updateData).where(eq(chapters.id, chapterId));

  const [updated] = await db.select().from(chapters).where(eq(chapters.id, chapterId));
  if (!updated) throw new BadRequestError("Chapter not found");

  return c.json({ success: true, data: updated }, 200);
});

// REORDER Chapters
app.post("/:curriculumId/grades/:grade/chapters/reorder", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const body = await c.req.json();

  if (Array.isArray(body) && body.length > 0) {
    // Two-pass to avoid unique index conflicts
    for (let i = 0; i < body.length; i++) {
      await db
        .update(chapters)
        .set({ order: -(i + 1) })
        .where(eq(chapters.id, body[i].chapterId));
    }
    for (const item of body) {
      await db
        .update(chapters)
        .set({ order: item.order })
        .where(eq(chapters.id, item.chapterId));
    }
  }

  return c.json({ success: true, message: "Chapters reordered" }, 200);
});

// DELETE Chapter
app.delete("/:curriculumId/grades/:grade/chapters/:chapterId", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const chapterId = c.req.param("chapterId");

  const [existing] = await db.select().from(chapters).where(eq(chapters.id, chapterId));
  if (!existing) throw new BadRequestError("Chapter not found");

  await db.delete(chapters).where(eq(chapters.id, chapterId));

  return c.json({ success: true, message: "Chapter deleted" }, 200);
});

export const chapterController = app;
