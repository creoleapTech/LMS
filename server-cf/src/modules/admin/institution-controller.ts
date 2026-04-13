import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, like, or, count, gte, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { institutions, students, staff, classes } from "../../schema/admin";
import { saveFile } from "../../lib/file";
import { nowISO } from "../../lib/utils";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";
import { superAdminAuth } from "../../middleware/super-admin-auth";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// All routes require super-admin auth (equivalent of .use(superAdminAuthMacro).guard({ isAuth: true }))
app.use("*", superAdminAuth);

// ─── POST / — Create Institution (Super Admin Only) ───
app.post("/", async (c) => {
  const user = c.get("user") as Record<string, any>;

  if (user.role !== "super_admin") {
    throw new ForbiddenError("Only super_admin can create institutions");
  }

  const formData = await c.req.formData();

  const name = formData.get("name") as string;
  const type = formData.get("type") as string;
  const address = formData.get("address") as string;
  const contactDetailsRaw = formData.get("contactDetails");
  const logoFile = formData.get("logo") as File | null;

  if (!name || !type) {
    throw new BadRequestError("name and type are required");
  }

  // Parse contact details (may arrive as JSON string or already-parsed)
  let contactDetails: any = {};
  if (contactDetailsRaw) {
    contactDetails =
      typeof contactDetailsRaw === "string"
        ? JSON.parse(contactDetailsRaw)
        : contactDetailsRaw;
  }

  // Handle logo upload
  let logoKey: string | null = null;
  if (logoFile && logoFile instanceof File) {
    const result = await saveFile(c.env.BUCKET, logoFile, "institutions");
    if (result.ok) {
      logoKey = result.key;
    }
  }

  const db = getDb(c.env.DB);
  const id = uuid();
  const now = nowISO();

  const [institution] = await db
    .insert(institutions)
    .values({
      id,
      name,
      type: type as "school" | "college",
      address: address ?? null,
      contactInchargePerson: contactDetails.inchargePerson ?? null,
      contactMobile: contactDetails.mobileNumber ?? null,
      contactEmail: contactDetails.email ?? null,
      contactOfficePhone: contactDetails.officePhone ?? null,
      logo: logoKey,
      isActive: 1,
      isDeleted: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json({ success: true, data: institution }, 201);
});

// ─── GET / — List Institutions ─────────────────────────
app.get("/", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const search = c.req.query("search");
  const typeFilter = c.req.query("type");

  const db = getDb(c.env.DB);

  // Build conditions
  const conditions: any[] = [eq(institutions.isDeleted, 0)];

  // Non-super_admin can only see their own institution
  if (user.role !== "super_admin" && user.institutionId) {
    conditions.push(eq(institutions.id, user.institutionId));
  }

  // Type filter
  if (typeFilter && ["school", "college"].includes(typeFilter)) {
    conditions.push(eq(institutions.type, typeFilter as "school" | "college"));
  }

  // Search filter (LIKE on name and contact fields)
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        like(institutions.name, pattern),
        like(institutions.contactInchargePerson, pattern),
        like(institutions.contactMobile, pattern),
        like(institutions.contactEmail, pattern),
      )!,
    );
  }

  const rows = await db
    .select({
      id: institutions.id,
      name: institutions.name,
      type: institutions.type,
      address: institutions.address,
      contactInchargePerson: institutions.contactInchargePerson,
      contactMobile: institutions.contactMobile,
      contactEmail: institutions.contactEmail,
      contactOfficePhone: institutions.contactOfficePhone,
      logo: institutions.logo,
      isActive: institutions.isActive,
      isDeleted: institutions.isDeleted,
      createdAt: institutions.createdAt,
      updatedAt: institutions.updatedAt,
    })
    .from(institutions)
    .where(and(...conditions))
    .orderBy(sql`${institutions.createdAt} DESC`);

  return c.json({ success: true, data: rows }, 200);
});

// ─── GET /:id — Get Institution by ID ──────────────────
app.get("/:id", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const id = c.req.param("id");

  if (user.role !== "super_admin") {
    throw new ForbiddenError("Only super_admin can create institutions");
  }

  const db = getDb(c.env.DB);

  const rows = await db
    .select()
    .from(institutions)
    .where(and(eq(institutions.id, id), eq(institutions.isDeleted, 0)));

  if (rows.length === 0) {
    throw new BadRequestError("Institution not found");
  }

  const institution = rows[0];

  // Access check for non-super_admin
  if (
    user.role !== "super_admin" &&
    institution.id !== user.institutionId
  ) {
    throw new ForbiddenError("Access denied");
  }

  return c.json({ success: true, data: institution }, 200);
});

// ─── GET /:id/stats — Institution Stats ────────────────
app.get("/:id/stats", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const id = c.req.param("id");

  // Access check
  if (user.role !== "super_admin" && id !== user.institutionId) {
    throw new ForbiddenError("Access denied");
  }

  const db = getDb(c.env.DB);

  // Total counts
  const [studentCountResult] = await db
    .select({ count: count() })
    .from(students)
    .where(and(eq(students.institutionId, id), eq(students.isDeleted, 0)));

  const [staffCountResult] = await db
    .select({ count: count() })
    .from(staff)
    .where(and(eq(staff.institutionId, id), eq(staff.isDeleted, 0)));

  const [classCountResult] = await db
    .select({ count: count() })
    .from(classes)
    .where(and(eq(classes.institutionId, id), eq(classes.isDeleted, 0)));

  // Active counts
  const [activeStudentResult] = await db
    .select({ count: count() })
    .from(students)
    .where(
      and(
        eq(students.institutionId, id),
        eq(students.isActive, 1),
        eq(students.isDeleted, 0),
      ),
    );

  const [activeStaffResult] = await db
    .select({ count: count() })
    .from(staff)
    .where(
      and(
        eq(staff.institutionId, id),
        eq(staff.isActive, 1),
        eq(staff.isDeleted, 0),
      ),
    );

  // This month's new additions
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [newStudentsResult] = await db
    .select({ count: count() })
    .from(students)
    .where(
      and(
        eq(students.institutionId, id),
        eq(students.isDeleted, 0),
        gte(students.createdAt, startOfMonth),
      ),
    );

  const [newStaffResult] = await db
    .select({ count: count() })
    .from(staff)
    .where(
      and(
        eq(staff.institutionId, id),
        eq(staff.isDeleted, 0),
        gte(staff.createdAt, startOfMonth),
      ),
    );

  const [newClassesResult] = await db
    .select({ count: count() })
    .from(classes)
    .where(
      and(
        eq(classes.institutionId, id),
        eq(classes.isDeleted, 0),
        gte(classes.createdAt, startOfMonth),
      ),
    );

  const studentCount = studentCountResult.count;
  const staffCount = staffCountResult.count;
  const classCount = classCountResult.count;
  const activeStudentCount = activeStudentResult.count;
  const activeStaffCount = activeStaffResult.count;
  const newStudentsThisMonth = newStudentsResult.count;
  const newStaffThisMonth = newStaffResult.count;
  const newClassesThisMonth = newClassesResult.count;

  return c.json(
    {
      success: true,
      data: {
        totalStudents: studentCount,
        activeStudents: activeStudentCount,
        totalStaff: staffCount,
        activeStaff: activeStaffCount,
        totalClasses: classCount,
        studentTrend:
          newStudentsThisMonth > 0
            ? `+${newStudentsThisMonth} this month`
            : "No new this month",
        staffTrend:
          newStaffThisMonth > 0
            ? `+${newStaffThisMonth} new joined`
            : "No new this month",
        classTrend:
          newClassesThisMonth > 0
            ? `+${newClassesThisMonth} this month`
            : `${classCount} total`,
      },
    },
    200,
  );
});

// ─── PATCH /:id — Update Institution (Super Admin Only) ─
app.patch("/:id", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const id = c.req.param("id");

  if (user.role !== "super_admin") {
    throw new ForbiddenError("Only super_admin can update institutions");
  }

  const formData = await c.req.formData();

  const updateData: Record<string, any> = { updatedAt: nowISO() };

  const name = formData.get("name") as string | null;
  const type = formData.get("type") as string | null;
  const address = formData.get("address") as string | null;
  const contactDetailsRaw = formData.get("contactDetails");
  const isActiveRaw = formData.get("isActive");
  const logoFile = formData.get("logo") as File | null;

  if (name !== null) updateData.name = name;
  if (type !== null) updateData.type = type;
  if (address !== null) updateData.address = address;
  if (isActiveRaw !== null) {
    updateData.isActive = isActiveRaw === "true" || isActiveRaw === "1" ? 1 : 0;
  }

  // Parse contact details
  if (contactDetailsRaw) {
    const contactDetails =
      typeof contactDetailsRaw === "string"
        ? JSON.parse(contactDetailsRaw)
        : contactDetailsRaw;

    if (contactDetails.inchargePerson !== undefined)
      updateData.contactInchargePerson = contactDetails.inchargePerson;
    if (contactDetails.mobileNumber !== undefined)
      updateData.contactMobile = contactDetails.mobileNumber;
    if (contactDetails.email !== undefined)
      updateData.contactEmail = contactDetails.email;
    if (contactDetails.officePhone !== undefined)
      updateData.contactOfficePhone = contactDetails.officePhone;
  }

  // Handle logo upload
  if (logoFile && logoFile instanceof File) {
    const result = await saveFile(c.env.BUCKET, logoFile, "institutions");
    if (result.ok) {
      updateData.logo = result.key;
    }
  }

  const db = getDb(c.env.DB);

  const updated = await db
    .update(institutions)
    .set(updateData)
    .where(and(eq(institutions.id, id), eq(institutions.isDeleted, 0)))
    .returning();

  if (updated.length === 0) {
    throw new BadRequestError("Institution not found");
  }

  return c.json({ success: true, data: updated[0] }, 200);
});

// ─── DELETE /:id — Soft Delete Institution ─────────────
app.delete("/:id", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const id = c.req.param("id");

  if (user.role !== "super_admin") {
    throw new ForbiddenError("Only super_admin can delete institutions");
  }

  const db = getDb(c.env.DB);

  const updated = await db
    .update(institutions)
    .set({ isDeleted: 1, isActive: 0, updatedAt: nowISO() })
    .where(eq(institutions.id, id))
    .returning();

  if (updated.length === 0) {
    throw new BadRequestError("Institution not found");
  }

  return c.json({ success: true, message: "Institution deleted successfully" }, 200);
});

// ─── PATCH /:id/toggle-active — Toggle Active/Inactive ─
app.patch("/:id/toggle-active", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const id = c.req.param("id");

  if (user.role !== "super_admin") {
    throw new ForbiddenError("Only super_admin can toggle status");
  }

  const db = getDb(c.env.DB);

  // First fetch the current state
  const rows = await db
    .select()
    .from(institutions)
    .where(and(eq(institutions.id, id), eq(institutions.isDeleted, 0)));

  if (rows.length === 0) {
    throw new BadRequestError("Institution not found");
  }

  const institution = rows[0];
  const newActive = institution.isActive === 1 ? 0 : 1;

  const [toggled] = await db
    .update(institutions)
    .set({ isActive: newActive, updatedAt: nowISO() })
    .where(eq(institutions.id, id))
    .returning();

  return c.json({ success: true, data: toggled }, 200);
});

export { app as institutionController };
