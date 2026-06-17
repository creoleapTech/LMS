import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { institutions } from "../../schema/admin";
import { leaplabCredentials } from "../../schema/leaplab";
import { hashPassword } from "../../lib/password";
import { nowISO } from "../../lib/utils";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";
import { superAdminAuth } from "../../middleware/super-admin-auth";

const app = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

app.use("*", superAdminAuth);

const passwordChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";

function generatePassword(length = 10): string {
  let password = "";
  for (let i = 0; i < length; i++) {
    password += passwordChars.charAt(Math.floor(Math.random() * passwordChars.length));
  }
  return password;
}

function sanitizeSuffix(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return cleaned || "institution";
}

function institutionInitials(name: string): string {
  const words = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return "LL";

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }

  return words.map((w) => w.charAt(0).toUpperCase()).join("");
}

function buildFullUsername(base: string, suffix: string): string {
  const trimmedBase = base.trim();
  if (trimmedBase.includes("@")) {
    throw new BadRequestError("Username prefix should not include the @ suffix");
  }
  return `${trimmedBase}${suffix}`;
}

async function ensureInstitutionExists(db: ReturnType<typeof getDb>, institutionId: string) {
  const rows = await db
    .select({ id: institutions.id, name: institutions.name })
    .from(institutions)
    .where(and(eq(institutions.id, institutionId), eq(institutions.isDeleted, 0)));

  if (rows.length === 0) {
    throw new BadRequestError("Institution not found");
  }

  return rows[0];
}

// GET /:id/leaplab-credentials
app.get("/:id/leaplab-credentials", async (c) => {
  const user = c.get("user") as Record<string, any>;
  if (user.role !== "super_admin") {
    throw new ForbiddenError("Only super_admin can manage LeapLab credentials");
  }

  const institutionId = c.req.param("id");
  const db = getDb(c.env.DB);
  await ensureInstitutionExists(db, institutionId);

  const rows = await db
    .select({
      id: leaplabCredentials.id,
      username: leaplabCredentials.username,
      isActive: leaplabCredentials.isActive,
      createdAt: leaplabCredentials.createdAt,
      updatedAt: leaplabCredentials.updatedAt,
    })
    .from(leaplabCredentials)
    .where(and(eq(leaplabCredentials.institutionId, institutionId), eq(leaplabCredentials.isDeleted, 0)))
    .orderBy(leaplabCredentials.createdAt);

  return c.json({ success: true, data: rows }, 200);
});

const createSchema = z
  .object({
    credentials: z
      .array(
        z.object({
          baseUsername: z.string().min(1, "Username prefix is required").max(60, "Too long"),
          password: z.string().min(6, "Password must be at least 6 characters").max(60).optional(),
        }),
      )
      .optional(),
    autoGenerate: z.number().int().min(1).max(100).optional(),
    customPrefix: z.string().max(20).optional().or(z.literal("")),
  })
  .refine(
    (data) =>
      (data.credentials && data.credentials.length > 0) ||
      (data.autoGenerate !== undefined && data.autoGenerate > 0),
    { message: "Provide at least one credential or an auto-generate count" },
  );

// POST /:id/leaplab-credentials
app.post("/:id/leaplab-credentials", zValidator("json", createSchema), async (c) => {
  const user = c.get("user") as Record<string, any>;
  if (user.role !== "super_admin") {
    throw new ForbiddenError("Only super_admin can manage LeapLab credentials");
  }

  const institutionId = c.req.param("id");
  const db = getDb(c.env.DB);
  const institution = await ensureInstitutionExists(db, institutionId);

  const body = c.req.valid("json");
  const suffix = `@${sanitizeSuffix(institution.name)}`;

  type CredentialSeed = { id: string; baseUsername: string; fullUsername: string; plainPassword: string };
  const seeds: CredentialSeed[] = [];

  // Manual credentials
  if (body.credentials && body.credentials.length > 0) {
    for (const item of body.credentials) {
      const fullUsername = buildFullUsername(item.baseUsername, suffix);
      seeds.push({
        id: uuid(),
        baseUsername: item.baseUsername.trim(),
        fullUsername,
        plainPassword: item.password ?? generatePassword(),
      });
    }
  }

  // Auto-generated credentials
  if (body.autoGenerate && body.autoGenerate > 0) {
    const prefix =
      (body.customPrefix && body.customPrefix.trim()) || institutionInitials(institution.name);
    for (let i = 1; i <= body.autoGenerate; i++) {
      const baseUsername = `${prefix}${i}`;
      const fullUsername = `${baseUsername}${suffix}`;
      seeds.push({
        id: uuid(),
        baseUsername,
        fullUsername,
        plainPassword: generatePassword(),
      });
    }
  }

  // Duplicate detection within request
  const seenUsernames = new Set<string>();
  for (const seed of seeds) {
    if (seenUsernames.has(seed.fullUsername)) {
      throw new BadRequestError(`Duplicate username in request: ${seed.fullUsername}`);
    }
    seenUsernames.add(seed.fullUsername);
  }

  // Check for existing usernames in DB
  if (seeds.length > 0) {
    const existing = await db
      .select({ username: leaplabCredentials.username })
      .from(leaplabCredentials)
      .where(
        and(
          eq(leaplabCredentials.institutionId, institutionId),
          eq(leaplabCredentials.isDeleted, 0),
          inArray(
            leaplabCredentials.username,
            seeds.map((s) => s.fullUsername),
          ),
        ),
      );

    if (existing.length > 0) {
      throw new BadRequestError(
        `Some usernames already exist: ${existing.map((e) => e.username).join(", ")}`,
      );
    }
  }

  const now = nowISO();
  const insertRows = await Promise.all(
    seeds.map(async (seed) => ({
      id: seed.id,
      institutionId,
      username: seed.fullUsername,
      password: await hashPassword(seed.plainPassword),
      isActive: 1,
      isDeleted: 0,
      createdAt: now,
      updatedAt: now,
    })),
  );

  if (insertRows.length > 0) {
    await db.insert(leaplabCredentials).values(insertRows);
  }

  const responseData = seeds.map((seed) => ({
    id: seed.id,
    username: seed.fullUsername,
    plainPassword: seed.plainPassword,
  }));

  return c.json({ success: true, data: responseData }, 201);
});

// DELETE /:id/leaplab-credentials/:credentialId
app.delete("/:id/leaplab-credentials/:credentialId", async (c) => {
  const user = c.get("user") as Record<string, any>;
  if (user.role !== "super_admin") {
    throw new ForbiddenError("Only super_admin can manage LeapLab credentials");
  }

  const institutionId = c.req.param("id");
  const credentialId = c.req.param("credentialId");
  const db = getDb(c.env.DB);
  await ensureInstitutionExists(db, institutionId);

  const updated = await db
    .update(leaplabCredentials)
    .set({ isDeleted: 1, updatedAt: nowISO() })
    .where(
      and(
        eq(leaplabCredentials.id, credentialId),
        eq(leaplabCredentials.institutionId, institutionId),
        eq(leaplabCredentials.isDeleted, 0),
      ),
    )
    .returning({ id: leaplabCredentials.id });

  if (updated.length === 0) {
    throw new BadRequestError("Credential not found");
  }

  return c.json({ success: true, message: "Credential removed successfully" }, 200);
});

export { app as leaplabCredentialController };
