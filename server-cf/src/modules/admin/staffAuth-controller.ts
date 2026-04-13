import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { eq, and } from "drizzle-orm";
import { staff } from "../../schema/admin";
import { institutions } from "../../schema/admin";
import { verifyPassword } from "../../lib/password";
import { encodeToken } from "../../lib/auth";
import { nowISO } from "../../lib/utils";
import { BadRequestError } from "../../lib/errors/bad-request";

const staffAuthController = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// ─── POST /login ───────────────────────────────────
staffAuthController.post("/login", async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  const { email, password } = body;

  if (!email || !password) {
    throw new BadRequestError("Email and password are required");
  }

  const db = getDb(c.env.DB);

  // Find staff by email
  const [staffRow] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.email, email.toLowerCase()), eq(staff.isDeleted, 0)))
    .limit(1);

  if (!staffRow) {
    throw new BadRequestError("Invalid email or password");
  }

  // Check if staff is active
  if (!staffRow.isActive) {
    throw new BadRequestError(
      "Account is deactivated. Please contact administrator."
    );
  }

  // Verify password
  let isPasswordValid = false;
  try {
    isPasswordValid = await verifyPassword(password, staffRow.password || "");
  } catch (err) {
    console.error("Password verification error:", err);
    isPasswordValid = false;
  }

  if (!isPasswordValid) {
    throw new BadRequestError("Invalid email or password");
  }

  // Update last login
  await db
    .update(staff)
    .set({ lastLogin: nowISO(), updatedAt: nowISO() })
    .where(eq(staff.id, staffRow.id));

  // Generate token
  const role = (staffRow.type as "teacher" | "admin") || "teacher";
  const token = await encodeToken(
    {
      id: staffRow.id,
      email: staffRow.email,
      role,
      institutionId: staffRow.institutionId || "",
    },
    role,
    c.env
  );

  if (!token) {
    throw new BadRequestError("Login failed");
  }

  // Fetch institution info
  let institution: { id: string; name: string | null; logo: string | null } | null = null;
  if (staffRow.institutionId) {
    const [inst] = await db
      .select({ id: institutions.id, name: institutions.name, logo: institutions.logo })
      .from(institutions)
      .where(eq(institutions.id, staffRow.institutionId))
      .limit(1);
    institution = inst || null;
  }

  c.header("Authorization", `Bearer ${token}`);

  return c.json(
    {
      success: true,
      message: "Login successful",
      data: {
        id: staffRow.id,
        email: staffRow.email,
        name: staffRow.name,
        salutation: staffRow.salutation,
        mobileNumber: staffRow.mobileNumber,
        role: staffRow.type,
        institutionId: institution || staffRow.institutionId,
        profileImage: staffRow.profileImage,
        isActive: staffRow.isActive,
        lastLogin: nowISO(),
        token,
      },
    },
    200
  );
});

// ─── POST /logout ──────────────────────────────────
staffAuthController.post("/logout", async (c) => {
  return c.json({ success: true, message: "Logged out successfully" }, 200);
});

export { staffAuthController };
