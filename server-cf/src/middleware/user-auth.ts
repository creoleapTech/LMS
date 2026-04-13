import type { MiddlewareHandler } from "hono";
import type { Bindings, Variables } from "../env";
import { decodeToken } from "../lib/auth";

/**
 * User auth middleware — user key only.
 * Equivalent of userAuthMacro in the Elysia version.
 */
export const userAuth: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (c, next) => {
  const xUser = c.req.header("x-user");
  const auth = c.req.header("authorization");
  const token = xUser || (auth?.startsWith("Bearer ") ? auth.slice(7) : null);

  if (!token) {
    return c.json({ success: false, message: "Unauthorized" }, 401);
  }

  const payload = await decodeToken(token, "teacher", c.env);
  if (!payload) {
    return c.json({ success: false, message: "Invalid token" }, 401);
  }

  c.set("user", payload);
  return next();
};
