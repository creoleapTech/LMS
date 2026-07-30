import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { institutions, students } from "../../schema/admin";
import { leaplabCredentials } from "../../schema/leaplab";
import { v4 as uuid } from "uuid";
import { syncRollNumberCounter, generateRollNumbers } from "../../lib/roll-number";
import { hashPasswordBulk } from "../../lib/password";
import { generateStudentPassword } from "../../lib/generate-password";
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
// For each active student in the institution:
//   1. Generate a roll number if missing
//   2. Set LMS credentials: students.username = rollNumber, students.password = hashed, students.plainPassword = plain
//   3. Create/update LeapLab credential: username = rollNumber@institutionSuffix, same password
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
      plainPassword: students.plainPassword,
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

  // Get existing leaplab credentials for this institution
  const existingCreds = await db
    .select({ id: leaplabCredentials.id, username: leaplabCredentials.username })
    .from(leaplabCredentials)
    .where(
      and(
        eq(leaplabCredentials.institutionId, institutionId),
        eq(leaplabCredentials.isDeleted, 0),
      ),
    );

  const existingLeaplabMap = new Map<string, string>(); // username -> id
  for (const cr of existingCreds) {
    existingLeaplabMap.set(cr.username, cr.id);
  }

  type StudentEntry = {
    id: string;
    name: string | null;
    rollNumber: string | null;
    needsRollNumber: boolean;
  };
  const studentsNeedingWork: StudentEntry[] = [];

  for (const student of allStudents) {
    const isInvalidRoll = !student.rollNumber || /^\d+$/.test(student.rollNumber.trim());
    studentsNeedingWork.push({
      id: student.id,
      name: student.name,
      rollNumber: student.rollNumber,
      needsRollNumber: isInvalidRoll,
    });
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
  const leaplabUpdates: ReturnType<ReturnType<typeof getDb>["update"]>[] = [];
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

  // Get existing usernames to avoid unique constraint collisions
  const existingUsernames = await db
    .select({ username: students.username })
    .from(students)
    .where(sql`${students.username} IS NOT NULL`);
  const takenUsernames = new Set(existingUsernames.map((u) => u.username!));

  for (const student of studentsNeedingWork) {
    const origStudent = allStudents.find((s) => s.id === student.id);
    const rollNumber = student.rollNumber!;
    const leaplabUsername = `${rollNumber}${suffix}`;

    // Always generate a fresh password for every student
    const plainPassword = generateStudentPassword();
    const hashedPassword = await hashPasswordBulk(plainPassword);

    // LMS credential: set password + plainPassword on the students row
    // Only set username if it is not already set to rollNumber
    const studentUpdate: Record<string, any> = {
      password: hashedPassword,
      plainPassword,
      updatedAt: now,
    };
    if (origStudent?.username !== rollNumber) {
      let targetUsername = rollNumber;
      if (takenUsernames.has(targetUsername)) {
        targetUsername = `${rollNumber}_${student.id.slice(0, 4)}`;
      }
      studentUpdate.username = targetUsername;
      takenUsernames.add(targetUsername);
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

    // LeapLab credential: update if exists, insert if new
    const existingLeaplabId = existingLeaplabMap.get(leaplabUsername);
    if (existingLeaplabId) {
      leaplabUpdates.push(
        db
          .update(leaplabCredentials)
          .set({ password: hashedPassword, updatedAt: now })
          .where(eq(leaplabCredentials.id, existingLeaplabId)) as any,
      );
    } else {
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

  // Batch-update students table in chunks
  const BATCH_SIZE = 50;
  for (let i = 0; i < lmsUpdates.length; i += BATCH_SIZE) {
    const chunk = lmsUpdates.slice(i, i + BATCH_SIZE);
    if (chunk.length === 1) {
      await chunk[0];
    } else {
      await db.batch(chunk as any);
    }
  }

  // Batch-update existing leaplab credentials in chunks
  for (let i = 0; i < leaplabUpdates.length; i += BATCH_SIZE) {
    const chunk = leaplabUpdates.slice(i, i + BATCH_SIZE);
    if (chunk.length === 1) {
      await chunk[0];
    } else {
      await db.batch(chunk as any);
    }
  }

  // Deduplicate new inserts
  const seenUsernames = new Set<string>();
  const dedupedInserts = leaplabInserts.filter((row) => {
    if (seenUsernames.has(row.username)) return false;
    seenUsernames.add(row.username);
    return true;
  });

  // Insert new leaplab credentials in chunks
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
