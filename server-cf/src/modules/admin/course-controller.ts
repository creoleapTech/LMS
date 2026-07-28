import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, like, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { courses, institutions } from "../../schema/admin";
import { nowISO } from "../../lib/utils";
import { BadRequestError } from "../../lib/errors/bad-request";
import { adminAuth } from "../../middleware/admin-auth";
import { TEXT_LIMITS } from "../../lib/validation/text";

const courseController = new Hono<{ Bindings: Bindings; Variables: Variables }>();

courseController.use("*", adminAuth);

const courseSchema = z.object({
  code: z.string().trim().min(1, "Code is required").max(TEXT_LIMITS.courseCode, "Code too long"),
  name: z.string().trim().min(1, "Name is required").max(TEXT_LIMITS.courseName, "Name too long"),
  description: z.string().trim().max(TEXT_LIMITS.courseDescription, "Description too long").optional().or(z.literal("")),
  thumbnail: z.string().optional(),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]).optional(),
  duration: z.string().trim().max(TEXT_LIMITS.courseDuration, "Duration too long").optional().or(z.literal("")),
  fees: z.number().min(0, "Fees cannot be negative").optional(),
  status: z.enum(["Active", "Inactive", "Archived"]).optional(),
  startDate: z.string().optional(),
  institutionId: z.string().optional(),
});

// ─── LIST Courses ─────────────────────────────────
courseController.get("/", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const rows = await db
    .select()
    .from(courses)
    .where(and(eq(courses.isDeleted, 0), eq(courses.isActive, 1)));

  return c.json({ success: true, data: rows });
});

// ─── GET Course by ID ─────────────────────────────
courseController.get("/:id", async (c) => {
  const { id } = c.req.param();
  const db = getDb(c.env.DB);

  const [row] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, id), eq(courses.isDeleted, 0)))
    .limit(1);

  if (!row) {
    throw new BadRequestError("Course not found");
  }

  return c.json({ success: true, data: row });
});

// ─── CREATE Course ────────────────────────────────
courseController.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = courseSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const db = getDb(c.env.DB);
  const now = nowISO();
  const id = uuid();

  const [row] = await db
    .insert(courses)
    .values({
      id,
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      thumbnail: parsed.data.thumbnail ?? null,
      level: parsed.data.level ?? null,
      duration: parsed.data.duration ?? null,
      fees: parsed.data.fees ?? 0,
      status: parsed.data.status ?? "Active",
      startDate: parsed.data.startDate ?? null,
      institutionId: parsed.data.institutionId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json({ success: true, message: "Course created", data: row }, 201);
});

// ─── UPDATE Course ────────────────────────────────
courseController.put("/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const parsed = courseSchema.partial().safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const db = getDb(c.env.DB);
  const now = nowISO();

  const [existing] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, id), eq(courses.isDeleted, 0)))
    .limit(1);

  if (!existing) {
    throw new BadRequestError("Course not found");
  }

  const [row] = await db
    .update(courses)
    .set({ ...parsed.data, updatedAt: now })
    .where(eq(courses.id, id))
    .returning();

  return c.json({ success: true, message: "Course updated", data: row });
});

// ─── DELETE Course (soft) ─────────────────────────
courseController.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const db = getDb(c.env.DB);
  const now = nowISO();

  const [existing] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, id), eq(courses.isDeleted, 0)))
    .limit(1);

  if (!existing) {
    throw new BadRequestError("Course not found");
  }

  await db
    .update(courses)
    .set({ isDeleted: 1, updatedAt: now })
    .where(eq(courses.id, id));

  return c.json({ success: true, message: "Course deleted" });
});

export { courseController };
