import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Bindings, Variables } from "./env";
import { baseRouter } from "./modules/router";
import { errorHandler } from "./lib/errors/handler";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", cors());
app.use("*", logger());
app.onError(errorHandler);

app.get("/health", (c) => c.json({ success: true, message: "Server is running" }));

app.route("/api", baseRouter);

export default app;
