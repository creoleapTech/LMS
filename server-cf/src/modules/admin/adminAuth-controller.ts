import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { admins, staff } from "../../schema/admin";
import { institutions } from "../../schema/admin";
import { hashPassword, verifyPassword } from "../../lib/password";
import { encodeToken, decodeToken } from "../../lib/auth";
import type { AdminRoles } from "../../lib/auth";
import { nowISO } from "../../lib/utils";
import { BadRequestError } from "../../lib/errors/bad-request";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Helper: extract & decode token from headers (tries admin then super_admin) ───
async function decodeTokenFromHeaders(
  c: any,
): Promise<Record<string, any>> {
  const auth = c.req.header("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    throw new BadRequestError("No token provided");
  }

  // Try admin key first, then super_admin
  let payload = await decodeToken(token, "admin", c.env);
  if (!payload) {
    payload = await decodeToken(token, "super_admin", c.env);
  }
  if (!payload) {
    throw new BadRequestError("Invalid token");
  }
  return payload;
}

// ─── POST /register ────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().max(100).optional(),
  mobileNumber: z.string().max(10).optional(),
  role: z.enum(["super_admin", "admin"]).optional(),
  institutionId: z.string().optional(),
});

app.post("/register", zValidator("json", registerSchema), async (c) => {
  const body = c.req.valid("json");

  const db = getDb(c.env.DB);

  // Check if admin already exists
  const existing = await db
    .select()
    .from(admins)
    .where(and(eq(admins.email, body.email), eq(admins.isDeleted, 0)));

  if (existing.length > 0) {
    throw new BadRequestError("Admin already exists with this email");
  }

  const id = uuid();
  const now = nowISO();
  const hashed = await hashPassword(body.password);

  const [admin] = await db
    .insert(admins)
    .values({
      id,
      email: body.email,
      password: hashed,
      name: body.name ?? null,
      mobileNumber: body.mobileNumber ?? null,
      role: body.role ?? "admin",
      institutionId: body.institutionId ?? null,
      isActive: 1,
      isDeleted: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json(
    {
      success: true,
      message: "Admin registered successfully",
      data: {
        _id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        institutionId: admin.institutionId,
        isActive: admin.isActive === 1,
      },
    },
    201,
  );
});

// ─── POST /login ───────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

app.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  const db = getDb(c.env.DB);

  let user: any = null;
  let isStaff = false;

  // 1. Try finding Admin first
  const adminRows = await db
    .select()
    .from(admins)
    .where(and(eq(admins.email, email.toLowerCase()), eq(admins.isDeleted, 0)));

  if (adminRows.length > 0) {
    user = adminRows[0];
  } else {
    // 2. If not admin, try Staff
    const staffRows = await db
      .select()
      .from(staff)
      .where(and(eq(staff.email, email.toLowerCase()), eq(staff.isDeleted, 0)));

    if (staffRows.length > 0) {
      user = staffRows[0];
      isStaff = true;
    }
  }

  if (!user) {
    throw new BadRequestError("Invalid email or password");
  }

  // Check active status
  if (user.isActive !== 1) {
    throw new BadRequestError("Account is deactivated. Please contact administrator.");
  }

  // Verify password
  const isPasswordValid = await verifyPassword(password, user.password || "").catch(
    (err) => {
      console.error("Password verification error:", err);
      return false;
    },
  );

  if (!isPasswordValid) {
    throw new BadRequestError("Invalid email or password");
  }

  // Update last login
  const now = nowISO();
  if (!isStaff) {
    const lastIp =
      c.req.header("x-forwarded-for") ||
      c.req.header("x-real-ip") ||
      "unknown";
    const lastUserAgent = c.req.header("user-agent") || "unknown";

    await db
      .update(admins)
      .set({ lastLogin: now, lastIp, lastUserAgent, updatedAt: now })
      .where(eq(admins.id, user.id));
  } else {
    await db
      .update(staff)
      .set({ lastLogin: now, updatedAt: now })
      .where(eq(staff.id, user.id));
  }

  // Prepare token payload
  const roleForToken: AdminRoles = isStaff ? user.type : user.role;
  const tokenPayload: Record<string, string> = {
    id: user.id,
    email: user.email,
    role: roleForToken,
    ...(user.institutionId ? { institutionId: user.institutionId } : {}),
  };

  const token = await encodeToken(tokenPayload, roleForToken, c.env);
  if (!token) {
    throw new BadRequestError("Failed to generate authentication token");
  }

  // Fetch institution info if linked
  let institutionData: any = user.institutionId;
  if (user.institutionId) {
    const instRows = await db
      .select({ id: institutions.id, name: institutions.name, logo: institutions.logo })
      .from(institutions)
      .where(eq(institutions.id, user.institutionId));

    if (instRows.length > 0) {
      institutionData = instRows[0];
    }
  }

  c.header("Authorization", `Bearer ${token}`);

  console.log(
    "Login response role:",
    roleForToken,
    "isStaff:",
    isStaff,
    "user.type:",
    user.type,
  );

  return c.json(
    {
      success: true,
      message: "Login successful",
      data: {
        _id: user.id,
        email: user.email,
        name: user.name,
        salutation: user.salutation,
        mobileNumber: user.mobileNumber,
        role: roleForToken,
        institutionId: institutionData,
        profileImage: user.profileImage,
        isActive: user.isActive === 1,
        lastLogin: now,
        token,
      },
    },
    200,
  );
});

// ─── POST /logout ──────────────────────────────────────
app.post("/logout", async (c) => {
  // Token blacklisting can be added here if needed
  return c.json({ success: true, message: "Logout successful" }, 200);
});

// ─── GET /profile ──────────────────────────────────────
app.get("/profile", async (c) => {
  const decoded = await decodeTokenFromHeaders(c);

  const db = getDb(c.env.DB);

  const rows = await db
    .select({
      id: admins.id,
      email: admins.email,
      name: admins.name,
      salutation: admins.salutation,
      mobileNumber: admins.mobileNumber,
      role: admins.role,
      institutionId: admins.institutionId,
      profileImage: admins.profileImage,
      fcmToken: admins.fcmToken,
      isActive: admins.isActive,
      lastLogin: admins.lastLogin,
      createdAt: admins.createdAt,
      updatedAt: admins.updatedAt,
    })
    .from(admins)
    .where(
      and(
        eq(admins.id, decoded.id),
        eq(admins.isDeleted, 0),
        eq(admins.isActive, 1),
      ),
    );

  if (rows.length === 0) {
    throw new BadRequestError("Admin not found");
  }

  return c.json(
    {
      success: true,
      message: "Profile fetched successfully",
      data: rows[0],
    },
    200,
  );
});

// ─── PATCH /profile ────────────────────────────────────
const updateProfileSchema = z.object({
  name: z.string().max(100).optional(),
  salutation: z.enum(["Mr", "Mrs", "Ms", "Dr"]).optional(),
  mobileNumber: z.string().max(10).optional(),
  profileImage: z.string().optional(),
  fcmToken: z.string().optional(),
});

app.patch("/profile", zValidator("json", updateProfileSchema), async (c) => {
  const decoded = await decodeTokenFromHeaders(c);
  const body = c.req.valid("json");

  const db = getDb(c.env.DB);

  // Build update payload (only provided fields)
  const updateData: Record<string, any> = { updatedAt: nowISO() };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.salutation !== undefined) updateData.salutation = body.salutation;
  if (body.mobileNumber !== undefined) updateData.mobileNumber = body.mobileNumber;
  if (body.profileImage !== undefined) updateData.profileImage = body.profileImage;
  if (body.fcmToken !== undefined) updateData.fcmToken = body.fcmToken;

  const updated = await db
    .update(admins)
    .set(updateData)
    .where(
      and(
        eq(admins.id, decoded.id),
        eq(admins.isDeleted, 0),
        eq(admins.isActive, 1),
      ),
    )
    .returning({
      id: admins.id,
      email: admins.email,
      name: admins.name,
      salutation: admins.salutation,
      mobileNumber: admins.mobileNumber,
      role: admins.role,
      institutionId: admins.institutionId,
      profileImage: admins.profileImage,
      fcmToken: admins.fcmToken,
      isActive: admins.isActive,
      lastLogin: admins.lastLogin,
      createdAt: admins.createdAt,
      updatedAt: admins.updatedAt,
    });

  if (updated.length === 0) {
    throw new BadRequestError("Admin not found");
  }

  return c.json(
    {
      success: true,
      message: "Profile updated successfully",
      data: updated[0],
    },
    200,
  );
});

// ─── PATCH /change-password ────────────────────────────
const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6),
});

app.patch(
  "/change-password",
  zValidator("json", changePasswordSchema),
  async (c) => {
    const decoded = await decodeTokenFromHeaders(c);
    const { currentPassword, newPassword } = c.req.valid("json");

    const db = getDb(c.env.DB);

    // Get admin with password
    const rows = await db
      .select()
      .from(admins)
      .where(
        and(
          eq(admins.id, decoded.id),
          eq(admins.isDeleted, 0),
          eq(admins.isActive, 1),
        ),
      );

    if (rows.length === 0) {
      throw new BadRequestError("Admin not found");
    }

    const admin = rows[0];

    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(
      currentPassword,
      admin.password,
    ).catch((err) => {
      console.error("Password verification error:", err);
      return false;
    });

    if (!isCurrentPasswordValid) {
      throw new BadRequestError("Current password is incorrect");
    }

    // Hash and save new password
    const hashed = await hashPassword(newPassword);

    await db
      .update(admins)
      .set({ password: hashed, updatedAt: nowISO() })
      .where(eq(admins.id, decoded.id));

    return c.json(
      {
        success: true,
        message: "Password changed successfully",
      },
      200,
    );
  },
);

export { app as adminAuthController };
