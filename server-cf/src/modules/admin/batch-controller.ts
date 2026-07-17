import { Hono } from "hono";
import { z } from "zod";
import { eq, and, ne, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { batches, courses, staff, students } from "../../schema/admin";
import { batchStudents } from "../../schema/junction";
import { nowISO } from "../../lib/utils";
import { BadRequestError } from "../../lib/errors/bad-request";
import { adminAuth } from "../../middleware/admin-auth";

const batchController = new Hono<{ Bindings: Bindings; Variables: Variables }>();

batchController.use("*", adminAuth);

const batchSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  courseId: z.string().min(1, "Course is required"),
  instructorId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(["Active", "Upcoming", "Completed"]).optional(),
});

// ─── LIST Batches (optionally filtered by courseId, instructorId, or studentId) ──
batchController.get("/", async (c) => {
  const courseId = c.req.query("courseId");
  const instructorId = c.req.query("instructorId");
  const studentId = c.req.query("studentId");
  const db = getDb(c.env.DB);

  const conditions = [eq(batches.isDeleted, 0)];
  if (courseId) conditions.push(eq(batches.courseId, courseId));
  if (instructorId) conditions.push(eq(batches.instructorId, instructorId));

  let rows;

  if (studentId) {
    // Get batch IDs the student is enrolled in
    const enrolledBatchIds = await db
      .select({ batchId: batchStudents.batchId })
      .from(batchStudents)
      .where(and(eq(batchStudents.studentId, studentId), eq(batchStudents.isActive, 1)));
    const batchIds = enrolledBatchIds.map((r) => r.batchId);
    if (batchIds.length === 0) {
      return c.json({ success: true, data: [] });
    }
    conditions.push(inArray(batches.id, batchIds));
  }

  rows = await db
    .select()
    .from(batches)
    .where(and(...conditions));

  // Attach instructor name from staff table
  const result = await Promise.all(
    rows.map(async (batch) => {
      if (batch.instructorId) {
        const [inst] = await db
          .select({ id: staff.id, name: staff.name, email: staff.email })
          .from(staff)
          .where(eq(staff.id, batch.instructorId))
          .limit(1);
        return { ...batch, instructorName: inst?.name ?? null, instructorEmail: inst?.email ?? null };
      }
      return { ...batch, instructorName: null, instructorEmail: null };
    })
  );

  return c.json({ success: true, data: result });
});

// ─── LIST Instructors (for dropdown) ──────────────
batchController.get("/meta/instructors", async (c) => {
  const db = getDb(c.env.DB);

  const rows = await db
    .select({ id: staff.id, name: staff.name, email: staff.email, type: staff.type })
    .from(staff)
    .where(and(eq(staff.isDeleted, 0), eq(staff.isActive, 1)));

  return c.json({ success: true, data: rows });
});

// ─── GET Batch Students (enrolled) ────────────────
batchController.get("/:id/students", async (c) => {
  const { id } = c.req.param();
  const db = getDb(c.env.DB);

  const [batch] = await db
    .select()
    .from(batches)
    .where(and(eq(batches.id, id), eq(batches.isDeleted, 0)))
    .limit(1);

  if (!batch) {
    throw new BadRequestError("Batch not found");
  }

  const enrolled = await db
    .select({
      batchStudentId: batchStudents.id,
      enrolledAt: batchStudents.enrolledAt,
      studentId: students.id,
      name: students.name,
      email: students.email,
      username: students.username,
      rollNumber: students.rollNumber,
      admissionNumber: students.admissionNumber,
      isActive: students.isActive,
    })
    .from(batchStudents)
    .innerJoin(students, eq(batchStudents.studentId, students.id))
    .where(and(eq(batchStudents.batchId, id), eq(batchStudents.isActive, 1)));

  return c.json({ success: true, data: enrolled });
});

// ─── POST Enroll Student in Batch ─────────────────
batchController.post("/:id/enroll", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const db = getDb(c.env.DB);

  if (!body.studentId) {
    throw new BadRequestError("studentId is required");
  }

  const [batch] = await db
    .select()
    .from(batches)
    .where(and(eq(batches.id, id), eq(batches.isDeleted, 0)))
    .limit(1);

  if (!batch) {
    throw new BadRequestError("Batch not found");
  }

  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, body.studentId), eq(students.isDeleted, 0)))
    .limit(1);

  if (!student) {
    throw new BadRequestError("Student not found");
  }

  // Check if already enrolled
  const [existing] = await db
    .select()
    .from(batchStudents)
    .where(and(eq(batchStudents.batchId, id), eq(batchStudents.studentId, body.studentId), eq(batchStudents.isActive, 1)))
    .limit(1);

  if (existing) {
    throw new BadRequestError("Student is already enrolled in this batch");
  }

  const now = nowISO();
  const enrollmentId = uuid();

  const [row] = await db
    .insert(batchStudents)
    .values({
      id: enrollmentId,
      batchId: id,
      studentId: body.studentId,
      enrolledAt: now,
      isActive: 1,
    })
    .returning();

  return c.json({ success: true, message: "Student enrolled", data: row }, 201);
});

// ─── DELETE Unenroll Student from Batch ────────────
batchController.delete("/:id/enroll/:studentId", async (c) => {
  const { id, studentId } = c.req.param();
  const db = getDb(c.env.DB);
  const now = nowISO();

  const [existing] = await db
    .select()
    .from(batchStudents)
    .where(and(eq(batchStudents.batchId, id), eq(batchStudents.studentId, studentId), eq(batchStudents.isActive, 1)))
    .limit(1);

  if (!existing) {
    throw new BadRequestError("Enrollment not found");
  }

  await db
    .update(batchStudents)
    .set({ isActive: 0 })
    .where(eq(batchStudents.id, existing.id));

  return c.json({ success: true, message: "Student unenrolled" });
});

// ─── GET Batch by ID ──────────────────────────────
batchController.get("/:id", async (c) => {
  const { id } = c.req.param();
  const db = getDb(c.env.DB);

  const [row] = await db
    .select()
    .from(batches)
    .where(and(eq(batches.id, id), eq(batches.isDeleted, 0)))
    .limit(1);

  if (!row) {
    throw new BadRequestError("Batch not found");
  }

  let instructorName = null;
  let instructorEmail = null;
  if (row.instructorId) {
    const [inst] = await db
      .select({ id: staff.id, name: staff.name, email: staff.email })
      .from(staff)
      .where(eq(staff.id, row.instructorId))
      .limit(1);
    instructorName = inst?.name ?? null;
    instructorEmail = inst?.email ?? null;
  }

  return c.json({ success: true, data: { ...row, instructorName, instructorEmail } });
});

// ─── CREATE Batch ─────────────────────────────────
batchController.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const db = getDb(c.env.DB);

  // Verify course exists
  const [course] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, parsed.data.courseId), eq(courses.isDeleted, 0)))
    .limit(1);

  if (!course) {
    throw new BadRequestError("Course not found");
  }

  // Verify instructor if provided
  if (parsed.data.instructorId) {
    const [inst] = await db
      .select()
      .from(staff)
      .where(and(eq(staff.id, parsed.data.instructorId), eq(staff.isDeleted, 0)))
      .limit(1);

    if (!inst) {
      throw new BadRequestError("Instructor not found");
    }
  }

  const now = nowISO();
  const id = uuid();

  const [row] = await db
    .insert(batches)
    .values({
      id,
      name: parsed.data.name,
      courseId: parsed.data.courseId,
      instructorId: parsed.data.instructorId ?? null,
      startDate: parsed.data.startDate ?? null,
      endDate: parsed.data.endDate ?? null,
      status: parsed.data.status ?? "Upcoming",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json({ success: true, message: "Batch created", data: row }, 201);
});

// ─── UPDATE Batch ─────────────────────────────────
batchController.put("/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const parsed = batchSchema.partial().safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const db = getDb(c.env.DB);
  const now = nowISO();

  const [existing] = await db
    .select()
    .from(batches)
    .where(and(eq(batches.id, id), eq(batches.isDeleted, 0)))
    .limit(1);

  if (!existing) {
    throw new BadRequestError("Batch not found");
  }

  // Verify instructor if being changed
  if (parsed.data.instructorId) {
    const [inst] = await db
      .select()
      .from(staff)
      .where(and(eq(staff.id, parsed.data.instructorId), eq(staff.isDeleted, 0)))
      .limit(1);

    if (!inst) {
      throw new BadRequestError("Instructor not found");
    }
  }

  const [row] = await db
    .update(batches)
    .set({ ...parsed.data, updatedAt: now })
    .where(eq(batches.id, id))
    .returning();

  return c.json({ success: true, message: "Batch updated", data: row });
});

// ─── DELETE Batch (soft) ──────────────────────────
batchController.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const db = getDb(c.env.DB);
  const now = nowISO();

  const [existing] = await db
    .select()
    .from(batches)
    .where(and(eq(batches.id, id), eq(batches.isDeleted, 0)))
    .limit(1);

  if (!existing) {
    throw new BadRequestError("Batch not found");
  }

  await db
    .update(batches)
    .set({ isDeleted: 1, updatedAt: now })
    .where(eq(batches.id, id));

  return c.json({ success: true, message: "Batch deleted" });
});

export { batchController };
