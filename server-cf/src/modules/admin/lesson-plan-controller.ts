import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { v4 as uuid } from "uuid";
import { nowISO } from "../../lib/utils";
import { eq, and, count, like } from "drizzle-orm";
import { adminAuth } from "../../middleware/admin-auth";
import { lessonPlans } from "../../schema/lesson-plans";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";

const lessonPlanController = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Apply auth to all routes
lessonPlanController.use("*", adminAuth);

// ─── GET / — List lesson plans ─────────────────────
lessonPlanController.get("/", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const teacherId = c.req.query("teacherId");
  const institutionId = c.req.query("institutionId");
  const status = c.req.query("status");
  const year = c.req.query("year");
  const month = c.req.query("month");
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "50", 10)));
  const offset = (page - 1) * limit;

  const conditions: any[] = [eq(lessonPlans.isDeleted, 0)];

  if (user.role === "teacher") {
    // Teachers only see their own plans
    conditions.push(eq(lessonPlans.staffId, user.id as string));
  } else if (user.role === "admin") {
    // Admins see plans for their institution, optionally filtered by teacher
    conditions.push(eq(lessonPlans.institutionId, user.institutionId as string));
    if (teacherId) {
      conditions.push(eq(lessonPlans.staffId, teacherId));
    }
  } else if (user.role === "super_admin") {
    // Super admins can filter by institution and/or teacher
    if (institutionId) {
      conditions.push(eq(lessonPlans.institutionId, institutionId));
    }
    if (teacherId) {
      conditions.push(eq(lessonPlans.staffId, teacherId));
    }
  } else {
    throw new ForbiddenError("Access denied");
  }

  // Optional filters
  if (status) {
    if (!["draft", "ready", "completed"].includes(status)) {
      throw new BadRequestError("Invalid status value");
    }
    conditions.push(eq(lessonPlans.status, status as "draft" | "ready" | "completed"));
  }

  // Date filtering — build a single LIKE pattern covering year and/or month
  if (year || month) {
    let yearNum: number | undefined;
    let monthNum: number | undefined;

    if (year) {
      yearNum = parseInt(year, 10);
      if (isNaN(yearNum)) {
        throw new BadRequestError("Invalid year value");
      }
    }

    if (month) {
      monthNum = parseInt(month, 10);
      if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        throw new BadRequestError("Invalid month value (must be 1–12)");
      }
    }

    if (yearNum !== undefined && monthNum !== undefined) {
      // Both year and month: match YYYY-MM-%
      const monthStr = String(monthNum).padStart(2, "0");
      conditions.push(like(lessonPlans.date, `${yearNum}-${monthStr}-%`));
    } else if (yearNum !== undefined) {
      // Year only: match YYYY-%
      conditions.push(like(lessonPlans.date, `${yearNum}-%`));
    } else if (monthNum !== undefined) {
      // Month only: match %-MM-%
      const monthStr = String(monthNum).padStart(2, "0");
      conditions.push(like(lessonPlans.date, `%-${monthStr}-%`));
    }
  }

  const [totalRow] = await db
    .select({ count: count() })
    .from(lessonPlans)
    .where(and(...conditions));

  const rows = await db
    .select()
    .from(lessonPlans)
    .where(and(...conditions))
    .orderBy(lessonPlans.date)
    .limit(limit)
    .offset(offset);

  return c.json(
    {
      success: true,
      data: rows,
      meta: { total: totalRow?.count ?? 0, page, limit },
    },
    200
  );
});

// ─── POST / — Create lesson plan ───────────────────
lessonPlanController.post("/", async (c) => {
  const body = await c.req.json();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  // Validate required fields
  const requiredFields = ["title", "subject", "gradeOrClass", "date", "durationMinutes"] as const;
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      throw new BadRequestError(`Missing required field: ${field}`);
    }
  }

  if (typeof body.durationMinutes !== "number" || body.durationMinutes <= 0) {
    throw new BadRequestError("durationMinutes must be a positive number");
  }

  const id = uuid();
  const now = nowISO();

  const [newPlan] = await db
    .insert(lessonPlans)
    .values({
      id,
      staffId: user.id as string,
      institutionId: user.institutionId as string,
      title: body.title,
      subject: body.subject,
      gradeOrClass: body.gradeOrClass,
      date: body.date,
      durationMinutes: body.durationMinutes,
      status: "draft", // Always start as draft regardless of payload
      learningObjectives: body.learningObjectives ?? null,
      materialsNeeded: body.materialsNeeded ?? null,
      introduction: body.introduction ?? null,
      mainActivity: body.mainActivity ?? null,
      conclusion: body.conclusion ?? null,
      assessmentMethod: body.assessmentMethod ?? null,
      homeworkNotes: body.homeworkNotes ?? null,
      gradeBookId: body.gradeBookId ?? null,
      chapterId: body.chapterId ?? null,
      isDeleted: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json({ success: true, data: newPlan }, 201);
});

// ─── GET /:id — Get single lesson plan ─────────────
lessonPlanController.get("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const [plan] = await db
    .select()
    .from(lessonPlans)
    .where(and(eq(lessonPlans.id, id), eq(lessonPlans.isDeleted, 0)))
    .limit(1);

  if (!plan) {
    throw new BadRequestError("Lesson plan not found");
  }

  // Ownership / visibility check
  if (user.role === "teacher") {
    if (plan.staffId !== user.id) {
      throw new ForbiddenError("Access denied");
    }
  } else if (user.role === "admin") {
    if (plan.institutionId !== user.institutionId) {
      throw new ForbiddenError("Access denied");
    }
  }
  // super_admin can access any plan

  return c.json({ success: true, data: plan }, 200);
});

// ─── PATCH /:id — Update lesson plan fields ─────────
lessonPlanController.patch("/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  // Admins and super_admins are read-only
  if (user.role === "admin" || user.role === "super_admin") {
    throw new ForbiddenError("Admins cannot edit lesson plans");
  }

  const [plan] = await db
    .select()
    .from(lessonPlans)
    .where(and(eq(lessonPlans.id, id), eq(lessonPlans.isDeleted, 0)))
    .limit(1);

  if (!plan) {
    throw new BadRequestError("Lesson plan not found");
  }

  // Teachers can only edit their own plans
  if (user.role === "teacher" && plan.staffId !== user.id) {
    throw new ForbiddenError("Access denied");
  }

  const updateData: Record<string, any> = { updatedAt: nowISO() };

  const allowedFields = [
    "title",
    "subject",
    "gradeOrClass",
    "date",
    "durationMinutes",
    "learningObjectives",
    "materialsNeeded",
    "introduction",
    "mainActivity",
    "conclusion",
    "assessmentMethod",
    "homeworkNotes",
    "gradeBookId",
    "chapterId",
  ] as const;

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  await db.update(lessonPlans).set(updateData).where(eq(lessonPlans.id, id));

  const [updated] = await db
    .select()
    .from(lessonPlans)
    .where(eq(lessonPlans.id, id))
    .limit(1);

  return c.json({ success: true, data: updated }, 200);
});

// ─── PATCH /:id/status — Update status only ─────────
lessonPlanController.patch("/:id/status", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const validStatuses = ["draft", "ready", "completed"] as const;
  if (!body.status || !validStatuses.includes(body.status)) {
    throw new BadRequestError("status must be one of: draft, ready, completed");
  }

  const [plan] = await db
    .select()
    .from(lessonPlans)
    .where(and(eq(lessonPlans.id, id), eq(lessonPlans.isDeleted, 0)))
    .limit(1);

  if (!plan) {
    throw new BadRequestError("Lesson plan not found");
  }

  // Ownership check — same rules as PATCH
  if (user.role === "teacher") {
    if (plan.staffId !== user.id) {
      throw new ForbiddenError("Access denied");
    }
  } else if (user.role === "admin") {
    if (plan.institutionId !== user.institutionId) {
      throw new ForbiddenError("Access denied");
    }
  }
  // super_admin can update status on any plan

  await db
    .update(lessonPlans)
    .set({ status: body.status, updatedAt: nowISO() })
    .where(eq(lessonPlans.id, id));

  const [updated] = await db
    .select()
    .from(lessonPlans)
    .where(eq(lessonPlans.id, id))
    .limit(1);

  return c.json({ success: true, data: updated }, 200);
});

// ─── DELETE /:id — Soft-delete lesson plan ──────────
lessonPlanController.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const [plan] = await db
    .select()
    .from(lessonPlans)
    .where(and(eq(lessonPlans.id, id), eq(lessonPlans.isDeleted, 0)))
    .limit(1);

  if (!plan) {
    throw new BadRequestError("Lesson plan not found");
  }

  // Ownership check
  if (user.role === "teacher") {
    if (plan.staffId !== user.id) {
      throw new ForbiddenError("Access denied");
    }
  } else if (user.role === "admin") {
    if (plan.institutionId !== user.institutionId) {
      throw new ForbiddenError("Access denied");
    }
  }
  // super_admin can delete any plan

  await db
    .update(lessonPlans)
    .set({ isDeleted: 1, updatedAt: nowISO() })
    .where(eq(lessonPlans.id, id));

  return c.json({ success: true, message: "Lesson plan deleted successfully" }, 200);
});

export { lessonPlanController };
