import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { institutions, students } from "../../schema/admin";
import { v4 as uuid } from "uuid";
import { generateRollNumber } from "../../lib/roll-number";
import { hashPassword } from "../../lib/password";
import { nowISO } from "../../lib/utils";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";
import { adminAuth } from "../../middleware/admin-auth";

const app = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

app.use("*", adminAuth);

// POST /:id/generate-student-credentials
app.post("/:id/generate-student-credentials", async (c) => {
  const user = c.get("user") as Record<string, any>;

  if (user.role !== "super_admin" && user.role !== "teacher") {
    throw new ForbiddenError("Only super admin and teachers can generate student credentials");
  }

  const institutionId = c.req.param("id");
  const db = getDb(c.env.DB);

  // Verify institution exists
  const [institution] = await db
    .select({ id: institutions.id, name: institutions.name })
    .from(institutions)
    .where(and(eq(institutions.id, institutionId), eq(institutions.isDeleted, 0)));

  if (!institution) {
    throw new BadRequestError("Institution not found");
  }

  // Non-super_admin must belong to this institution
  if (user.role !== "super_admin") {
    const userInstId =
      typeof user.institutionId === "object"
        ? (user.institutionId as any)._id?.toString()
        : user.institutionId?.toString();
    if (userInstId !== institutionId) {
      throw new ForbiddenError("Access denied to this institution");
    }
  }

  // Find all active students without a username (need credentials)
  const studentsWithoutCredentials = await db
    .select({
      id: students.id,
      name: students.name,
      username: students.username,
      rollNumber: students.rollNumber,
    })
    .from(students)
    .where(
      and(
        eq(students.institutionId, institutionId),
        eq(students.isDeleted, 0),
        eq(students.isActive, 1),
        sql`${students.username} IS NULL`,
      ),
    )
    .orderBy(students.name);

  if (studentsWithoutCredentials.length === 0) {
    throw new BadRequestError(
      "All students already have credentials or no active students found",
    );
  }

  const now = nowISO();
  const results: { id: string; name: string; rollNumber: string; username?: string; plainPassword: string }[] = [];

  for (const student of studentsWithoutCredentials) {
    const rollNumber = student.rollNumber || (await generateRollNumber(db, institutionId)) || uuid();
    const plainPassword = Array.from({ length: 3 }, () => Math.random().toString(36).slice(2, 6)).join("-");
    const hashedPassword = await hashPassword(plainPassword);

    await db
      .update(students)
      .set({
        username: rollNumber,
        password: hashedPassword,
        updatedAt: now,
      })
      .where(eq(students.id, student.id));

    results.push({
      id: student.id,
      name: student.name ?? "Unknown",
      rollNumber,
      username: rollNumber,
      plainPassword,
    });
  }

  return c.json(
    {
      success: true,
      message: `Generated credentials for ${results.length} student(s)`,
      data: results,
    },
    201,
  );
});

// GET /:id/student-credentials — list all students with credentials for CSV export
app.get("/:id/student-credentials", async (c) => {
  const user = c.get("user") as Record<string, any>;
  console.log("[student-credentials] GET handler — user:", { role: user.role, id: user.id, institutionId: user.institutionId });

  if (user.role !== "super_admin" && user.role !== "teacher") {
    console.warn("[student-credentials] Forbidden — role:", user.role);
    throw new ForbiddenError("Only super admin and teachers can view student credentials");
  }

  const institutionId = c.req.param("id");
  console.log("[student-credentials] institutionId param:", institutionId);
  const db = getDb(c.env.DB);

  const [institution] = await db
    .select({ id: institutions.id, name: institutions.name })
    .from(institutions)
    .where(and(eq(institutions.id, institutionId), eq(institutions.isDeleted, 0)));

  if (!institution) {
    console.warn("[student-credentials] Institution not found:", institutionId);
    throw new BadRequestError("Institution not found");
  }

  if (user.role !== "super_admin") {
    const userInstId =
      typeof user.institutionId === "object"
        ? (user.institutionId as any)._id?.toString()
        : user.institutionId?.toString();
    console.log("[student-credentials] Checking institution — userInstId:", userInstId, "param:", institutionId);
    if (userInstId !== institutionId) {
      console.warn("[student-credentials] Institution mismatch — userInstId:", userInstId, "param:", institutionId);
      throw new ForbiddenError("Access denied to this institution");
    }
  }

  const studentsWithCredentials = await db
    .select({
      id: students.id,
      name: students.name,
      username: students.username,
      rollNumber: students.rollNumber,
    })
    .from(students)
    .where(
      and(
        eq(students.institutionId, institutionId),
        eq(students.isDeleted, 0),
        eq(students.isActive, 1),
        sql`${students.username} IS NOT NULL`,
      ),
    )
    .orderBy(students.name);

  const studentsWithPasswords = studentsWithCredentials.map((s) => ({
    ...s,
    plainPassword: "********",
  }));

  return c.json({
    success: true,
    data: {
      institutionName: institution.name,
      students: studentsWithPasswords,
    },
  });
});

export { app as studentCredentialController };
