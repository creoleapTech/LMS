import { describe, expect, test } from "bun:test";
import { app } from "../src/index";

const mockEnv = {
  JWT_TEACHER_SECRET: "x".repeat(32),
  JWT_ADMIN_SECRET: "y".repeat(32),
  JWT_SUPERADMIN_SECRET: "z".repeat(32),
  CORS_ORIGINS: "http://localhost:3001,https://lms-staging.vercel.app,https://testlms.creoleap.com",
};

describe("CORS Handling", () => {
  test("allows OPTIONS preflight from https://testlms.creoleap.com", async () => {
    const res = await app.request(
      "/api/admin/auth/login",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://testlms.creoleap.com",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type, Authorization",
        },
      },
      mockEnv as any,
    );

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://testlms.creoleap.com");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
  });

  test("allows OPTIONS preflight from https://lms.creoleap.com", async () => {
    const res = await app.request(
      "/api/admin/auth/login",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://lms.creoleap.com",
          "Access-Control-Request-Method": "POST",
        },
      },
      mockEnv as any,
    );

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://lms.creoleap.com");
  });

  test("allows OPTIONS preflight from Cloudflare Pages preview *.pages.dev", async () => {
    const res = await app.request(
      "/api/admin/auth/login",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://preview-123.lms-staging.pages.dev",
          "Access-Control-Request-Method": "POST",
        },
      },
      mockEnv as any,
    );

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://preview-123.lms-staging.pages.dev");
  });

  test("allows actual request from https://testlms.creoleap.com and returns CORS headers", async () => {
    const res = await app.request(
      "/health",
      {
        method: "GET",
        headers: {
          Origin: "https://testlms.creoleap.com",
        },
      },
      mockEnv as any,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://testlms.creoleap.com");
  });

  test("does not set Access-Control-Allow-Origin for unauthorized origin", async () => {
    const res = await app.request(
      "/api/admin/auth/login",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://malicious-site.com",
          "Access-Control-Request-Method": "POST",
        },
      },
      mockEnv as any,
    );

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
