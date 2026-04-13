import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { nowISO } from "../../lib/utils";
import { academicYears } from "../../schema/settings";
import { academicYearTerms } from "../../schema/junction";
import { BadRequestError } from "../../lib/errors/bad-request";
import { adminAuth } from "../../middleware/admin-auth";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", adminAuth);

// ── Helper: resolve institution ID from user/query ──
function resolveInstitutionId(user: Record<string, any>, queryInstitutionId?: string): string {
  if (queryInstitutionId) return queryInstitutionId;
  if (user.role !== "super_admin" && user.institutionId) {
    return typeof user.institutionId === "object"
      ? (user.institutionId as any)._id?.toString()
      : user.institutionId.toString();
  }
  throw new BadRequestError("Institution ID is required");
}

// ── Helper: fetch terms for an academic year ──
async function fetchTerms(db: ReturnType<typeof getDb>, academicYearId: string) {
  return db
    .select({
      id: academicYearTerms.id,
      label: academicYearTerms.label,
      startDate: academicYearTerms.startDate,
      endDate: academicYearTerms.endDate,
    })
    .from(academicYearTerms)
    .where(eq(academicYearTerms.academicYearId, academicYearId));
}

// ── Helper: insert terms for an academic year ──
async function insertTerms(
  db: ReturnType<typeof getDb>,
  academicYearId: string,
  terms: { label: string; startDate: string; endDate: string }[],
) {
  for (const term of terms) {
    await db.insert(academicYearTerms).values({
      id: uuid(),
      academicYearId,
      label: term.label,
      startDate: term.startDate,
      endDate: term.endDate,
    });
  }
}

// ── Helper: attach terms to year rows ──
async function attachTerms(db: ReturnType<typeof getDb>, rows: any[]) {
  const result = [];
  for (const row of rows) {
    const terms = await fetchTerms(db, row.id);
    result.push({ ...row, terms });
  }
  return result;
}

// ─── GET / — List all academic years for institution ─────
app.get("/", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const institutionId = resolveInstitutionId(user, c.req.query("institutionId"));
  const db = getDb(c.env.DB);

  const rows = await db
    .select()
    .from(academicYears)
    .where(
      and(
        eq(academicYears.institutionId, institutionId),
        eq(academicYears.isDeleted, 0),
      ),
    )
    .orderBy(desc(academicYears.startDate));

  const data = await attachTerms(db, rows);

  return c.json({ success: true, data });
});

// ─── GET /active — Get the active academic year ──────────
app.get("/active", async (c) => {
  const user = c.get("user") as Record<string, any>;
  let institutionId: string;
  try {
    institutionId = resolveInstitutionId(user, c.req.query("institutionId"));
  } catch {
    return c.json({ success: true, data: null });
  }

  const db = getDb(c.env.DB);

  const [row] = await db
    .select()
    .from(academicYears)
    .where(
      and(
        eq(academicYears.institutionId, institutionId),
        eq(academicYears.isActive, 1),
        eq(academicYears.isDeleted, 0),
      ),
    );

  if (!row) {
    return c.json({ success: true, data: null });
  }

  const terms = await fetchTerms(db, row.id);
  return c.json({ success: true, data: { ...row, terms } });
});

// ─── POST / — Create academic year ──────────────────────
app.post("/", async (c) => {
  const user = c.get("user") as Record<string, any>;

  if (user.role !== "super_admin" && user.role !== "admin") {
    throw new BadRequestError("Only admin or super_admin can create academic years");
  }

  const body = await c.req.json<{
    institutionId: string;
    label: string;
    startDate: string;
    endDate: string;
    isActive?: boolean;
    terms?: { label: string; startDate: string; endDate: string }[];
  }>();

  const { institutionId, label, startDate, endDate } = body;
  const isActive = body.isActive ?? false;
  const terms = body.terms || [];

  if (!institutionId || !label || !startDate || !endDate) {
    throw new BadRequestError("institutionId, label, startDate, and endDate are required");
  }

  const db = getDb(c.env.DB);

  // Check for duplicate label
  const [existing] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(
      and(
        eq(academicYears.institutionId, institutionId),
        eq(academicYears.label, label),
        eq(academicYears.isDeleted, 0),
      ),
    );

  if (existing) {
    throw new BadRequestError(`Academic year "${label}" already exists`);
  }

  // If active, deactivate all others
  if (isActive) {
    await db
      .update(academicYears)
      .set({ isActive: 0 })
      .where(
        and(
          eq(academicYears.institutionId, institutionId),
          eq(academicYears.isDeleted, 0),
        ),
      );
  }

  const id = uuid();
  const now = nowISO();

  const [created] = await db
    .insert(academicYears)
    .values({
      id,
      institutionId,
      label,
      startDate,
      endDate,
      isActive: isActive ? 1 : 0,
      isDeleted: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Insert terms into junction table
  await insertTerms(db, id, terms);

  const resultTerms = await fetchTerms(db, id);

  return c.json({ success: true, data: { ...created, terms: resultTerms } }, 201);
});

// ─── PATCH /:id/activate — Activate an academic year ─────
app.patch("/:id/activate", async (c) => {
  const id = c.req.param("id");
  const db = getDb(c.env.DB);

  const [year] = await db
    .select()
    .from(academicYears)
    .where(and(eq(academicYears.id, id), eq(academicYears.isDeleted, 0)));

  if (!year) {
    throw new BadRequestError("Academic year not found");
  }

  // Deactivate all for this institution
  await db
    .update(academicYears)
    .set({ isActive: 0 })
    .where(
      and(
        eq(academicYears.institutionId, year.institutionId),
        eq(academicYears.isDeleted, 0),
      ),
    );

  // Activate this one
  const [updated] = await db
    .update(academicYears)
    .set({ isActive: 1, updatedAt: nowISO() })
    .where(eq(academicYears.id, id))
    .returning();

  const terms = await fetchTerms(db, id);

  return c.json({ success: true, data: { ...updated, terms } });
});

// ─── PATCH /:id — Update academic year ───────────────────
app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    label?: string;
    startDate?: string;
    endDate?: string;
    terms?: { label: string; startDate: string; endDate: string }[];
  }>();

  const db = getDb(c.env.DB);

  const [year] = await db
    .select()
    .from(academicYears)
    .where(and(eq(academicYears.id, id), eq(academicYears.isDeleted, 0)));

  if (!year) {
    throw new BadRequestError("Academic year not found");
  }

  const updateData: Record<string, any> = { updatedAt: nowISO() };
  if (body.label !== undefined) updateData.label = body.label;
  if (body.startDate !== undefined) updateData.startDate = body.startDate;
  if (body.endDate !== undefined) updateData.endDate = body.endDate;

  const [updated] = await db
    .update(academicYears)
    .set(updateData)
    .where(eq(academicYears.id, id))
    .returning();

  // If terms provided, replace them
  if (body.terms) {
    // Delete old terms
    await db
      .delete(academicYearTerms)
      .where(eq(academicYearTerms.academicYearId, id));
    // Insert new terms
    await insertTerms(db, id, body.terms);
  }

  const terms = await fetchTerms(db, id);

  return c.json({ success: true, data: { ...updated, terms } });
});

// ─── DELETE /:id — Soft delete academic year ─────────────
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDb(c.env.DB);

  const [year] = await db
    .select()
    .from(academicYears)
    .where(and(eq(academicYears.id, id), eq(academicYears.isDeleted, 0)));

  if (!year) {
    throw new BadRequestError("Academic year not found");
  }

  await db
    .update(academicYears)
    .set({ isDeleted: 1, isActive: 0, updatedAt: nowISO() })
    .where(eq(academicYears.id, id));

  return c.json({ success: true, message: "Academic year deleted" });
});

export { app as academicYearController };
