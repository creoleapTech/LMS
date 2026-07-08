import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, desc, count } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { leaplabCredentials, leaplabProjects } from "../../schema/leaplab";
import { saveFile, deleteFile, deliverFile } from "../../lib/file";
import { nowISO } from "../../lib/utils";
import { userAuth } from "../../middleware/user-auth";
import { BadRequestError } from "../../lib/errors/bad-request";
import { UnauthorizedError } from "../../lib/errors/unauthorized";
import { ForbiddenError } from "../../lib/errors/forbidden";

const app = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// ─── PUBLIC SHARE ROUTES (no auth) ─────────────────────────────────────

// GET /api/leaplab/projects/share/:shareId
app.get("/share/:shareId", async (c) => {
  const shareId = c.req.param("shareId");
  if (!shareId) {
    throw new BadRequestError("Share link is required");
  }

  const [row] = await getDb(c.env.DB)
    .select()
    .from(leaplabProjects)
    .where(
      and(
        eq(leaplabProjects.shareId, shareId),
        eq(leaplabProjects.isShared, 1),
        eq(leaplabProjects.isDeleted, 0),
      ),
    )
    .limit(1);

  if (!row) {
    throw new BadRequestError("Shared project not found");
  }

  c.header("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");

  return c.json(
    {
      success: true,
      data: {
        ...row,
        fileUrl: row.fileKey ? deliverFile(row.fileKey) : null,
        thumbnailUrl: row.thumbnailKey ? deliverFile(row.thumbnailKey) : null,
      },
    },
    200,
  );
});

// PATCH /api/leaplab/projects/share/:shareId — update shared project file (editor only)
const shareUpdateSchema = z.object({
  name: z.string().min(1).optional(),
});

app.patch("/share/:shareId", zValidator("form", shareUpdateSchema), async (c) => {
  const shareId = c.req.param("shareId");
  if (!shareId) {
    throw new BadRequestError("Share link is required");
  }

  const db = getDb(c.env.DB);

  const [existing] = await db
    .select()
    .from(leaplabProjects)
    .where(
      and(
        eq(leaplabProjects.shareId, shareId),
        eq(leaplabProjects.isShared, 1),
        eq(leaplabProjects.isDeleted, 0),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new BadRequestError("Shared project not found");
  }

  if (existing.sharePermission !== "editor") {
    throw new UnauthorizedError("This shared project is view-only");
  }

  const body = c.req.valid("form");
  const formData = await c.req.formData();
  const projectFile = getFormFile(formData, "file");

  if (!projectFile) {
    throw new BadRequestError("Project file is required");
  }

  const updateData: Record<string, any> = {
    updatedAt: nowISO(),
  };

  if (body.name !== undefined) updateData.name = body.name;

  if (existing.fileKey) {
    await deleteFile(c.env.BUCKET, existing.fileKey);
  }

  const fileResult = await saveFile(
    c.env.BUCKET,
    projectFile,
    `leaplab/projects/${existing.institutionId}/${existing.credentialId}`,
  );

  if (!fileResult.ok || !fileResult.key) {
    throw new BadRequestError("Failed to store project file");
  }

  updateData.fileKey = fileResult.key;

  const [updated] = await db
    .update(leaplabProjects)
    .set(updateData)
    .where(eq(leaplabProjects.id, existing.id))
    .returning();

  return c.json(
    {
      success: true,
      data: {
        ...updated,
        fileUrl: updated.fileKey ? deliverFile(updated.fileKey) : null,
        thumbnailUrl: updated.thumbnailKey ? deliverFile(updated.thumbnailKey) : null,
      },
    },
    200,
  );
});

// All other project routes require a valid LeapLab user token.
app.use("*", userAuth);

function getUser(c: any) {
  return c.get("user") as Record<string, any>;
}

// Helpers to read multipart fields safely.
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

const SHARE_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const SHARE_ID_LENGTH = 8;

function generateShareId(): string {
  let id = "";
  for (let i = 0; i < SHARE_ID_LENGTH; i++) {
    id += SHARE_ID_ALPHABET.charAt(Math.floor(Math.random() * SHARE_ID_ALPHABET.length));
  }
  return id;
}

async function generateUniqueShareId(db: any): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const candidate = generateShareId();
    const [existing] = await db
      .select({ id: leaplabProjects.id })
      .from(leaplabProjects)
      .where(eq(leaplabProjects.shareId, candidate))
      .limit(1);
    if (!existing) return candidate;
    attempts++;
  }
  throw new BadRequestError("Failed to generate a unique share link");
}

// ─── CREATE /api/leaplab/projects ─────────────────────

const createSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  mode: z.string().min(1, "Project mode is required"),
  metadata: z.string().optional(),
});

app.post("/", zValidator("form", createSchema), async (c) => {
  const user = getUser(c);
  const credentialId = String(user.userId);
  const institutionId = String(user.institutionId);

  if (!credentialId || !institutionId) {
    throw new UnauthorizedError("Invalid authentication token");
  }

  if (user.role === "trainer") {
    throw new ForbiddenError("Trainers are not allowed to save projects to the cloud");
  }

  const body = c.req.valid("form");
  const formData = await c.req.formData();
  const projectFile = getFormFile(formData, "file");

  if (!projectFile) {
    throw new BadRequestError("Project file is required");
  }

  // Check if this credential has unlimited access (skip project limit)
  const [cred] = await getDb(c.env.DB)
    .select({ isUnlimited: leaplabCredentials.isUnlimited })
    .from(leaplabCredentials)
    .where(eq(leaplabCredentials.id, credentialId))
    .limit(1);

  if (!cred?.isUnlimited) {
    // Enforce a 50-project limit per module (mode) for this user.
    const [{ projectCount }] = await getDb(c.env.DB)
      .select({ projectCount: count() })
      .from(leaplabProjects)
      .where(
        and(
          eq(leaplabProjects.credentialId, credentialId),
          eq(leaplabProjects.mode, body.mode),
          eq(leaplabProjects.isDeleted, 0),
        ),
      );

    const PROJECT_LIMIT_PER_MODULE = 50;
    if (projectCount >= PROJECT_LIMIT_PER_MODULE) {
      throw new BadRequestError(
        `You have reached the limit of ${PROJECT_LIMIT_PER_MODULE} projects for this module. Please delete an existing project before saving a new one.`
      );
    }
  }

  const projectId = uuid();
  const now = nowISO();

  const fileResult = await saveFile(
    c.env.BUCKET,
    projectFile,
    `leaplab/projects/${institutionId}/${credentialId}`,
  );

  if (!fileResult.ok || !fileResult.key) {
    throw new BadRequestError("Failed to store project file");
  }

  await getDb(c.env.DB).insert(leaplabProjects).values({
    id: projectId,
    institutionId,
    credentialId,
    name: body.name,
    description: body.description ?? null,
    mode: body.mode,
    fileKey: fileResult.key,
    thumbnailKey: null,
    metadata: body.metadata ?? null,
    isActive: 1,
    isDeleted: 0,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await getDb(c.env.DB)
    .select()
    .from(leaplabProjects)
    .where(eq(leaplabProjects.id, projectId))
    .limit(1);

  return c.json(
    {
      success: true,
      data: {
        ...created,
        fileUrl: created.fileKey ? deliverFile(created.fileKey) : null,
        thumbnailUrl: created.thumbnailKey ? deliverFile(created.thumbnailKey) : null,
      },
    },
    201,
  );
});

// ─── LIST /api/leaplab/projects?mode=<optional> ─────────────────────

app.get("/", async (c) => {
  const user = getUser(c);
  const credentialId = String(user.userId);
  const mode = c.req.query("mode");

  if (!credentialId) {
    throw new UnauthorizedError("Invalid authentication token");
  }

  if (user.role === "trainer") {
    return c.json({ success: true, data: [] }, 200);
  }

  const conditions = [
    eq(leaplabProjects.credentialId, credentialId),
    eq(leaplabProjects.isDeleted, 0),
  ];

  if (mode) {
    conditions.push(eq(leaplabProjects.mode, mode));
  }

  const rows = await getDb(c.env.DB)
    .select()
    .from(leaplabProjects)
    .where(and(...conditions))
    .orderBy(desc(leaplabProjects.updatedAt));

  return c.json(
    {
      success: true,
      data: rows.map((row) => ({
        ...row,
        fileUrl: row.fileKey ? deliverFile(row.fileKey) : null,
        thumbnailUrl: row.thumbnailKey ? deliverFile(row.thumbnailKey) : null,
      })),
    },
    200,
  );
});

// ─── GET /api/leaplab/projects/:id ─────────────────────

app.get("/:id", async (c) => {
  const user = getUser(c);
  const credentialId = String(user.userId);
  const id = c.req.param("id");

  if (user.role === "trainer") {
    throw new ForbiddenError("Trainers are not allowed to access cloud projects");
  }

  const [row] = await getDb(c.env.DB)
    .select()
    .from(leaplabProjects)
    .where(
      and(
        eq(leaplabProjects.id, id),
        eq(leaplabProjects.credentialId, credentialId),
        eq(leaplabProjects.isDeleted, 0),
      ),
    )
    .limit(1);

  if (!row) {
    throw new BadRequestError("Project not found");
  }

  return c.json(
    {
      success: true,
      data: {
        ...row,
        fileUrl: row.fileKey ? deliverFile(row.fileKey) : null,
        thumbnailUrl: row.thumbnailKey ? deliverFile(row.thumbnailKey) : null,
      },
    },
    200,
  );
});

// ─── UPDATE /api/leaplab/projects/:id ─────────────────────

const updateSchema = z.object({
  name: z.string().min(1, "Project name is required").optional(),
  description: z.string().optional(),
  metadata: z.string().optional(),
});

app.patch("/:id", zValidator("form", updateSchema), async (c) => {
  const user = getUser(c);
  const credentialId = String(user.userId);
  const id = c.req.param("id");

  if (user.role === "trainer") {
    throw new ForbiddenError("Trainers are not allowed to save projects to the cloud");
  }

  const [existing] = await getDb(c.env.DB)
    .select()
    .from(leaplabProjects)
    .where(
      and(
        eq(leaplabProjects.id, id),
        eq(leaplabProjects.credentialId, credentialId),
        eq(leaplabProjects.isDeleted, 0),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new BadRequestError("Project not found");
  }

  const body = c.req.valid("form");
  const formData = await c.req.formData();
  const projectFile = getFormFile(formData, "file");

  const updateData: Record<string, any> = {
    updatedAt: nowISO(),
  };

  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) {
    updateData.description = body.description ?? null;
  }
  if (body.metadata !== undefined) {
    updateData.metadata = body.metadata ?? null;
  }

  if (projectFile) {
    if (existing.fileKey) {
      await deleteFile(c.env.BUCKET, existing.fileKey);
    }

    const fileResult = await saveFile(
      c.env.BUCKET,
      projectFile,
      `leaplab/projects/${existing.institutionId}/${existing.credentialId}`,
    );

    if (!fileResult.ok || !fileResult.key) {
      throw new BadRequestError("Failed to store project file");
    }

    updateData.fileKey = fileResult.key;
  }

  const [updated] = await getDb(c.env.DB)
    .update(leaplabProjects)
    .set(updateData)
    .where(eq(leaplabProjects.id, id))
    .returning();

  return c.json(
    {
      success: true,
      data: {
        ...updated,
        fileUrl: updated.fileKey ? deliverFile(updated.fileKey) : null,
        thumbnailUrl: updated.thumbnailKey ? deliverFile(updated.thumbnailKey) : null,
      },
    },
    200,
  );
});

// ─── DELETE /api/leaplab/projects/:id (soft delete) ─────────────────────

app.delete("/:id", async (c) => {
  const user = getUser(c);
  const credentialId = String(user.userId);
  const id = c.req.param("id");

  if (user.role === "trainer") {
    throw new ForbiddenError("Trainers are not allowed to delete cloud projects");
  }

  const [existing] = await getDb(c.env.DB)
    .select()
    .from(leaplabProjects)
    .where(
      and(
        eq(leaplabProjects.id, id),
        eq(leaplabProjects.credentialId, credentialId),
        eq(leaplabProjects.isDeleted, 0),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new BadRequestError("Project not found");
  }

  await getDb(c.env.DB)
    .update(leaplabProjects)
    .set({ isDeleted: 1, updatedAt: nowISO() })
    .where(eq(leaplabProjects.id, id));

  return c.json(
    {
      success: true,
      message: "Project deleted successfully",
    },
    200,
  );
});

// ─── POST /api/leaplab/projects/:id/share ───────────────────────────────

const shareSchema = z.object({
  permission: z.enum(["viewer", "editor"]).default("viewer"),
});

app.post("/:id/share", zValidator("json", shareSchema), async (c) => {
  const user = getUser(c);
  const credentialId = String(user.userId);
  const id = c.req.param("id");
  const { permission } = c.req.valid("json");

  if (user.role === "trainer") {
    throw new ForbiddenError("Trainers are not allowed to share projects");
  }

  const db = getDb(c.env.DB);

  const [existing] = await db
    .select()
    .from(leaplabProjects)
    .where(
      and(
        eq(leaplabProjects.id, id),
        eq(leaplabProjects.credentialId, credentialId),
        eq(leaplabProjects.isDeleted, 0),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new BadRequestError("Project not found");
  }

  const shareId = existing.shareId || (await generateUniqueShareId(db));

  const [updated] = await db
    .update(leaplabProjects)
    .set({
      isShared: 1,
      shareId,
      sharePermission: permission,
      updatedAt: nowISO(),
    })
    .where(eq(leaplabProjects.id, id))
    .returning();

  return c.json(
    {
      success: true,
      data: {
        ...updated,
        fileUrl: updated.fileKey ? deliverFile(updated.fileKey) : null,
        thumbnailUrl: updated.thumbnailKey ? deliverFile(updated.thumbnailKey) : null,
      },
    },
    200,
  );
});

// ─── DELETE /api/leaplab/projects/:id/share ─────────────────────────────

app.delete("/:id/share", async (c) => {
  const user = getUser(c);
  const credentialId = String(user.userId);
  const id = c.req.param("id");

  if (user.role === "trainer") {
    throw new ForbiddenError("Trainers are not allowed to manage shares");
  }

  const db = getDb(c.env.DB);

  const [existing] = await db
    .select()
    .from(leaplabProjects)
    .where(
      and(
        eq(leaplabProjects.id, id),
        eq(leaplabProjects.credentialId, credentialId),
        eq(leaplabProjects.isDeleted, 0),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new BadRequestError("Project not found");
  }

  const [updated] = await db
    .update(leaplabProjects)
    .set({
      isShared: 0,
      shareId: null,
      sharePermission: null,
      updatedAt: nowISO(),
    })
    .where(eq(leaplabProjects.id, id))
    .returning();

  return c.json(
    {
      success: true,
      data: {
        ...updated,
        fileUrl: updated.fileKey ? deliverFile(updated.fileKey) : null,
        thumbnailUrl: updated.thumbnailKey ? deliverFile(updated.thumbnailKey) : null,
      },
    },
    200,
  );
});

export { app as leaplabProjectController };
