import { describe, expect, test } from "bun:test";
import app from "../src/index";

type HonoRoute = {
  method: string;
  path: string;
};

const METHODS_UNDER_TEST = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

const ADMIN_AUTH_PUBLIC = new Set([
  "POST:/api/admin/auth/register",
  "POST:/api/admin/auth/login",
  "POST:/api/admin/auth/logout",
]);

const STAFF_AUTH_PUBLIC = new Set([
  "POST:/api/admin/staff/auth/login",
  "POST:/api/admin/staff/auth/logout",
]);

const mockEnv = {
  JWT_TEACHER_SECRET: "x".repeat(32),
  JWT_ADMIN_SECRET: "y".repeat(32),
  JWT_SUPERADMIN_SECRET: "z".repeat(32),
  CORS_ORIGINS: "http://localhost:3001",
};

const PARAM_SAMPLES: Record<string, string> = {
  id: "00000000-0000-0000-0000-000000000001",
  institutionId: "00000000-0000-0000-0000-000000000002",
  curriculumId: "00000000-0000-0000-0000-000000000003",
  curriculumID: "00000000-0000-0000-0000-000000000003",
  gradeBookId: "00000000-0000-0000-0000-000000000004",
  classId: "00000000-0000-0000-0000-000000000005",
  chapterId: "00000000-0000-0000-0000-000000000006",
  contentId: "00000000-0000-0000-0000-000000000007",
  courseId: "00000000-0000-0000-0000-000000000008",
  staffId: "00000000-0000-0000-0000-000000000009",
  studentId: "00000000-0000-0000-0000-000000000010",
  departmentId: "00000000-0000-0000-0000-000000000011",
  periodId: "00000000-0000-0000-0000-000000000012",
  timetableId: "00000000-0000-0000-0000-000000000013",
  academicYearId: "00000000-0000-0000-0000-000000000014",
  grade: "1",
};

function getRegisteredRoutes(): HonoRoute[] {
  const routeList = ((app as unknown as { routes?: HonoRoute[] }).routes ?? []).filter(
    (route) => METHODS_UNDER_TEST.has(route.method) && route.path !== "/*",
  );

  const deduped = new Map<string, HonoRoute>();

  for (const route of routeList) {
    deduped.set(`${route.method}:${route.path}`, route);
  }

  return [...deduped.values()].sort((a, b) => {
    if (a.path === b.path) return a.method.localeCompare(b.method);
    return a.path.localeCompare(b.path);
  });
}

function materializePath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, (_full, key: string) => {
    return PARAM_SAMPLES[key] ?? `sample-${key.toLowerCase()}`;
  });
}

function requestInitForMethod(method: string): RequestInit {
  if (method === "GET" || method === "DELETE") {
    return { method };
  }

  return {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  };
}

type RouteExpectation =
  | { kind: "health"; allowedStatuses: number[] }
  | { kind: "file"; allowedStatuses: number[] }
  | { kind: "public-auth"; allowedStatuses: number[] }
  | { kind: "token-decoder"; allowedStatuses: number[] }
  | { kind: "protected"; allowedStatuses: number[] };

function expectedForRoute(route: HonoRoute): RouteExpectation {
  const signature = `${route.method}:${route.path}`;

  if (route.method === "GET" && route.path === "/health") {
    return { kind: "health", allowedStatuses: [200] };
  }

  if (route.path.startsWith("/api/file/")) {
    return { kind: "file", allowedStatuses: [400, 501, 503] };
  }

  if (route.path.startsWith("/api/admin/departments")) {
    return { kind: "protected", allowedStatuses: [400, 403] };
  }

  if (ADMIN_AUTH_PUBLIC.has(signature) || STAFF_AUTH_PUBLIC.has(signature)) {
    return { kind: "public-auth", allowedStatuses: [200, 400] };
  }

  if (route.path.startsWith("/api/admin/auth/")) {
    return { kind: "token-decoder", allowedStatuses: [400] };
  }

  return { kind: "protected", allowedStatuses: [401] };
}

const routeCases = getRegisteredRoutes();

describe("API Route Smoke Tests", () => {
  test("registers a broad route surface", () => {
    // This threshold catches accidental unmounting of major routers.
    expect(routeCases.length).toBeGreaterThanOrEqual(70);
  });

  test("health route returns success", async () => {
    const res = await app.request("/health", { method: "GET" }, mockEnv as any);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { success?: boolean; message?: string };
    expect(body.success).toBe(true);
    expect(body.message).toBe("Server is running");
  });

  for (const route of routeCases) {
    if (route.path === "/health" && route.method === "GET") {
      continue;
    }

    const path = materializePath(route.path);
    const expected = expectedForRoute(route);

    test(`${route.method} ${route.path} matches ${expected.kind} expectation`, async () => {
      const res = await app.request(path, requestInitForMethod(route.method), mockEnv as any);

      expect(expected.allowedStatuses.includes(res.status)).toBe(true);

      // Route exists and should never silently become unmounted.
      expect(res.status).not.toBe(404);

      // Baseline route probes should not crash controllers.
      expect(res.status).not.toBe(500);
    });
  }
});
