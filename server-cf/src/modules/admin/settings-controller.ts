import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { nowISO } from "../../lib/utils";
import { admins, institutions, staff } from "../../schema/admin";
import { institutionSettings, userPreferences } from "../../schema/settings";
import { gradingScaleEntries } from "../../schema/junction";
import { hashPassword, verifyPassword } from "../../lib/password";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";
import { adminAuth } from "../../middleware/admin-auth";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", adminAuth);

// ── Helper: find user doc by token payload ──
async function findUserByToken(db: ReturnType<typeof getDb>, user: Record<string, any>) {
  // Try admins first
  const [admin] = await db
    .select({
      id: admins.id,
      email: admins.email,
      mobileNumber: admins.mobileNumber,
      name: admins.name,
      salutation: admins.salutation,
      role: admins.role,
      institutionId: admins.institutionId,
      profileImage: admins.profileImage,
      isActive: admins.isActive,
      createdAt: admins.createdAt,
      updatedAt: admins.updatedAt,
    })
    .from(admins)
    .where(
      and(
        eq(admins.id, user.id),
        eq(admins.isDeleted, 0),
        eq(admins.isActive, 1),
      ),
    );

  if (admin) return { doc: admin, model: "Admin" as const };

  // Try staff
  const [staffDoc] = await db
    .select({
      id: staff.id,
      email: staff.email,
      mobileNumber: staff.mobileNumber,
      name: staff.name,
      salutation: staff.salutation,
      type: staff.type,
      institutionId: staff.institutionId,
      profileImage: staff.profileImage,
      isActive: staff.isActive,
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt,
    })
    .from(staff)
    .where(
      and(
        eq(staff.id, user.id),
        eq(staff.isDeleted, 0),
        eq(staff.isActive, 1),
      ),
    );

  if (staffDoc) return { doc: staffDoc, model: "Staff" as const };

  return null;
}

// ── Helper: resolve institution ID ──
function resolveInstitutionId(user: Record<string, any>, queryInstitutionId?: string): string {
  if (user.role === "super_admin" && queryInstitutionId) {
    return queryInstitutionId;
  }
  const instId =
    typeof user.institutionId === "object"
      ? (user.institutionId as any)._id?.toString()
      : user.institutionId?.toString();
  if (!instId) throw new BadRequestError("Institution ID is required");
  return instId;
}

// ═══════════════════════════════════════════════════════
// Profile
// ═══════════════════════════════════════════════════════

// ─── GET /profile ────────────────────────────────────────
app.get("/profile", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const result = await findUserByToken(db, user);
  if (!result) throw new BadRequestError("User not found");

  return c.json({ success: true, data: result.doc });
});

// ─── PATCH /profile ──────────────────────────────────────
app.patch("/profile", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const body = await c.req.json<{
    name?: string;
    salutation?: string;
    mobileNumber?: string;
    profileImage?: string;
  }>();

  const db = getDb(c.env.DB);
  const result = await findUserByToken(db, user);
  if (!result) throw new BadRequestError("User not found");

  const updateData: Record<string, any> = { updatedAt: nowISO() };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.salutation !== undefined) updateData.salutation = body.salutation;
  if (body.mobileNumber !== undefined) updateData.mobileNumber = body.mobileNumber;
  if (body.profileImage !== undefined) updateData.profileImage = body.profileImage;

  const table = result.model === "Admin" ? admins : staff;

  const [updated] = await db
    .update(table)
    .set(updateData)
    .where(eq(table.id, user.id))
    .returning();

  // Strip password from response
  const { password: _pw, ...safe } = updated as any;

  return c.json({ success: true, message: "Profile updated", data: safe });
});

// ─── PATCH /change-password ──────────────────────────────
app.patch("/change-password", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const body = await c.req.json<{
    currentPassword: string;
    newPassword: string;
  }>();

  if (!body.currentPassword || !body.newPassword) {
    throw new BadRequestError("currentPassword and newPassword are required");
  }
  if (body.newPassword.length < 6) {
    throw new BadRequestError("New password must be at least 6 characters");
  }

  const db = getDb(c.env.DB);
  const result = await findUserByToken(db, user);
  if (!result) throw new BadRequestError("User not found");

  // Re-fetch with password
  const table = result.model === "Admin" ? admins : staff;
  const [userDoc] = await db
    .select({ id: table.id, password: table.password })
    .from(table)
    .where(eq(table.id, user.id));

  if (!userDoc) throw new BadRequestError("User not found");

  const valid = await verifyPassword(body.currentPassword, userDoc.password);
  if (!valid) throw new BadRequestError("Current password is incorrect");

  const hashed = await hashPassword(body.newPassword);

  await db
    .update(table)
    .set({ password: hashed, updatedAt: nowISO() })
    .where(eq(table.id, user.id));

  return c.json({ success: true, message: "Password changed successfully" });
});

// ═══════════════════════════════════════════════════════
// Institution Profile
// ═══════════════════════════════════════════════════════

// ─── GET /institution-profile ────────────────────────────
app.get("/institution-profile", async (c) => {
  const user = c.get("user") as Record<string, any>;

  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new ForbiddenError("Access denied");
  }

  const institutionId = resolveInstitutionId(user, c.req.query("institutionId"));
  const db = getDb(c.env.DB);

  const [institution] = await db
    .select()
    .from(institutions)
    .where(and(eq(institutions.id, institutionId), eq(institutions.isDeleted, 0)));

  return c.json({ success: true, data: institution || null });
});

// ─── PATCH /institution-profile ──────────────────────────
app.patch("/institution-profile", async (c) => {
  const user = c.get("user") as Record<string, any>;

  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new ForbiddenError("Access denied");
  }

  const institutionId = resolveInstitutionId(user, c.req.query("institutionId"));
  const body = await c.req.json<{
    name?: string;
    type?: "school" | "college";
    address?: string;
    contactDetails?: {
      inchargePerson?: string;
      mobileNumber?: string;
      email?: string;
      officePhone?: string;
    };
  }>();

  const updateData: Record<string, any> = { updatedAt: nowISO() };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.type !== undefined) updateData.type = body.type;
  if (body.address !== undefined) updateData.address = body.address;
  if (body.contactDetails) {
    if (body.contactDetails.inchargePerson !== undefined)
      updateData.contactInchargePerson = body.contactDetails.inchargePerson;
    if (body.contactDetails.mobileNumber !== undefined)
      updateData.contactMobile = body.contactDetails.mobileNumber;
    if (body.contactDetails.email !== undefined)
      updateData.contactEmail = body.contactDetails.email;
    if (body.contactDetails.officePhone !== undefined)
      updateData.contactOfficePhone = body.contactDetails.officePhone;
  }

  const db = getDb(c.env.DB);

  const [updated] = await db
    .update(institutions)
    .set(updateData)
    .where(and(eq(institutions.id, institutionId), eq(institutions.isDeleted, 0)))
    .returning();

  if (!updated) {
    throw new BadRequestError("Institution not found");
  }

  return c.json({ success: true, message: "Institution profile updated", data: updated });
});

// ═══════════════════════════════════════════════════════
// Institution Settings
// ═══════════════════════════════════════════════════════

// ─── GET /institution ────────────────────────────────────
app.get("/institution", async (c) => {
  const user = c.get("user") as Record<string, any>;

  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new ForbiddenError("Access denied");
  }

  const institutionId = resolveInstitutionId(user, c.req.query("institutionId"));
  const db = getDb(c.env.DB);

  const [settings] = await db
    .select()
    .from(institutionSettings)
    .where(
      and(
        eq(institutionSettings.institutionId, institutionId),
        eq(institutionSettings.isDeleted, 0),
      ),
    );

  if (!settings) {
    return c.json({ success: true, data: null });
  }

  // Fetch grading scale entries
  const scale = await db
    .select({
      id: gradingScaleEntries.id,
      grade: gradingScaleEntries.grade,
      label: gradingScaleEntries.label,
      minPercentage: gradingScaleEntries.minPercentage,
      maxPercentage: gradingScaleEntries.maxPercentage,
    })
    .from(gradingScaleEntries)
    .where(eq(gradingScaleEntries.settingsId, settings.id));

  return c.json({ success: true, data: { ...settings, gradingScale: scale } });
});

// ─── PUT /institution — Upsert institution settings ──────
app.put("/institution", async (c) => {
  const user = c.get("user") as Record<string, any>;

  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new ForbiddenError("Access denied");
  }

  const institutionId = resolveInstitutionId(user, c.req.query("institutionId"));
  const body = await c.req.json<{
    language?: string;
    timezone?: string;
    dateFormat?: string;
    currency?: string;
    enableStudentPortal?: boolean;
    enableParentPortal?: boolean;
    gradingScale?: {
      grade: string;
      label: string;
      minPercentage: number;
      maxPercentage: number;
    }[];
    passingMarks?: number;
    notificationPreferences?: {
      newStudentRegistration?: boolean;
      feePaymentReceived?: boolean;
      attendanceAlert?: boolean;
      examResultsPublished?: boolean;
      holidayAnnouncement?: boolean;
    };
    sessionTimeout?: number;
  }>();

  const db = getDb(c.env.DB);
  const now = nowISO();

  // Check if settings exist
  const [existing] = await db
    .select({ id: institutionSettings.id })
    .from(institutionSettings)
    .where(
      and(
        eq(institutionSettings.institutionId, institutionId),
        eq(institutionSettings.isDeleted, 0),
      ),
    );

  // Build settings data (flat columns)
  const settingsData: Record<string, any> = {
    updatedAt: now,
  };
  if (body.language !== undefined) settingsData.language = body.language;
  if (body.timezone !== undefined) settingsData.timezone = body.timezone;
  if (body.dateFormat !== undefined) settingsData.dateFormat = body.dateFormat;
  if (body.currency !== undefined) settingsData.currency = body.currency;
  if (body.enableStudentPortal !== undefined)
    settingsData.enableStudentPortal = body.enableStudentPortal ? 1 : 0;
  if (body.enableParentPortal !== undefined)
    settingsData.enableParentPortal = body.enableParentPortal ? 1 : 0;
  if (body.passingMarks !== undefined) settingsData.passingMarks = body.passingMarks;
  if (body.sessionTimeout !== undefined) settingsData.sessionTimeout = body.sessionTimeout;

  // Map notification prefs to flat columns
  if (body.notificationPreferences) {
    const np = body.notificationPreferences;
    if (np.newStudentRegistration !== undefined || np.feePaymentReceived !== undefined)
      settingsData.notifyEmail = (np.newStudentRegistration ?? true) ? 1 : 0;
    if (np.attendanceAlert !== undefined)
      settingsData.notifyAttendanceAlerts = np.attendanceAlert ? 1 : 0;
    if (np.examResultsPublished !== undefined)
      settingsData.notifyGradeUpdates = np.examResultsPublished ? 1 : 0;
  }

  let settingsId: string;

  if (existing) {
    settingsId = existing.id;
    await db
      .update(institutionSettings)
      .set(settingsData)
      .where(eq(institutionSettings.id, settingsId));
  } else {
    settingsId = uuid();
    await db.insert(institutionSettings).values({
      id: settingsId,
      institutionId,
      isDeleted: 0,
      createdAt: now,
      ...settingsData,
    });
  }

  // Replace grading scale entries if provided
  if (body.gradingScale) {
    // Delete old entries
    await db
      .delete(gradingScaleEntries)
      .where(eq(gradingScaleEntries.settingsId, settingsId));

    // Insert new entries
    for (const entry of body.gradingScale) {
      await db.insert(gradingScaleEntries).values({
        id: uuid(),
        settingsId,
        grade: entry.grade,
        label: entry.label,
        minPercentage: entry.minPercentage,
        maxPercentage: entry.maxPercentage,
      });
    }
  }

  // Fetch full result
  const [result] = await db
    .select()
    .from(institutionSettings)
    .where(eq(institutionSettings.id, settingsId));

  const scale = await db
    .select({
      id: gradingScaleEntries.id,
      grade: gradingScaleEntries.grade,
      label: gradingScaleEntries.label,
      minPercentage: gradingScaleEntries.minPercentage,
      maxPercentage: gradingScaleEntries.maxPercentage,
    })
    .from(gradingScaleEntries)
    .where(eq(gradingScaleEntries.settingsId, settingsId));

  return c.json({ success: true, message: "Settings saved", data: { ...result, gradingScale: scale } });
});

// ═══════════════════════════════════════════════════════
// User Preferences
// ═══════════════════════════════════════════════════════

// ─── GET /preferences ────────────────────────────────────
app.get("/preferences", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(
      and(eq(userPreferences.userId, user.id), eq(userPreferences.isDeleted, 0)),
    );

  return c.json({ success: true, data: prefs || null });
});

// ─── PUT /preferences — Upsert user preferences ─────────
app.put("/preferences", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const body = await c.req.json<{
    language?: string;
    theme?: "light" | "dark" | "system";
    notificationPreferences?: {
      emailNotifications?: boolean;
      smsNotifications?: boolean;
      attendanceAlerts?: boolean;
      examResults?: boolean;
      announcements?: boolean;
    };
  }>();

  const db = getDb(c.env.DB);
  const result = await findUserByToken(db, user);
  if (!result) throw new BadRequestError("User not found");

  const now = nowISO();
  const userModel = result.model;
  const institutionId =
    typeof user.institutionId === "object"
      ? (user.institutionId as any)._id?.toString()
      : user.institutionId?.toString() || null;

  // Check if preferences exist
  const [existing] = await db
    .select({ id: userPreferences.id })
    .from(userPreferences)
    .where(
      and(eq(userPreferences.userId, user.id), eq(userPreferences.isDeleted, 0)),
    );

  const prefsData: Record<string, any> = { updatedAt: now };
  if (body.language !== undefined) prefsData.language = body.language;
  if (body.theme !== undefined) prefsData.theme = body.theme;

  // Map notification prefs to flat columns
  if (body.notificationPreferences) {
    const np = body.notificationPreferences;
    if (np.emailNotifications !== undefined)
      prefsData.notifyEmail = np.emailNotifications ? 1 : 0;
    if (np.smsNotifications !== undefined)
      prefsData.notifySms = np.smsNotifications ? 1 : 0;
    if (np.attendanceAlerts !== undefined)
      prefsData.notifyAttendanceAlerts = np.attendanceAlerts ? 1 : 0;
    if (np.examResults !== undefined)
      prefsData.notifyGradeUpdates = np.examResults ? 1 : 0;
    if (np.announcements !== undefined)
      prefsData.notifyPush = np.announcements ? 1 : 0;
  }

  let prefsId: string;

  if (existing) {
    prefsId = existing.id;
    await db
      .update(userPreferences)
      .set(prefsData)
      .where(eq(userPreferences.id, prefsId));
  } else {
    prefsId = uuid();
    await db.insert(userPreferences).values({
      id: prefsId,
      userId: user.id,
      userModel: userModel,
      institutionId: institutionId,
      isDeleted: 0,
      createdAt: now,
      ...prefsData,
    });
  }

  const [saved] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.id, prefsId));

  return c.json({ success: true, message: "Preferences saved", data: saved });
});

export { app as settingsController };
