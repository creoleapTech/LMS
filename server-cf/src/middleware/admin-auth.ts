import type { MiddlewareHandler } from "hono";
import type { Bindings, Variables } from "../env";
import { decodeToken } from "../lib/auth";

function extractToken(c: any): string | null {
  const xAdmin = c.req.header("x-admin");
  if (xAdmin) return xAdmin;

  const auth = c.req.header("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);

  return null;
}

/**
 * Admin auth middleware — tries teacher, admin, then super_admin keys.
 * Equivalent of adminAuthMacro in the Elysia version.
 */
export const adminAuth: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (c, next) => {
  const token = extractToken(c);

  if (!token) {
    console.warn("[adminAuth] No token provided — header x-admin / Authorization missing");
    return c.json({ success: false, message: "Unauthorized" }, 401);
  }

  console.log("[adminAuth] Token present, length:", token.length);

  // Try teacher key
  const teacherPayload = await decodeToken(token, "teacher", c.env);
  if (teacherPayload) {
    console.log("[adminAuth] Decoded with teacher key, role:", teacherPayload.role);
    c.set("user", teacherPayload);
    return next();
  }
  console.log("[adminAuth] teacher key failed");

  // Try admin key
  const adminPayload = await decodeToken(token, "admin", c.env);
  if (adminPayload) {
    console.log("[adminAuth] Decoded with admin key, role:", adminPayload.role);
    c.set("user", adminPayload);
    return next();
  }
  console.log("[adminAuth] admin key failed");

  // Try super_admin key
  const superAdminPayload = await decodeToken(token, "super_admin", c.env);
  if (superAdminPayload) {
    console.log("[adminAuth] Decoded with super_admin key, role:", superAdminPayload.role);
    c.set("user", superAdminPayload);
    return next();
  }
  console.log("[adminAuth] super_admin key failed");

  console.warn("[adminAuth] All keys failed — returning 401");
  return c.json({ success: false, message: "Invalid token" }, 401);
};
