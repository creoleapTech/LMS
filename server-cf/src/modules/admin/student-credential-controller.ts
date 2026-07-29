import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { institutions, students } from "../../schema/admin";
import { generateRollNumbers, institutionInitials, pickWord, padSequence, reconstructPassword } from "../../lib/roll-number";
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

  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new ForbiddenError("Only admin can generate student credentials");
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

  const prefix = institutionInitials(institution.name);

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

  const rollNumbers = await generateRollNumbers(db, institutionId, studentsWithoutCredentials.length);
  const now = nowISO();
  const results: { id: string; name: string; rollNumber: string; username?: string; plainPassword: string }[] = [];

  for (let i = 0; i < studentsWithoutCredentials.length; i++) {
    const student = studentsWithoutCredentials[i];
    const rollNumber = rollNumbers[i];
    const seqStr = rollNumber.slice(prefix.length + 2);
    const seq = parseInt(seqStr, 10);
    const plainPassword = `${pickWord(seq - 1)}@${seqStr}`;
    const hashedPassword = await hashPassword(plainPassword);

    const finalRollNumber = student.rollNumber || rollNumber;
    const finalUsername = student.username || rollNumber;

    await db
      .update(students)
      .set({
        rollNumber: finalRollNumber,
        username: finalUsername,
        password: hashedPassword,
        updatedAt: now,
      })
      .where(eq(students.id, student.id));

    results.push({
      id: student.id,
      name: student.name ?? "Unknown",
      rollNumber: finalRollNumber,
      username: finalUsername,
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

  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new ForbiddenError("Only admin can view student credentials");
  }

  const institutionId = c.req.param("id");
  const db = getDb(c.env.DB);

  const [institution] = await db
    .select({ id: institutions.id, name: institutions.name })
    .from(institutions)
    .where(and(eq(institutions.id, institutionId), eq(institutions.isDeleted, 0)));

  if (!institution) {
    throw new BadRequestError("Institution not found");
  }

  if (user.role !== "super_admin") {
    const userInstId =
      typeof user.institutionId === "object"
        ? (user.institutionId as any)._id?.toString()
        : user.institutionId?.toString();
    if (userInstId !== institutionId) {
      throw new ForbiddenError("Access denied to this institution");
    }
  }

  const prefix = institutionInitials(institution.name);

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

  const studentsWithPasswords = studentsWithCredentials.map((s) => {
    const rollNumber = s.rollNumber || s.username || "";
    return {
      ...s,
      plainPassword: reconstructPassword(rollNumber, prefix),
    };
  });

  return c.json({
    success: true,
    data: {
      institutionName: institution.name,
      students: studentsWithPasswords,
    },
  });
});

export { app as studentCredentialController };
