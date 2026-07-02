import { Hono } from "hono";
import { eq, and, sql, desc } from "drizzle-orm";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { institutions, students } from "../../schema/admin";
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

const PASSWORD_WORDS = [
  "Learn", "Study", "Read", "Play", "Draw",
  "Think", "Create", "Build", "Explore", "Solve",
  "Code", "Math", "Art", "Book", "Star",
  "Hero", "Dream", "Hope", "Grow", "Shine",
];

function institutionInitials(name: string): string {
  const words = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return "INS";

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }

  const initials = words.map((w) => w.charAt(0).toUpperCase()).join("");
  return initials.slice(0, 3).toUpperCase();
}

function padSequence(n: number, minLength = 3): string {
  return String(n).padStart(minLength, "0");
}

function pickWord(index: number): string {
  return PASSWORD_WORDS[index % PASSWORD_WORDS.length];
}

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
  const yearSuffix = String(new Date().getFullYear()).slice(-2);

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

  // Determine starting sequence from existing roll numbers
  const [maxRoll] = await db
    .select({ rollNumber: students.rollNumber })
    .from(students)
    .where(
      and(
        eq(students.institutionId, institutionId),
        eq(students.isDeleted, 0),
        sql`${students.rollNumber} IS NOT NULL`,
        sql`${students.rollNumber} LIKE ${prefix + yearSuffix + "%"}`,
      ),
    )
    .orderBy(desc(students.rollNumber))
    .limit(1);

  let sequence = 1;
  if (maxRoll?.rollNumber) {
    const numPart = maxRoll.rollNumber.replace(prefix + yearSuffix, "");
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed)) {
      sequence = parsed + 1;
    }
  }

  const now = nowISO();
  const results: { id: string; name: string; rollNumber: string; plainPassword: string }[] = [];

  for (let i = 0; i < studentsWithoutCredentials.length; i++) {
    const student = studentsWithoutCredentials[i];
    const rollNumber = `${prefix}${yearSuffix}${padSequence(sequence + i)}`;
    const plainPassword = `${pickWord(i)}@${padSequence(sequence + i)}`;
    const hashedPassword = await hashPassword(plainPassword);

    await db
      .update(students)
      .set({
        rollNumber,
        username: rollNumber,
        password: hashedPassword,
        updatedAt: now,
      })
      .where(eq(students.id, student.id));

    results.push({
      id: student.id,
      name: student.name ?? "Unknown",
      rollNumber,
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

  return c.json({
    success: true,
    data: {
      institutionName: institution.name,
      students: studentsWithCredentials,
    },
  });
});

export { app as studentCredentialController };
