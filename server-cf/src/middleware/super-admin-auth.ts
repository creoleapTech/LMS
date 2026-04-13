import type { MiddlewareHandler } from "hono";
import type { Bindings, Variables } from "../env";
import { decodeToken } from "../lib/auth";

/**
 * Super admin auth middleware — super_admin key only.
 * Equivalent of superAdminAuthMacro in the Elysia version.
 */
export const superAdminAuth: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (c, next) => {
  const xAdmin = c.req.header("x-admin");
  const auth = c.req.header("authorization");
  const token = xAdmin || (auth?.startsWith("Bearer ") ? auth.slice(7) : null);

  if (!token) {
    return c.json({ success: false, message: "Unauthorized" }, 401);
  }

  const payload = await decodeToken(token, "super_admin", c.env);
  if (!payload) {
    return c.json({ success: false, message: "Invalid token" }, 401);
  }

  c.set("user", payload);
  return next();
};
