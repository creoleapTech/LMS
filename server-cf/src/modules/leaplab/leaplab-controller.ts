import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { leaplabVersions } from "../../schema/leaplab-versions";
import { deliverFile } from "../../lib/file";
import { nowISO } from "../../lib/utils";
import { adminAuth } from "../../middleware/admin-auth";
import { BadRequestError } from "../../lib/errors/bad-request";

// ─── Public version query (no auth) ────────────────────────────────────
export const leaplabPublicController = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

leaplabPublicController.get("/latest", async (c) => {
  const db = getDb(c.env.DB);

  const [row] = await db
    .select()
    .from(leaplabVersions)
    .where(eq(leaplabVersions.isLatest, 1))
    .orderBy(desc(leaplabVersions.createdAt))
    .limit(1);

  if (!row) {
    return c.json({ success: true, data: null });
  }

  // Build download URLs relative to the version folder
  const baseUrl = `/api/file/proxy?key=${encodeURIComponent(`leaplab/releases/v${row.version}/`)}`;

  return c.json({
    success: true,
    data: {
      id: row.id,
      version: row.version,
      exeUrl: deliverFile(row.exeKey),
      blockmapUrl: row.blockmapKey ? deliverFile(row.blockmapKey) : null,
      latestYmlUrl: row.latestYmlKey ? deliverFile(row.latestYmlKey) : null,
      sha512: row.sha512,
      releaseNotes: row.releaseNotes,
      createdAt: row.createdAt,
    },
  });
});

// ─── Admin version upload (admin/super_admin only) ─────────────────────
export const leaplabAdminController = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

leaplabAdminController.use("*", adminAuth);

const uploadSchema = z.object({
  version: z.string().min(1, "Version is required"),
  releaseNotes: z.string().optional(),
});

leaplabAdminController.post("/", zValidator("form", uploadSchema), async (c) => {
  const formData = await c.req.formData();
  const version = getFormString(formData, "version");
  const releaseNotes = getFormString(formData, "releaseNotes");
  const exeFile = getFormFile(formData, "file");
  const latestYmlContent = getFormString(formData, "latestYml");
  const blockmapFile = getFormFile(formData, "blockmap");

  if (!version) {
    throw new BadRequestError("Version is required");
  }
  if (!exeFile) {
    throw new BadRequestError("Installer file is required");
  }
  if (!latestYmlContent) {
    throw new BadRequestError("latestYml content is required — paste the contents of out/latest.yml");
  }

  const bucket = c.env.BUCKET;
  if (!bucket) {
    throw new BadRequestError("Storage bucket not available");
  }

  const db = getDb(c.env.DB);
  const now = nowISO();
  const id = uuid();
  const folder = `leaplab/releases/v${version}`;

  // Store the installer exe with its original filename
  const exeName = exeFile.name || `LeapLab-Setup-${version}-x64.exe`;
  const exeKey = `${folder}/${exeName}`;
  await bucket.put(exeKey, exeFile);

  // Store latest.yml
  const latestYmlKey = `${folder}/latest.yml`;
  await bucket.put(latestYmlKey, latestYmlContent);

  // Store blockmap if provided
  let blockmapKey: string | null = null;
  if (blockmapFile) {
    blockmapKey = `${folder}/${blockmapFile.name || `LeapLab-Setup-${version}-x64.exe.blockmap`}`;
    await bucket.put(blockmapKey, blockmapFile);
  }

  // Parse sha512 from latest.yml
  const sha512 = parseSha512FromYml(latestYmlContent);

  // Mark previous latest as not latest
  await db
    .update(leaplabVersions)
    .set({ isLatest: 0 })
    .where(eq(leaplabVersions.isLatest, 1));

  // Insert new version
  await db
    .insert(leaplabVersions)
    .values({
      id,
      version,
      exeKey,
      latestYmlKey,
      blockmapKey,
      sha512,
      releaseNotes: releaseNotes || null,
      isLatest: 1,
      createdAt: now,
    })
    .returning();

  return c.json({
    success: true,
    message: `LeapLab v${version} published`,
    data: {
      id,
      version,
      exeUrl: deliverFile(exeKey),
      blockmapUrl: blockmapKey ? deliverFile(blockmapKey) : null,
      latestYmlUrl: deliverFile(latestYmlKey),
      sha512,
      releaseNotes: releaseNotes || null,
      createdAt: now,
    },
  });
});

// ─── GET / list all versions (admin) ───────────────────────────────────
leaplabAdminController.get("/", async (c) => {
  const db = getDb(c.env.DB);

  const rows = await db
    .select()
    .from(leaplabVersions)
    .orderBy(desc(leaplabVersions.createdAt));

  return c.json({
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      version: r.version,
      exeUrl: deliverFile(r.exeKey),
      blockmapUrl: r.blockmapKey ? deliverFile(r.blockmapKey) : null,
      latestYmlUrl: r.latestYmlKey ? deliverFile(r.latestYmlKey) : null,
      sha512: r.sha512,
      isLatest: r.isLatest === 1,
      releaseNotes: r.releaseNotes,
      createdAt: r.createdAt,
    })),
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Parse the sha512 field from latest.yml content.
 * Format:
 *   sha512: <base64-hash>
 * or
 *   path: LeapLab-Setup-1.0.0-x64.exe
 *   sha512: <base64-hash>
 */
function parseSha512FromYml(yml: string): string | null {
  // Match the first sha512: value (top-level or per-file)
  const match = yml.match(/^sha512:\s*(.+)$|files:\s*\n(?:.+\n)*?\s+sha512:\s*(.+)/m);
  if (match) {
    return (match[1] || match[2] || "").trim();
  }
  // Fallback: find any sha512 line
  const fallback = yml.match(/sha512:\s*['"]?(.+?)['"]?\s*$/m);
  return fallback ? fallback[1].trim() : null;
}

function getFormString(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
}

function getFormFile(formData: FormData, name: string): File | null {
  const value = formData.get(name);
  if (value && typeof value !== "string") {
    return value as unknown as File;
  }
  return null;
}
