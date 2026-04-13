import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { nowISO } from "../../lib/utils";
import { periodConfigs } from "../../schema/settings";
import { periodConfigPeriods, periodConfigWorkingDays } from "../../schema/junction";
import { BadRequestError } from "../../lib/errors/bad-request";
import { adminAuth } from "../../middleware/admin-auth";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", adminAuth);

// ── Helper: resolve institution ID from user/query ──
function resolveInstitutionId(user: Record<string, any>, queryInstitutionId?: string): string {
  if (queryInstitutionId) return queryInstitutionId;
  if (user.role !== "super_admin" && user.institutionId) {
    return typeof user.institutionId === "object"
      ? (user.institutionId as any)._id?.toString()
      : user.institutionId.toString();
  }
  throw new BadRequestError("Institution ID is required");
}

// ─── GET / — Get period config for institution ──────────
app.get("/", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const institutionId = resolveInstitutionId(user, c.req.query("institutionId"));
  const db = getDb(c.env.DB);

  const [config] = await db
    .select()
    .from(periodConfigs)
    .where(
      and(
        eq(periodConfigs.institutionId, institutionId),
        eq(periodConfigs.isDeleted, 0),
      ),
    );

  if (!config) {
    return c.json({ success: true, data: null });
  }

  // Fetch periods
  const periods = await db
    .select({
      id: periodConfigPeriods.id,
      periodNumber: periodConfigPeriods.periodNumber,
      label: periodConfigPeriods.label,
      startTime: periodConfigPeriods.startTime,
      endTime: periodConfigPeriods.endTime,
      isBreak: periodConfigPeriods.isBreak,
    })
    .from(periodConfigPeriods)
    .where(eq(periodConfigPeriods.periodConfigId, config.id));

  // Fetch working days
  const workingDayRows = await db
    .select({ day: periodConfigWorkingDays.day })
    .from(periodConfigWorkingDays)
    .where(eq(periodConfigWorkingDays.periodConfigId, config.id));

  const workingDays = workingDayRows.map((r) => r.day);

  return c.json({
    success: true,
    data: { ...config, periods, workingDays },
  });
});

// ─── POST / — Upsert period config ─────────────────────
app.post("/", async (c) => {
  const user = c.get("user") as Record<string, any>;

  if (user.role !== "super_admin" && user.role !== "admin") {
    throw new BadRequestError("Only admin can configure periods");
  }

  const body = await c.req.json<{
    institutionId?: string;
    periods: {
      periodNumber: number;
      label?: string;
      startTime: string;
      endTime: string;
      isBreak?: boolean;
    }[];
    workingDays?: number[];
  }>();

  let institutionId = body.institutionId;
  if (!institutionId) {
    institutionId = user.institutionId
      ? typeof user.institutionId === "object"
        ? (user.institutionId as any)._id?.toString()
        : user.institutionId.toString()
      : undefined;
  }
  if (!institutionId) {
    throw new BadRequestError("Institution ID is required");
  }

  // Validate periods: startTime < endTime
  for (const p of body.periods) {
    if (p.startTime >= p.endTime) {
      throw new BadRequestError(
        `Period ${p.periodNumber}: start time must be before end time`,
      );
    }
  }

  const workingDays = body.workingDays ?? [1, 2, 3, 4, 5];
  const db = getDb(c.env.DB);
  const now = nowISO();

  // Check if config already exists
  const [existing] = await db
    .select({ id: periodConfigs.id })
    .from(periodConfigs)
    .where(
      and(
        eq(periodConfigs.institutionId, institutionId),
        eq(periodConfigs.isDeleted, 0),
      ),
    );

  let configId: string;

  if (existing) {
    configId = existing.id;

    // Update timestamp
    await db
      .update(periodConfigs)
      .set({ updatedAt: now })
      .where(eq(periodConfigs.id, configId));

    // Delete old periods and working days
    await db
      .delete(periodConfigPeriods)
      .where(eq(periodConfigPeriods.periodConfigId, configId));
    await db
      .delete(periodConfigWorkingDays)
      .where(eq(periodConfigWorkingDays.periodConfigId, configId));
  } else {
    // Create new config row
    configId = uuid();
    await db.insert(periodConfigs).values({
      id: configId,
      institutionId,
      isDeleted: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Insert periods
  for (const p of body.periods) {
    await db.insert(periodConfigPeriods).values({
      id: uuid(),
      periodConfigId: configId,
      periodNumber: p.periodNumber,
      label: p.label ?? null,
      startTime: p.startTime,
      endTime: p.endTime,
      isBreak: p.isBreak ? 1 : 0,
    });
  }

  // Insert working days
  for (const day of workingDays) {
    await db.insert(periodConfigWorkingDays).values({
      id: uuid(),
      periodConfigId: configId,
      day,
    });
  }

  // Fetch full config for response
  const [config] = await db
    .select()
    .from(periodConfigs)
    .where(eq(periodConfigs.id, configId));

  const periods = await db
    .select({
      id: periodConfigPeriods.id,
      periodNumber: periodConfigPeriods.periodNumber,
      label: periodConfigPeriods.label,
      startTime: periodConfigPeriods.startTime,
      endTime: periodConfigPeriods.endTime,
      isBreak: periodConfigPeriods.isBreak,
    })
    .from(periodConfigPeriods)
    .where(eq(periodConfigPeriods.periodConfigId, configId));

  const wdRows = await db
    .select({ day: periodConfigWorkingDays.day })
    .from(periodConfigWorkingDays)
    .where(eq(periodConfigWorkingDays.periodConfigId, configId));

  return c.json(
    {
      success: true,
      data: { ...config, periods, workingDays: wdRows.map((r) => r.day) },
    },
    201,
  );
});

export { app as periodConfigController };
