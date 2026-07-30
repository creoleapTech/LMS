import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { institutions, students } from "../../schema/admin";
import { leaplabCredentials } from "../../schema/leaplab";
import { v4 as uuid } from "uuid";
import { syncRollNumberCounter, generateRollNumbers } from "../../lib/roll-number";
import { hashPasswordBulk } from "../../lib/password";
import { nowISO } from "../../lib/utils";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";
import { adminAuth } from "../../middleware/admin-auth";

const app = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

app.use("*", adminAuth);

function sanitizeSuffix(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return cleaned || "institution";
}

function verifyInstitutionAccess(user: Record<string, any>, institutionId: string) {
  if (user.role !== "super_admin") {
    const userInstId =
      typeof user.institutionId === "object"
        ? (user.institutionId as any)._id?.toString()
        : user.institutionId?.toString();
    if (userInstId !== institutionId) {
      throw new ForbiddenError("Access denied to this institution");
    }
  }
}

// POST /:id/generate-student-credentials
// For each active student without credentials:
//   1. Generate a roll number if missing
//   2. Set LMS credentials: students.username = rollNumber, students.password = hashed
//   3. Create LeapLab credential: username = rollNumber@institutionSuffix, same password
//   4. Return the plain password to the teacher (cannot be recovered later)
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

  verifyInstitutionAccess(user, institutionId);

  const suffix = `@${sanitizeSuffix(institution.name)}`;

  // Get all active students in this institution
  const allStudents = await db
    .select({
      id: students.id,
      name: students.name,
      rollNumber: students.rollNumber,
      username: students.username,
    })
    .from(students)
    .where(
      and(
        eq(students.institutionId, institutionId),
        eq(students.isDeleted, 0),
        eq(students.isActive, 1),
      ),
    )
    .orderBy(students.name);

  if (allStudents.length === 0) {
    throw new BadRequestError("No active students found in this institution");
  }

  // Get existing leaplab credential usernames for this institution
  const existingCreds = await db
    .select({ username: leaplabCredentials.username })
    .from(leaplabCredentials)
    .where(
      and(
        eq(leaplabCredentials.institutionId, institutionId),
        eq(leaplabCredentials.isDeleted, 0),
      ),
    );

  const existingLeaplabSet = new Set(existingCreds.map((cr) => cr.username));

  // A student needs credentials if they have no LMS username OR no leaplab credential
  type StudentEntry = {
    id: string;
    name: string | null;
    rollNumber: string | null;
    needsRollNumber: boolean;
    needsLms: boolean;
    needsLeaplab: boolean;
  };
  const studentsNeedingWork: StudentEntry[] = [];

  for (const student of allStudents) {
    const isInvalidRoll = !student.rollNumber || /^\d+$/.test(student.rollNumber.trim());
    const needsRollNumber = isInvalidRoll;
    const effectiveRoll = isInvalidRoll ? null : student.rollNumber;
    
    const needsLms = !student.username;
    const leaplabUsername = effectiveRoll ? `${effectiveRoll}${suffix}` : null;
    const needsLeaplab = !leaplabUsername || !existingLeaplabSet.has(leaplabUsername);

    if (needsLms || needsLeaplab || needsRollNumber) {
      studentsNeedingWork.push({
        id: student.id,
        name: student.name,
        rollNumber: student.rollNumber,
        needsRollNumber,
        needsLms,
        needsLeaplab,
      });
    }
  }

  if (studentsNeedingWork.length === 0) {
    throw new BadRequestError("All active students already have credentials");
  }

  // Generate roll numbers for students that need them
  const needRollNumbers = studentsNeedingWork.filter((s) => s.needsRollNumber);
  if (needRollNumbers.length > 0) {
    await syncRollNumberCounter(db, institutionId);
    const rollNumbers = await generateRollNumbers(db, institutionId, needRollNumbers.length);
    for (let i = 0; i < needRollNumbers.length; i++) {
      needRollNumbers[i].rollNumber = rollNumbers[i];
    }
  }

  // Hash passwords sequentially to stay within CF Workers CPU limit
  const now = nowISO();
  const results: {
    id: string;
    name: string;
    rollNumber: string;
    leaplabUsername: string;
    plainPassword: string;
  }[] = [];

  const lmsUpdates: ReturnType<ReturnType<typeof getDb>["update"]>[] = [];
  const leaplabInserts: {
    id: string;
    institutionId: string;
    username: string;
    password: string;
    isActive: number;
    isDeleted: number;
    createdAt: string;
    updatedAt: string;
  }[] = [];

  for (const student of studentsNeedingWork) {
    const rollNumber = student.rollNumber!;
    const leaplabUsername = `${rollNumber}${suffix}`;
    const plainPassword = Array.from({ length: 3 }, () =>
      Math.random().toString(36).slice(2, 6),
    ).join("-");
    const hashedPassword = await hashPasswordBulk(plainPassword);

    // LMS credential: set username + password on the students row
    // Also update rollNumber if it was just generated
    const studentUpdate: Record<string, any> = { updatedAt: now };
    if (student.needsLms) {
      studentUpdate.username = rollNumber;
      studentUpdate.password = hashedPassword;
      studentUpdate.plainPassword = plainPassword;
    }
    if (student.needsRollNumber) {
      studentUpdate.rollNumber = rollNumber;
    }

    lmsUpdates.push(
      db
        .update(students)
        .set(studentUpdate)
        .where(eq(students.id, student.id)) as any,
    );

    // LeapLab credential
    if (student.needsLeaplab) {
      leaplabInserts.push({
        id: uuid(),
        institutionId,
        username: leaplabUsername,
        password: hashedPassword,
        isActive: 1,
        isDeleted: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    results.push({
      id: student.id,
      name: student.name ?? "Unknown",
      rollNumber,
      leaplabUsername,
      plainPassword,
    });
  }

  // Batch-update students table
  if (lmsUpdates.length === 1) {
    await lmsUpdates[0];
  } else if (lmsUpdates.length > 1) {
    await db.batch(lmsUpdates as any);
  }

  // Deduplicate within batch (in case of duplicate roll numbers)
  const seenUsernames = new Set<string>();
  const dedupedInserts = leaplabInserts.filter((row) => {
    if (seenUsernames.has(row.username)) return false;
    seenUsernames.add(row.username);
    return true;
  });

  // Insert leaplab credentials in chunks (D1 limit: 100 vars/query; 8 cols → max 12/batch)
  // onConflictDoNothing() handles any remaining edge cases (e.g. credentials created elsewhere)
  const CHUNK_SIZE = 10;
  for (let i = 0; i < dedupedInserts.length; i += CHUNK_SIZE) {
    const chunk = dedupedInserts.slice(i, i + CHUNK_SIZE);
    await db.insert(leaplabCredentials).values(chunk).onConflictDoNothing();
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

// GET /:id/student-credentials — list students with credentials for CSV export
app.get("/:id/student-credentials", async (c) => {
  const user = c.get("user") as Record<string, any>;

  if (user.role !== "super_admin" && user.role !== "teacher") {
    throw new ForbiddenError("Only super admin and teachers can view student credentials");
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

  verifyInstitutionAccess(user, institutionId);

  const suffix = `@${sanitizeSuffix(institution.name)}`;

  // Get all active students with roll numbers and LMS credentials
  const allStudents = await db
    .select({
      id: students.id,
      name: students.name,
      rollNumber: students.rollNumber,
      username: students.username,
      plainPassword: students.plainPassword,
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

  // Get existing leaplab credentials for this institution
  const existingCreds = await db
    .select({ username: leaplabCredentials.username })
    .from(leaplabCredentials)
    .where(
      and(
        eq(leaplabCredentials.institutionId, institutionId),
        eq(leaplabCredentials.isDeleted, 0),
      ),
    );

  const credUsernameSet = new Set(existingCreds.map((cr) => cr.username));

  const studentsWithCredentials = allStudents.map((s) => ({
    id: s.id,
    name: s.name,
    rollNumber: s.rollNumber,
    username: s.username,
    leaplabUsername: s.rollNumber ? `${s.rollNumber}${suffix}` : null,
    hasLeaplab: s.rollNumber ? credUsernameSet.has(`${s.rollNumber}${suffix}`) : false,
    plainPassword: s.plainPassword ?? "********",
  }));

  return c.json({
    success: true,
    data: {
      institutionName: institution.name,
      students: studentsWithCredentials,
    },
  });
});

export { app as studentCredentialController };
