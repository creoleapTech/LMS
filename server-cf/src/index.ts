import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Bindings, Variables } from "./env";
import { baseRouter } from "./modules/router";
import { errorHandler } from "./lib/errors/handler";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const DEFAULT_ALLOWED_ORIGINS = [
	"http://localhost:3001",
	"http://127.0.0.1:3001",
];

function getAllowedOrigins(rawOrigins?: string): Set<string> {
	const configuredOrigins =
		rawOrigins
			?.split(",")
			.map((origin) => origin.trim())
			.filter(Boolean) ?? [];

	return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins]);
}

app.use(
	"*",
	cors({
		origin: (origin, c) => {
			if (!origin) {
				return "";
			}

			const allowedOrigins = getAllowedOrigins(c.env.CORS_ORIGINS);
			return allowedOrigins.has(origin) ? origin : "";
		},
		allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization", "x-admin", "x-user"],
		exposeHeaders: ["Authorization"],
		credentials: true,
		maxAge: 86400,
	}),
);
app.use("*", logger());
app.onError(errorHandler);

app.get("/health", (c) => c.json({ success: true, message: "Server is running" }));

app.route("/api", baseRouter);

export default app;
