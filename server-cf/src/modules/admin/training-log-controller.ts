import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { adminAuth } from "../../middleware/admin-auth";

const trainingLogController = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Allow authenticated users (teacher/admin/super_admin) — same as other admin routes
trainingLogController.use("*", adminAuth);

/**
 * POST /api/admin/training-log
 * Body: { kind: "training_button"|"training_progress"|"training_error", ts, ... }
 * Logs to Worker console → visible in `wrangler tail` and Cloudflare Workers Observability.
 * This is the user request: "log the training button and the training progress"
 */
trainingLogController.post("/", async (c) => {
  try {
    const user = c.get("user") as Record<string, any> | undefined;
    const body = await c.req.json().catch(() => ({}));
    const kind = (body as any).kind || "training_unknown";

    // Structured log for observability filtering — grep for [training]
    console.log(
      `[training] kind=${kind} user=${user?.id || "unknown"} role=${user?.role || "unknown"}`,
      JSON.stringify({
        ...body,
        _userId: user?.id,
        _role: user?.role,
        _ip: c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown",
        _ts: new Date().toISOString(),
      })
    );

    // Also log progress specifically at info level for easier tail filtering
    if (kind === "training_progress") {
      const { status, epoch, step, accuracy, loss, message } = body as any;
      console.log(
        `[training][progress] status=${status} epoch=${epoch ?? "-"} step=${step ?? "-"} accuracy=${accuracy ?? "-"} loss=${loss ?? "-"} msg=${message ?? ""}`
      );
    }
    if (kind === "training_button") {
      const { action, model, label } = body as any;
      console.log(`[training][button] action=${action} model=${model ?? "-"} label=${label ?? "-"}`);
    }
    if (kind === "training_error") {
      console.error(`[training][error]`, JSON.stringify(body));
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("[training] log failed", err);
    return c.json({ success: false, message: "Failed to log" }, 500);
  }
});

// GET /api/admin/training-log/ping — health check for observability
trainingLogController.get("/ping", async (c) => {
  console.log("[training] ping");
  return c.json({ success: true, message: "training-log ok" });
});

export { trainingLogController };
