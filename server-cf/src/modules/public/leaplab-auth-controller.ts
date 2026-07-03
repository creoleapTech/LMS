import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { institutions, staff, students } from "../../schema/admin";
import { leaplabCredentials } from "../../schema/leaplab";
import { verifyPassword } from "../../lib/password";
import { encodeToken } from "../../lib/auth";
import { UnauthorizedError } from "../../lib/errors/unauthorized";

const app = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

const verifySchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// POST /verify
app.post("/verify", zValidator("json", verifySchema), async (c) => {
  const { username, password } = c.req.valid("json");

  console.log(`[leaplab-auth] verify attempt for username: "${username.trim()}"`);

  const db = getDb(c.env.DB);

  // 1. Try LeapLab credentials first
  const rows = await db
    .select({
      credential: {
        id: leaplabCredentials.id,
        username: leaplabCredentials.username,
        password: leaplabCredentials.password,
        institutionId: leaplabCredentials.institutionId,
      },
      institutionName: institutions.name,
    })
    .from(leaplabCredentials)
    .innerJoin(institutions, eq(leaplabCredentials.institutionId, institutions.id))
    .where(
      and(
        eq(leaplabCredentials.username, username.trim()),
        eq(leaplabCredentials.isDeleted, 0),
        eq(leaplabCredentials.isActive, 1),
      ),
    )
    .limit(1);

  const row = rows[0];

  if (row) {
    console.log(`[leaplab-auth] credential found for username: "${row.credential.username}", institution: "${row.institutionName}"`);
    const isValid = await verifyPassword(password, row.credential.password);

    if (!isValid) {
      console.log(`[leaplab-auth] password mismatch for username: "${username.trim()}"`);
      throw new UnauthorizedError("Invalid username or password");
    }

    const token = await encodeToken(
      {
        userId: String(row.credential.id),
        username: row.credential.username,
        institutionId: String(row.credential.institutionId),
        role: "student",
      },
      "teacher",
      c.env,
    );

    if (!token) {
      throw new Error("Failed to generate authentication token");
    }

    c.header("Authorization", `Bearer ${token}`);

    return c.json(
      {
        success: true,
        data: {
          id: row.credential.id,
          username: row.credential.username,
          institutionId: row.credential.institutionId,
          institutionName: row.institutionName,
          token,
          role: "student",
        },
      },
      200,
    );
  }

  console.log(`[leaplab-auth] no credential found for username: "${username.trim()}", trying staff...`);

  // 2. If not found in LeapLab credentials, try staff (trainers)
  const staffRows = await db
    .select({
      staff: {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        password: staff.password,
        institutionId: staff.institutionId,
      },
      institutionName: institutions.name,
    })
    .from(staff)
    .innerJoin(institutions, eq(staff.institutionId, institutions.id))
    .where(
      and(
        eq(staff.email, username.trim().toLowerCase()),
        eq(staff.isDeleted, 0),
        eq(staff.isActive, 1),
      ),
    )
    .limit(1);

  const staffRow = staffRows[0];

  if (staffRow) {
    const isStaffPasswordValid = await verifyPassword(password, staffRow.staff.password);

    if (!isStaffPasswordValid) {
      console.log(`[leaplab-auth] staff password mismatch for email: "${username.trim().toLowerCase()}"`);
      throw new UnauthorizedError("Invalid username or password");
    }

    console.log(`[leaplab-auth] staff login success for email: "${staffRow.staff.email}"`);

    const token = await encodeToken(
      {
        userId: String(staffRow.staff.id),
        username: staffRow.staff.email,
        institutionId: String(staffRow.staff.institutionId),
        role: "trainer",
      },
      "teacher",
      c.env,
    );

    if (!token) {
      throw new Error("Failed to generate authentication token");
    }

    c.header("Authorization", `Bearer ${token}`);

    return c.json(
      {
        success: true,
        data: {
          id: staffRow.staff.id,
          username: staffRow.staff.email,
          institutionId: staffRow.staff.institutionId,
          institutionName: staffRow.institutionName,
          token,
          role: "trainer",
        },
      },
      200,
    );
  }

  console.log(`[leaplab-auth] no staff found, trying students...`);

  // 3. If not found in staff, try students (rollNumber or username)
  const studentRows = await db
    .select({
      student: {
        id: students.id,
        username: students.username,
        rollNumber: students.rollNumber,
        password: students.password,
        institutionId: students.institutionId,
      },
      institutionName: institutions.name,
    })
    .from(students)
    .innerJoin(institutions, eq(students.institutionId, institutions.id))
    .where(
      and(
        eq(students.isDeleted, 0),
        eq(students.isActive, 1),
      ),
    );

  const studentMatch = studentRows.find(
    (s) =>
      (s.student.rollNumber && s.student.rollNumber.toLowerCase() === username.trim().toLowerCase()) ||
      (s.student.username && s.student.username.toLowerCase() === username.trim().toLowerCase()),
  );

  if (!studentMatch) {
    console.log(`[leaplab-auth] no student found for username: "${username.trim()}"`);
    throw new UnauthorizedError("Invalid username or password");
  }

  const isStudentPasswordValid = await verifyPassword(password, studentMatch.student.password || "");

  if (!isStudentPasswordValid) {
    console.log(`[leaplab-auth] student password mismatch for username: "${username.trim()}"`);
    throw new UnauthorizedError("Invalid username or password");
  }

  console.log(`[leaplab-auth] student login success for username: "${studentMatch.student.rollNumber || studentMatch.student.username}"`);

  const studentToken = await encodeToken(
    {
      userId: String(studentMatch.student.id),
      username: studentMatch.student.rollNumber || studentMatch.student.username || "",
      institutionId: String(studentMatch.student.institutionId),
      role: "student",
    },
    "teacher",
    c.env,
  );

  if (!studentToken) {
    throw new Error("Failed to generate authentication token");
  }

  c.header("Authorization", `Bearer ${studentToken}`);

  return c.json(
    {
      success: true,
      data: {
        id: studentMatch.student.id,
        username: studentMatch.student.rollNumber || studentMatch.student.username,
        institutionId: studentMatch.student.institutionId,
        institutionName: studentMatch.institutionName,
        token: studentToken,
        role: "student",
      },
    },
    200,
  );
});

export { app as leaplabAuthController };
