import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { v4 as uuid } from "uuid";
import { nowISO } from "../../lib/utils";
import { eq, and, desc, inArray, sql, lt } from "drizzle-orm";
import { adminAuth } from "../../middleware/admin-auth";
import { staff, classes } from "../../schema/admin";
import { classSessions, classSessionLogs } from "../../schema/staff";
import { classSessionTopics } from "../../schema/junction";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";

export const STALE_SESSION_MINUTES = 5;

// IST is UTC+5:30 — interpret date keys as Indian calendar days
function istDayRange(dateKey: string): { start: string; end: string } {
  const start = new Date(`${dateKey}T00:00:00+05:30`);
  const end = new Date(`${dateKey}T23:59:59.999+05:30`);
  return { start: start.toISOString(), end: end.toISOString() };
}

const classSessionController = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Apply auth to all routes
classSessionController.use("*", adminAuth);

// ─── GET /server-time — return server ISO time for drift correction ──

classSessionController.get("/server-time", async (c) => {
  return c.json({ success: true, serverTime: nowISO() });
});

async function logSessionEvent(
  db: any,
  sessionId: string,
  staffId: string,
  action: string,
  statusFrom: string | null,
  statusTo: string | null,
  c: any,
  extra: { durationMinutes?: number; remarks?: string; topicsCovered?: string[] } = {}
) {
  const ipAddress = c ? (c.req.header("CF-Connecting-IP") || c.req.header("x-forwarded-for") || null) : null;
  const userAgent = c ? (c.req.header("user-agent") || null) : null;

  try {
    await db.insert(classSessionLogs).values({
      id: uuid(),
      sessionId,
      staffId,
      action,
      statusFrom,
      statusTo,
      timestamp: nowISO(),
      durationMinutes: extra.durationMinutes ?? null,
      remarks: extra.remarks ?? null,
      topicsCovered: extra.topicsCovered ? JSON.stringify(extra.topicsCovered) : null,
      ipAddress,
      userAgent,
    });
  } catch (err) {
    console.error("[logSessionEvent] Failed to insert audit log:", err);
  }
}

async function autoCloseStaleSessions(db: any, staffId?: string) {
  const cutoff = new Date(Date.now() - STALE_SESSION_MINUTES * 60 * 1000).toISOString();
  const conditions = staffId
    ? and(
        eq(classSessions.staffId, staffId),
        eq(classSessions.status, "ongoing"),
        lt(classSessions.updatedAt, cutoff),
      )
    : and(
        eq(classSessions.status, "ongoing"),
        lt(classSessions.updatedAt, cutoff),
      );

  const stale = await db.select().from(classSessions).where(conditions);

  for (const s of stale) {
    const startTime = new Date(s.startTime!);
    const endTime = new Date();
    const pausedMs = s.totalPausedMs || 0;
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime() - pausedMs) / 60000);
    await db
      .update(classSessions)
      .set({
        endTime: endTime.toISOString(),
        durationMinutes,
        remarks: s.remarks || "[auto-closed: stale]",
        status: "in_progress",
        updatedAt: nowISO(),
      })
      .where(eq(classSessions.id, s.id));

    await logSessionEvent(
      db,
      s.id,
      s.staffId!,
      "auto_close",
      "ongoing",
      "in_progress",
      null,
      { durationMinutes, remarks: s.remarks || "[auto-closed: stale]" }
    );
  }

  return stale.length;
}

/**
 * Sweep all stale sessions across the whole database.
 * Exported for the cron scheduled handler.
 */
export async function sweepAllStaleSessions(env: Record<string, any>) {
  const db = getDb(env.DB);
  const closed = await autoCloseStaleSessions(db);
  console.log(`[class-session sweep] closed ${closed} stale session(s)`);
  return closed;
}

// ─── POST /start — start a class session ──────────

classSessionController.post("/start", async (c) => {
  const body = await c.req.json();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const { classId, courseId } = body;
  const staffId = (user._id || user.id)?.toString();
  const institutionId = typeof user.institutionId === "object"
    ? (user.institutionId as any)._id?.toString()
    : user.institutionId?.toString();

  if (!staffId || !institutionId) {
    throw new BadRequestError("Invalid session: missing staff or institution");
  }

  if (!classId) {
    throw new BadRequestError("classId is required");
  }

  // Verify class belongs to institution
  const [classRow] = await db
    .select({ id: classes.id, institutionId: classes.institutionId })
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);

  if (!classRow || classRow.institutionId !== institutionId) {
    throw new BadRequestError("Invalid Class");
  }

  // Auto-close any stale ongoing sessions for this staff
  await autoCloseStaleSessions(db, staffId);

  // If there's already an ongoing/paused session for this staff+class, return it
  const [existing] = await db
    .select()
    .from(classSessions)
    .where(and(
      eq(classSessions.staffId, staffId),
      eq(classSessions.classId, classId),
      sql`${classSessions.status} IN ('ongoing', 'paused')`,
    ))
    .limit(1);

  if (existing) {
    await logSessionEvent(db, existing.id, staffId, "reconnect", existing.status, existing.status, c);
    return c.json({ success: true, data: existing, serverTime: nowISO() }, 200);
  }

  // Reactivate a recently auto-closed / quietly-ended session in the last 15 minutes
  const recentCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const [recentClosed] = await db
    .select()
    .from(classSessions)
    .where(and(
      eq(classSessions.staffId, staffId),
      eq(classSessions.classId, classId),
      eq(classSessions.status, "in_progress"),
      sql`${classSessions.updatedAt} >= ${recentCutoff}`
    ))
    .limit(1);

  if (recentClosed) {
    const now = nowISO();
    await db
      .update(classSessions)
      .set({
        status: "ongoing",
        endTime: null,
        durationMinutes: null,
        updatedAt: now,
      })
      .where(eq(classSessions.id, recentClosed.id));

    await logSessionEvent(db, recentClosed.id, staffId, "reactivate", "in_progress", "ongoing", c);

    const [reactivated] = await db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, recentClosed.id))
      .limit(1);

    return c.json({ success: true, data: reactivated, serverTime: now }, 200);
  }

  const id = uuid();
  const now = nowISO();

  await db.insert(classSessions).values({
    id,
    staffId,
    institutionId,
    classId,
    courseId: courseId || null,
    startTime: now,
    status: "ongoing",
    createdAt: now,
    updatedAt: now,
  });

  await logSessionEvent(db, id, staffId, "start", null, "ongoing", c);

  const [session] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, id))
    .limit(1);

  return c.json({ success: true, data: session, serverTime: now }, 201);
});

// ─── PATCH /:id/end — end session with remarks + topics ─

classSessionController.patch("/:id/end", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const db = getDb(c.env.DB);

  const [session] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, id))
    .limit(1);

  if (!session) {
    throw new BadRequestError("Session not found");
  }

  if (session.status === "completed") {
    // Idempotent: return existing completed session instead of erroring
    const topics = await db
      .select({ topic: classSessionTopics.topic })
      .from(classSessionTopics)
      .where(eq(classSessionTopics.sessionId, id));

    return c.json({
      success: true,
      data: {
        ...session,
        topicsCovered: topics.map((t: any) => t.topic),
      },
      serverTime: nowISO(),
    });
  }

  const endTime = new Date();
  const startTime = new Date(session.startTime!);
  const pausedMs = session.totalPausedMs || 0;
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime() - pausedMs) / 60000);
  const now = nowISO();

  await db
    .update(classSessions)
    .set({
      endTime: endTime.toISOString(),
      durationMinutes,
      remarks: body.remarks,
      status: "completed",
      pausedAt: null,
      updatedAt: now,
    })
    .where(eq(classSessions.id, id));

  // Insert topics covered into junction table
  if (body.topicsCovered && Array.isArray(body.topicsCovered)) {
    for (const topic of body.topicsCovered) {
      await db.insert(classSessionTopics).values({
        id: uuid(),
        sessionId: id,
        topic,
      });
    }
  }

  await logSessionEvent(db, id, session.staffId!, "complete", session.status, "completed", c, {
    durationMinutes,
    remarks: body.remarks,
    topicsCovered: body.topicsCovered,
  });

  // Fetch updated session
  const [updated] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, id))
    .limit(1);

  // Fetch topics
  const topics = await db
    .select({ topic: classSessionTopics.topic })
    .from(classSessionTopics)
    .where(eq(classSessionTopics.sessionId, id));

  return c.json({
    success: true,
    data: {
      ...updated,
      topicsCovered: topics.map((t: any) => t.topic),
    },
    serverTime: now,
  });
});

// ─── PATCH /:id — update an existing session ──────

classSessionController.patch("/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const db = getDb(c.env.DB);

  const [session] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, id))
    .limit(1);

  if (!session) {
    throw new BadRequestError("Session not found");
  }

  const updates: Record<string, any> = { updatedAt: nowISO() };
  if (body.startTime) updates.startTime = new Date(body.startTime).toISOString();
  if (body.endTime) updates.endTime = new Date(body.endTime).toISOString();
  if (body.durationMinutes !== undefined) updates.durationMinutes = body.durationMinutes;
  if (body.remarks !== undefined) updates.remarks = body.remarks;
  if (body.status) updates.status = body.status;
  if (body.pausedAt !== undefined) updates.pausedAt = body.pausedAt;
  if (body.totalPausedMs !== undefined) updates.totalPausedMs = body.totalPausedMs;

  await db.update(classSessions).set(updates).where(eq(classSessions.id, id));

  if (body.topicsCovered !== undefined) {
    await db.delete(classSessionTopics).where(eq(classSessionTopics.sessionId, id));
    if (Array.isArray(body.topicsCovered)) {
      for (const topic of body.topicsCovered) {
        await db.insert(classSessionTopics).values({
          id: uuid(),
          sessionId: id,
          topic,
        });
      }
    }
  }

  const now = nowISO();
  await logSessionEvent(db, id, session.staffId!, "edit", session.status, body.status || session.status, c, {
    durationMinutes: body.durationMinutes,
    remarks: body.remarks,
    topicsCovered: body.topicsCovered,
  });

  const [updated] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, id))
    .limit(1);

  const topics = await db
    .select({ topic: classSessionTopics.topic })
    .from(classSessionTopics)
    .where(eq(classSessionTopics.sessionId, id));

  return c.json({
    success: true,
    data: {
      ...updated,
      topicsCovered: topics.map((t: any) => t.topic),
    },
    serverTime: now,
  });
});

// ─── GET /my-history — session history for a staff member ─

classSessionController.get("/my-history", async (c) => {
  const staffId = c.req.query("staffId");
  const date = c.req.query("date");
  if (!staffId) {
    throw new BadRequestError("Staff ID required");
  }

  const db = getDb(c.env.DB);

  let sessions;
  if (date) {
    const { start: dayStart, end: dayEnd } = istDayRange(date);

    sessions = await db
      .select()
      .from(classSessions)
      .where(
        and(
          eq(classSessions.staffId, staffId),
          sql`${classSessions.startTime} >= ${dayStart}`,
          sql`${classSessions.startTime} <= ${dayEnd}`,
        ),
      )
      .orderBy(desc(classSessions.startTime));
  } else {
    sessions = await db
      .select()
      .from(classSessions)
      .where(eq(classSessions.staffId, staffId))
      .orderBy(desc(classSessions.startTime));
  }

  const sessionIds = sessions.map((s) => s.id);
  const classIds = [...new Set(sessions.map((s) => s.classId).filter(Boolean))] as string[];

  const CHUNK = 100;

  // Batch fetch class info — chunk to avoid D1's 999-variable limit
  const classMap = new Map<string, any>();
  for (let i = 0; i < classIds.length; i += CHUNK) {
    const chunk = classIds.slice(i, i + CHUNK);
    const rows = await db
      .select({ id: classes.id, grade: classes.grade, section: classes.section })
      .from(classes)
      .where(inArray(classes.id, chunk));
    for (const r of rows) classMap.set(r.id, r);
  }

  // Batch fetch topics — chunk to avoid D1's 999-variable limit
  const topicsMap = new Map<string, string[]>();
  for (let i = 0; i < sessionIds.length; i += CHUNK) {
    const chunk = sessionIds.slice(i, i + CHUNK);
    const rows = await db
      .select({ sessionId: classSessionTopics.sessionId, topic: classSessionTopics.topic })
      .from(classSessionTopics)
      .where(inArray(classSessionTopics.sessionId, chunk));
    for (const r of rows) {
      const arr = topicsMap.get(r.sessionId) || [];
      arr.push(r.topic);
      topicsMap.set(r.sessionId, arr);
    }
  }

  const enriched = sessions.map((session) => ({
    ...session,
    classId: session.classId ? classMap.get(session.classId) || null : null,
    topicsCovered: topicsMap.get(session.id) || [],
  }));

  return c.json({ success: true, data: enriched });
});

// ─── GET /diary — sessions for date range (30-day diary) ─
// Supports:
//   • Teachers/staff: always see their own diary.
//   • Admins: see their own diary (staffId === me) OR any teacher in their institution.
//   • Super admins: see any teacher's diary, optionally filtered by institutionId.

classSessionController.get("/diary", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const userId = user.id;
  const userRole = user.role;
  const userInstitutionId = typeof user.institutionId === "object"
    ? (user.institutionId as any)._id?.toString()
    : user.institutionId?.toString();

  const requestedStaffId = c.req.query("staffId");
  const requestedInstitutionId = c.req.query("institutionId");
  const fromDate = c.req.query("fromDate");
  const toDate = c.req.query("toDate");

  const db = getDb(c.env.DB);

  // Resolve the target staffId and permission scope.
  let targetStaffId: string | undefined = requestedStaffId;
  let targetInstitutionId: string | undefined = requestedInstitutionId;

  // Teachers/staff can only view themselves.
  if (userRole === "teacher" || userRole === "staff") {
    if (requestedStaffId && requestedStaffId !== userId) {
      throw new ForbiddenError("You can only view your own teaching diary");
    }
    targetStaffId = userId;
  }
  // Admins can view their own diary or any staff in their institution.
  else if (userRole === "admin") {
    if (!userInstitutionId) {
      throw new ForbiddenError("No institution associated with this account");
    }

    if (targetStaffId && targetStaffId !== userId) {
      // Verify the requested staff belongs to the admin's institution.
      const [staffRow] = await db
        .select({ id: staff.id, institutionId: staff.institutionId })
        .from(staff)
        .where(and(eq(staff.id, targetStaffId), eq(staff.isDeleted, 0)))
        .limit(1);

      if (!staffRow || staffRow.institutionId !== userInstitutionId) {
        throw new ForbiddenError("You can only view staff in your institution");
      }
    }

    // If no staffId provided, scope to the admin's institution.
    if (!targetStaffId) {
      targetInstitutionId = userInstitutionId;
    }
  }
  // Super admins can view anyone; optionally scope by institutionId.
  else if (userRole === "super_admin") {
    // No extra restrictions.
  }
  else {
    throw new ForbiddenError("Invalid user role");
  }

  // Build query conditions.
  const conditions: any[] = [];
  if (targetStaffId) {
    conditions.push(eq(classSessions.staffId, targetStaffId));
  }
  if (targetInstitutionId) {
    conditions.push(eq(classSessions.institutionId, targetInstitutionId));
  }
  if (fromDate) {
    const { start } = istDayRange(fromDate);
    conditions.push(sql`${classSessions.startTime} >= ${start}`);
  }
  if (toDate) {
    const { end } = istDayRange(toDate);
    conditions.push(sql`${classSessions.startTime} <= ${end}`);
  }

  const sessions = await db
    .select()
    .from(classSessions)
    .where(and(...conditions))
    .orderBy(desc(classSessions.startTime));

  const sessionIds = sessions.map((s) => s.id);

  const CHUNK = 100;

  // Batch fetch class info — chunk to avoid D1's 999-variable limit
  const classMap = new Map<string, any>();
  const classIds = [...new Set(sessions.map((s) => s.classId).filter(Boolean))] as string[];
  for (let i = 0; i < classIds.length; i += CHUNK) {
    const chunk = classIds.slice(i, i + CHUNK);
    const rows = await db
      .select({ id: classes.id, grade: classes.grade, section: classes.section })
      .from(classes)
      .where(inArray(classes.id, chunk));
    for (const r of rows) classMap.set(r.id, r);
  }

  // Batch fetch staff info (for "all teachers" views) — chunk to avoid D1's 999-variable limit
  const staffMap = new Map<string, any>();
  const staffIds = [...new Set(sessions.map((s) => s.staffId).filter(Boolean))] as string[];
  for (let i = 0; i < staffIds.length; i += CHUNK) {
    const chunk = staffIds.slice(i, i + CHUNK);
    const rows = await db
      .select({ id: staff.id, name: staff.name, email: staff.email })
      .from(staff)
      .where(inArray(staff.id, chunk));
    for (const r of rows) staffMap.set(r.id, r);
  }

  // Batch fetch topics — chunk to avoid D1's 999-variable limit
  const topicsMap = new Map<string, string[]>();
  for (let i = 0; i < sessionIds.length; i += CHUNK) {
    const chunk = sessionIds.slice(i, i + CHUNK);
    const rows = await db
      .select({ sessionId: classSessionTopics.sessionId, topic: classSessionTopics.topic })
      .from(classSessionTopics)
      .where(inArray(classSessionTopics.sessionId, chunk));
    for (const r of rows) {
      const arr = topicsMap.get(r.sessionId) || [];
      arr.push(r.topic);
      topicsMap.set(r.sessionId, arr);
    }
  }

  const enriched = sessions.map((session) => ({
    ...session,
    classId: session.classId ? classMap.get(session.classId) || null : null,
    staff: session.staffId ? staffMap.get(session.staffId) || null : null,
    topicsCovered: topicsMap.get(session.id) || [],
  }));

  return c.json({ success: true, data: enriched, serverTime: nowISO() });
});

// ─── GET /:id/end-quietly — end session via sendBeacon (no body) ─

classSessionController.get("/:id/end-quietly", async (c) => {
  const { id } = c.req.param();
  const db = getDb(c.env.DB);

  const [session] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, id))
    .limit(1);

  if (!session) {
    return c.json({ success: false, serverTime: nowISO() }, 404);
  }

  // Already completed or in_progress — no-op
  if (session.status === "completed" || session.status === "in_progress") {
    return c.json({ success: true, serverTime: nowISO() });
  }

  const endTime = new Date();
  const startTime = new Date(session.startTime!);
  const pausedMs = session.totalPausedMs || 0;
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime() - pausedMs) / 60000);
  const now = nowISO();

  await db
    .update(classSessions)
    .set({
      endTime: endTime.toISOString(),
      durationMinutes,
      status: "in_progress",
      remarks: session.remarks || "[auto-closed: tab closed]",
      pausedAt: null,
      updatedAt: now,
    })
    .where(eq(classSessions.id, id));

  await logSessionEvent(db, id, session.staffId!, "tab_close", session.status, "in_progress", c, {
    durationMinutes,
    remarks: session.remarks || "[auto-closed: tab closed]",
  });

  return c.json({ success: true, serverTime: now });
});

// ─── POST /heartbeat/:id — keep session alive ────

classSessionController.post("/heartbeat/:id", async (c) => {
  const { id } = c.req.param();
  const db = getDb(c.env.DB);

  const [session] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, id))
    .limit(1);

  if (!session) {
    return c.json({ success: false, message: "Session not found", serverTime: nowISO() }, 404);
  }

  // No-op if session is already completed or paused — don't error
  if (session.status === "completed" || session.status === "paused") {
    return c.json({ success: true, serverTime: nowISO() });
  }

  const now = nowISO();
  let statusFrom = session.status;
  let statusTo = session.status;
  let reactivated = false;

  if (session.status === "in_progress") {
    await db
      .update(classSessions)
      .set({
        status: "ongoing",
        endTime: null,
        durationMinutes: null,
        updatedAt: now,
      })
      .where(eq(classSessions.id, id));
    statusTo = "ongoing";
    reactivated = true;
  } else {
    await db
      .update(classSessions)
      .set({ updatedAt: now })
      .where(eq(classSessions.id, id));
  }

  if (reactivated) {
    await logSessionEvent(db, id, session.staffId!, "reactivate", statusFrom, statusTo, c);
  }

  return c.json({ success: true, serverTime: now });
});

// ─── POST /:id/topics — add topics to a session ──

classSessionController.post("/:id/topics", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const db = getDb(c.env.DB);

  const [session] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, id))
    .limit(1);

  if (!session) {
    throw new BadRequestError("Session not found");
  }

  const topics: string[] = body.topics;
  if (!Array.isArray(topics) || topics.length === 0) {
    return c.json({ success: true, data: { topicsAdded: 0 } });
  }

  for (const topic of topics) {
    await db.insert(classSessionTopics).values({
      id: uuid(),
      sessionId: id,
      topic,
    });
  }

  const allTopics = await db
    .select({ topic: classSessionTopics.topic })
    .from(classSessionTopics)
    .where(eq(classSessionTopics.sessionId, id));

  return c.json({
    success: true,
    data: { topicsAdded: topics.length, topicsCovered: allTopics.map((t: any) => t.topic) },
  });
});

// ─── POST /:id/pause — pause an ongoing session ──────

classSessionController.post("/:id/pause", async (c) => {
  const { id } = c.req.param();
  const db = getDb(c.env.DB);

  const [session] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, id))
    .limit(1);

  if (!session) {
    throw new BadRequestError("Session not found");
  }

  if (session.status !== "ongoing" && session.status !== "in_progress") {
    throw new BadRequestError("Can only pause an ongoing or in-progress session");
  }

  const now = nowISO();
  const statusFrom = session.status;
  await db
    .update(classSessions)
    .set({
      status: "paused",
      pausedAt: now,
      updatedAt: now,
    })
    .where(eq(classSessions.id, id));

  await logSessionEvent(db, id, session.staffId!, "pause", statusFrom, "paused", c);

  return c.json({ success: true, serverTime: now });
});

// ─── POST /:id/resume — resume a paused session ──────

classSessionController.post("/:id/resume", async (c) => {
  const { id } = c.req.param();
  const db = getDb(c.env.DB);

  const [session] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, id))
    .limit(1);

  if (!session) {
    throw new BadRequestError("Session not found");
  }

  if (session.status !== "paused" && session.status !== "in_progress") {
    throw new BadRequestError("Can only resume a paused or in-progress session");
  }

  const now = nowISO();
  const statusFrom = session.status;
  const pausedAt = session.pausedAt ? new Date(session.pausedAt).getTime() : Date.now();
  const pauseDuration = session.status === "in_progress" ? 0 : Date.now() - pausedAt;
  const currentTotalPaused = session.totalPausedMs || 0;

  await db
    .update(classSessions)
    .set({
      status: "ongoing",
      pausedAt: null,
      totalPausedMs: currentTotalPaused + pauseDuration,
      updatedAt: now,
    })
    .where(eq(classSessions.id, id));

  await logSessionEvent(db, id, session.staffId!, "resume", statusFrom, "ongoing", c);

  return c.json({ success: true, serverTime: now });
});

// ─── PATCH /:id/complete — explicitly mark session as completed ──

classSessionController.patch("/:id/complete", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const db = getDb(c.env.DB);

  const [session] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, id))
    .limit(1);

  if (!session) {
    throw new BadRequestError("Session not found");
  }

  if (session.status === "completed") {
    // Idempotent: return existing completed session
    const topics = await db
      .select({ topic: classSessionTopics.topic })
      .from(classSessionTopics)
      .where(eq(classSessionTopics.sessionId, id));

    return c.json({
      success: true,
      data: {
        ...session,
        topicsCovered: topics.map((t: any) => t.topic),
      },
      serverTime: nowISO(),
    });
  }

  const now = nowISO();
  let endTime: Date;
  let durationMinutes: number;
  const statusFrom = session.status;

  if (session.status === "ongoing" || session.status === "paused" || session.status === "in_progress") {
    endTime = new Date();
    const startTime = new Date(session.startTime!);
    const pausedMs = session.totalPausedMs || 0;
    // If currently paused, add the current pause duration
    const currentPauseMs = session.pausedAt ? Date.now() - new Date(session.pausedAt).getTime() : 0;
    durationMinutes = Math.round((endTime.getTime() - startTime.getTime() - pausedMs - currentPauseMs) / 60000);
  } else {
    // Already ended somehow
    endTime = session.endTime ? new Date(session.endTime) : new Date();
    durationMinutes = session.durationMinutes || 0;
  }

  await db
    .update(classSessions)
    .set({
      endTime: endTime.toISOString(),
      durationMinutes,
      remarks: body.remarks || session.remarks,
      status: "completed",
      pausedAt: null,
      updatedAt: now,
    })
    .where(eq(classSessions.id, id));

  // Update topics if provided
  if (body.topicsCovered && Array.isArray(body.topicsCovered)) {
    await db.delete(classSessionTopics).where(eq(classSessionTopics.sessionId, id));
    for (const topic of body.topicsCovered) {
      await db.insert(classSessionTopics).values({
        id: uuid(),
        sessionId: id,
        topic,
      });
    }
  }

  await logSessionEvent(db, id, session.staffId!, "complete", statusFrom, "completed", c, {
    durationMinutes,
    remarks: body.remarks || session.remarks,
    topicsCovered: body.topicsCovered,
  });

  const [updated] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, id))
    .limit(1);

  const topics = await db
    .select({ topic: classSessionTopics.topic })
    .from(classSessionTopics)
    .where(eq(classSessionTopics.sessionId, id));

  return c.json({
    success: true,
    data: {
      ...updated,
      topicsCovered: topics.map((t: any) => t.topic),
    },
    serverTime: now,
  });
});

export { classSessionController };
