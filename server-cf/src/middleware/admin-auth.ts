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
    return c.json({ success: false, message: "Unauthorized" }, 401);
  }

  // Try teacher key
  const teacherPayload = await decodeToken(token, "teacher", c.env);
  if (teacherPayload) {
    c.set("user", teacherPayload);
    return next();
  }

  // Try admin key
  const adminPayload = await decodeToken(token, "admin", c.env);
  if (adminPayload) {
    c.set("user", adminPayload);
    return next();
  }

  // Try super_admin key
  const superAdminPayload = await decodeToken(token, "super_admin", c.env);
  if (superAdminPayload) {
    c.set("user", superAdminPayload);
    return next();
  }

  return c.json({ success: false, message: "Invalid token" }, 401);
};
