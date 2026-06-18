import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { institutions } from "../../schema/admin";
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

  const db = getDb(c.env.DB);

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

  if (!row) {
    throw new UnauthorizedError("Invalid username or password");
  }

  const isValid = await verifyPassword(password, row.credential.password);

  if (!isValid) {
    throw new UnauthorizedError("Invalid username or password");
  }

  const token = await encodeToken(
    {
      userId: String(row.credential.id),
      username: row.credential.username,
      institutionId: String(row.credential.institutionId),
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
      },
    },
    200,
  );
});

export { app as leaplabAuthController };
