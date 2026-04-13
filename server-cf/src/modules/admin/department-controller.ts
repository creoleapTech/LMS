import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { departments, institutions } from "../../schema/admin";
import { nowISO } from "../../lib/utils";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// NOTE: The original Elysia controller does NOT use an auth macro/guard.
// It manually reads `headers.decoded` set by an upstream middleware.
// In the Hono version, we expect `c.get("user")` to be populated by
// whatever auth middleware is applied at the router level above this controller.

// ─── POST / — Create Department ────────────────────────
const createSchema = z.object({
  name: z.string().max(100),
  institutionId: z.string(),
});

app.post("/", zValidator("json", createSchema), async (c) => {
  const user = c.get("user") as Record<string, any>;

  if (!user) {
    throw new ForbiddenError("Invalid authentication token");
  }

  const body = c.req.valid("json");
  const db = getDb(c.env.DB);

  // Verify institution exists and is not deleted
  const instRows = await db
    .select()
    .from(institutions)
    .where(and(eq(institutions.id, body.institutionId), eq(institutions.isDeleted, 0)));

  if (instRows.length === 0) {
    throw new BadRequestError("Institution not found");
  }

  const institution = instRows[0];

  // Departments are only for colleges
  if (institution.type !== "college") {
    throw new BadRequestError("Departments are only for colleges");
  }

  // Access check: non-super_admin must belong to this institution
  if (
    user.role !== "super_admin" &&
    institution.id !== user.institutionId
  ) {
    throw new ForbiddenError("Access denied");
  }

  const id = uuid();
  const now = nowISO();

  const [dept] = await db
    .insert(departments)
    .values({
      id,
      name: body.name,
      institutionId: body.institutionId,
      isActive: 1,
      isDeleted: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json({ success: true, data: dept }, 201);
});

// ─── GET / — List Departments ──────────────────────────
app.get("/", async (c) => {
  const user = c.get("user") as Record<string, any>;

  if (!user) {
    throw new ForbiddenError("Invalid authentication token");
  }

  if (user.role !== "super_admin") {
    throw new ForbiddenError("Only super_admin can list all departments");
  }

  const institutionId = c.req.query("institutionId");
  const db = getDb(c.env.DB);

  // Build conditions
  const conditions: any[] = [eq(departments.isDeleted, 0)];
  if (institutionId) {
    conditions.push(eq(departments.institutionId, institutionId));
  }

  // Query departments and join institution for name + type
  const rows = await db
    .select({
      id: departments.id,
      name: departments.name,
      institutionId: departments.institutionId,
      institutionName: institutions.name,
      institutionType: institutions.type,
      isActive: departments.isActive,
      isDeleted: departments.isDeleted,
      createdAt: departments.createdAt,
      updatedAt: departments.updatedAt,
    })
    .from(departments)
    .leftJoin(institutions, eq(departments.institutionId, institutions.id))
    .where(and(...conditions))
    .orderBy(asc(departments.name));

  // Reshape to match original populate("institutionId", "name type") shape
  const data = rows.map((r) => ({
    id: r.id,
    name: r.name,
    institutionId: r.institutionId
      ? {
          _id: r.institutionId,
          name: r.institutionName,
          type: r.institutionType,
        }
      : null,
    isActive: r.isActive,
    isDeleted: r.isDeleted,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return c.json({ success: true, data }, 200);
});

// ─── GET /:id — Get Department by ID ───────────────────
app.get("/:id", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const id = c.req.param("id");

  if (!user) {
    throw new ForbiddenError("Invalid authentication token");
  }

  const db = getDb(c.env.DB);

  const rows = await db
    .select({
      id: departments.id,
      name: departments.name,
      institutionId: departments.institutionId,
      institutionName: institutions.name,
      institutionType: institutions.type,
      isActive: departments.isActive,
      isDeleted: departments.isDeleted,
      createdAt: departments.createdAt,
      updatedAt: departments.updatedAt,
    })
    .from(departments)
    .leftJoin(institutions, eq(departments.institutionId, institutions.id))
    .where(and(eq(departments.id, id), eq(departments.isDeleted, 0)));

  if (rows.length === 0) {
    throw new BadRequestError("Department not found");
  }

  const r = rows[0];

  // Access check
  if (
    user.role !== "super_admin" &&
    r.institutionId !== user.institutionId
  ) {
    throw new ForbiddenError("Access denied");
  }

  const data = {
    id: r.id,
    name: r.name,
    institutionId: r.institutionId
      ? { _id: r.institutionId, name: r.institutionName, type: r.institutionType }
      : null,
    isActive: r.isActive,
    isDeleted: r.isDeleted,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };

  return c.json({ success: true, data }, 200);
});

// ─── PATCH /:id — Update Department ────────────────────
const updateSchema = z.object({
  name: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
});

app.patch("/:id", zValidator("json", updateSchema), async (c) => {
  const user = c.get("user") as Record<string, any>;
  const id = c.req.param("id");

  if (!user) {
    throw new ForbiddenError("Invalid authentication token");
  }

  const body = c.req.valid("json");
  const db = getDb(c.env.DB);

  // Verify the department exists
  const existing = await db
    .select()
    .from(departments)
    .where(and(eq(departments.id, id), eq(departments.isDeleted, 0)));

  if (existing.length === 0) {
    throw new BadRequestError("Department not found");
  }

  const dept = existing[0];

  // Access check
  if (
    user.role !== "super_admin" &&
    dept.institutionId !== user.institutionId
  ) {
    throw new ForbiddenError("Access denied");
  }

  const updateData: Record<string, any> = { updatedAt: nowISO() };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.isActive !== undefined) updateData.isActive = body.isActive ? 1 : 0;

  const [updated] = await db
    .update(departments)
    .set(updateData)
    .where(eq(departments.id, id))
    .returning();

  return c.json({ success: true, data: updated }, 200);
});

// ─── DELETE /:id — Soft Delete Department ──────────────
app.delete("/:id", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const id = c.req.param("id");

  if (!user) {
    throw new ForbiddenError("Invalid authentication token");
  }

  const db = getDb(c.env.DB);

  // Verify the department exists
  const existing = await db
    .select()
    .from(departments)
    .where(and(eq(departments.id, id), eq(departments.isDeleted, 0)));

  if (existing.length === 0) {
    throw new BadRequestError("Department not found");
  }

  const dept = existing[0];

  // Access check
  if (
    user.role !== "super_admin" &&
    dept.institutionId !== user.institutionId
  ) {
    throw new ForbiddenError("Access denied");
  }

  await db
    .update(departments)
    .set({ isDeleted: 1, isActive: 0, updatedAt: nowISO() })
    .where(eq(departments.id, id));

  return c.json({ success: true, message: "Department deleted successfully" }, 200);
});

export { app as departmentController };
