import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Bindings, Variables } from "./env";
import { baseRouter } from "./modules/router";
import { errorHandler } from "./lib/errors/handler";
import { sweepAllStaleSessions } from "./modules/staff/class-session-controller";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const DEFAULT_ALLOWED_ORIGINS = [
	"http://localhost:3000",
	"http://127.0.0.1:3000",
	"http://localhost:3001",
	"http://127.0.0.1:3001",
	"https://leaplab.creoleap.com",
	"https://lms.creoleap.com",
	"https://testlms.creoleap.com",
];

function isAllowedPagesDevOrigin(origin: string): boolean {
	try {
		const url = new URL(origin);
		return url.hostname.endsWith(".pages.dev");
	} catch {
		return false;
	}
}

function isAllowedCreoleapOrigin(origin: string): boolean {
	try {
		const url = new URL(origin);
		return (
			(url.protocol === "https:" || url.protocol === "http:") &&
			(url.hostname === "creoleap.com" || url.hostname.endsWith(".creoleap.com"))
		);
	} catch {
		return false;
	}
}

function getAllowedOrigins(rawOrigins?: string): Set<string> {
	const configuredOrigins =
		rawOrigins
			?.split(",")
			.map((origin) => origin.trim())
			.filter(Boolean) ?? [];

	return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins]);
}

function isAllowedOrigin(origin: string, rawOrigins?: string): boolean {
	if (!origin) return false;
	if (isAllowedPagesDevOrigin(origin)) return true;
	if (isAllowedCreoleapOrigin(origin)) return true;
	const allowedOrigins = getAllowedOrigins(rawOrigins);
	return allowedOrigins.has(origin);
}

function corsHeaders(origin: string, env: any): Record<string, string> {
	if (!origin) return {};
	if (!isAllowedOrigin(origin, env?.CORS_ORIGINS)) return {};
	return {
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin, x-user, Accept, Origin, X-Requested-With",
		"Access-Control-Expose-Headers": "Authorization",
		"Access-Control-Allow-Credentials": "true",
		"Access-Control-Max-Age": "86400",
		"Vary": "Origin",
	};
}

app.use("*", cors({
	origin: (origin, c) => {
		if (!origin) return "";
		return isAllowedOrigin(origin, c.env?.CORS_ORIGINS) ? origin : "";
	},
	allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	allowHeaders: ["Content-Type", "Authorization", "x-admin", "x-user", "Accept", "Origin", "X-Requested-With"],
	exposeHeaders: ["Authorization"],
	credentials: true,
	maxAge: 86400,
}));

app.options("*", async (c) => {
	const origin = c.req.header("origin") || "";
	const headers = corsHeaders(origin, c.env);
	const status = 204 as any;
	if (!headers["Access-Control-Allow-Origin"]) {
		return c.body(null, status);
	}
	return c.body(null, status, headers);
});

app.use("*", logger());
app.onError((err, c) => {
	const origin = c.req.header("origin") || "";
	const ch = corsHeaders(origin, c.env);
	for (const [k, v] of Object.entries(ch)) {
		c.res.headers.set(k, v);
	}
	return errorHandler(err, c);
});

app.get("/health", (c) => c.json({ success: true, message: "Server is running" }));

app.route("/api", baseRouter);

export { app };

export default {
	fetch: app.fetch,
	scheduled: async (_event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) => {
		ctx.waitUntil(sweepAllStaleSessions(env));
	},
};
