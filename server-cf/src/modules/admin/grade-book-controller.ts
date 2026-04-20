// GradeBook CRUD — ported from Elysia gradeBook-controller.ts
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
import { curricula, gradeBooks } from "../../schema/books";
import { saveFile, deleteFile } from "../../lib/file";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", adminAuth);

function isJsonRequest(contentType: string | undefined): boolean {
  return (contentType ?? "").toLowerCase().includes("application/json");
}

// CREATE GradeBook
app.post("/:curriculumId/grades", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Only super_admin can manage grade books");

  const db = getDb(c.env.DB);
  const curriculumId = c.req.param("curriculumId");

  const [curriculum] = await db.select().from(curricula).where(eq(curricula.id, curriculumId));
  if (!curriculum) throw new BadRequestError("Curriculum not found");

  let grade: number | undefined;
  let bookTitle: string | undefined;
  let subtitle: string | null = null;
  let description: string | null = null;
  let isPublished = false;
  let coverImageFile: File | null = null;
  let coverImageUrl: string | null = null;

  const contentType = c.req.header("content-type");

  if (isJsonRequest(contentType)) {
    const body = await c.req.json();
    grade = body.grade;
    bookTitle = body.bookTitle;
    subtitle = body.subtitle || null;
    description = body.description || null;
    isPublished = !!body.isPublished;
    coverImageUrl = body.coverImage || null;
  } else {
    const formData = await c.req.formData();
    grade = parseInt(formData.get("grade") as string, 10);
    bookTitle = formData.get("bookTitle") as string;
    subtitle = (formData.get("subtitle") as string) || null;
    description = (formData.get("description") as string) || null;
    isPublished = formData.get("isPublished") === "true";
    const coverInput = formData.get("coverImage");
    if (coverInput && typeof coverInput !== "string") {
      coverImageFile = coverInput as unknown as File;
    } else if (typeof coverInput === "string") {
      coverImageUrl = coverInput || null;
    }
  }

  if (!grade || !bookTitle) throw new BadRequestError("grade and bookTitle are required");

  // Check existing
  const [existing] = await db
    .select()
    .from(gradeBooks)
    .where(and(eq(gradeBooks.curriculumId, curriculumId), eq(gradeBooks.grade, grade)))
    .limit(1);
  if (existing) throw new BadRequestError("Grade book already exists for this grade");

  // Handle cover image upload
  let coverImage: string | null = coverImageUrl;
  if (coverImageFile) {
    const result = await saveFile(c.env.BUCKET, coverImageFile, "gradebook/covers");
    if (result.ok) coverImage = result.key;
  }

  const id = uuid();
  const now = nowISO();

  await db.insert(gradeBooks).values({
    id,
    curriculumId,
    grade,
    bookTitle,
    subtitle,
    coverImage,
    description,
    isPublished: isPublished ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db.select().from(gradeBooks).where(eq(gradeBooks.id, id));

  return c.json({ success: true, data: created }, 201);
});

// LIST GradeBooks by Curriculum (with curriculum name via join)
app.get("/:curriculumId/grades", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const curriculumId = c.req.param("curriculumId");

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
    .where(eq(gradeBooks.curriculumId, curriculumId))
    .orderBy(asc(gradeBooks.grade));

  return c.json({ success: true, data: rows }, 200);
});

// UPDATE GradeBook (by curriculumId + grade)
app.patch("/:curriculumId/grades/:grade", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const curriculumId = c.req.param("curriculumId");
  const grade = parseInt(c.req.param("grade"), 10);

  const [existing] = await db
    .select()
    .from(gradeBooks)
    .where(and(eq(gradeBooks.curriculumId, curriculumId), eq(gradeBooks.grade, grade)));
  if (!existing) throw new BadRequestError("Grade book not found");

  const updateData: Record<string, any> = { updatedAt: nowISO() };
  const contentType = c.req.header("content-type");

  if (isJsonRequest(contentType)) {
    const body = await c.req.json();
    if (body.bookTitle !== undefined) updateData.bookTitle = body.bookTitle;
    if (body.subtitle !== undefined) updateData.subtitle = body.subtitle;
    if (body.coverImage !== undefined) updateData.coverImage = body.coverImage;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.isPublished !== undefined) updateData.isPublished = body.isPublished ? 1 : 0;
  } else {
    const formData = await c.req.formData();
    const bookTitle = formData.get("bookTitle");
    const subtitle = formData.get("subtitle");
    const description = formData.get("description");
    const isPublished = formData.get("isPublished");

    if (bookTitle !== null) updateData.bookTitle = bookTitle;
    if (subtitle !== null) updateData.subtitle = subtitle;
    if (description !== null) updateData.description = description;
    if (isPublished !== null) updateData.isPublished = isPublished === "true" ? 1 : 0;

    const coverInput = formData.get("coverImage");
    if (coverInput && typeof coverInput !== "string") {
      // Delete old cover image from R2
      if (existing.coverImage) {
        await deleteFile(c.env.BUCKET, existing.coverImage);
      }
      const result = await saveFile(c.env.BUCKET, coverInput as unknown as File, "gradebook/covers");
      if (result.ok) updateData.coverImage = result.key;
    } else if (typeof coverInput === "string") {
      updateData.coverImage = coverInput || null;
    }
  }

  await db
    .update(gradeBooks)
    .set(updateData)
    .where(and(eq(gradeBooks.curriculumId, curriculumId), eq(gradeBooks.grade, grade)));

  const [updated] = await db
    .select()
    .from(gradeBooks)
    .where(and(eq(gradeBooks.curriculumId, curriculumId), eq(gradeBooks.grade, grade)));

  return c.json({ success: true, data: updated }, 200);
});

// DELETE GradeBook (by curriculumId + grade)
app.delete("/:curriculumId/grades/:grade", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

  const db = getDb(c.env.DB);
  const curriculumId = c.req.param("curriculumId");
  const grade = parseInt(c.req.param("grade"), 10);

  const [existing] = await db
    .select()
    .from(gradeBooks)
    .where(and(eq(gradeBooks.curriculumId, curriculumId), eq(gradeBooks.grade, grade)));
  if (!existing) throw new BadRequestError("Grade book not found");

  // Delete cover image from R2
  if (existing.coverImage) {
    await deleteFile(c.env.BUCKET, existing.coverImage);
  }

  await db
    .delete(gradeBooks)
    .where(and(eq(gradeBooks.curriculumId, curriculumId), eq(gradeBooks.grade, grade)));

  return c.json({ success: true, message: "Grade book deleted" }, 200);
});

export const gradeBookController = app;
