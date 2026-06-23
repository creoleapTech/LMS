import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { v4 as uuid } from "uuid";
import { nowISO } from "../../lib/utils";
import { eq, and, desc, inArray, sql, lt } from "drizzle-orm";
import { adminAuth } from "../../middleware/admin-auth";
import { staff, classes } from "../../schema/admin";
import { classSessions } from "../../schema/staff";
import { classSessionTopics } from "../../schema/junction";
import { BadRequestError } from "../../lib/errors/bad-request";

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
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
    await db
      .update(classSessions)
      .set({
        endTime: endTime.toISOString(),
        durationMinutes,
        remarks: s.remarks || "[auto-closed: stale]",
        status: "completed",
        updatedAt: nowISO(),
      })
      .where(eq(classSessions.id, s.id));
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

  // If there's already an ongoing session for this staff+class, return it
  const [existing] = await db
    .select()
    .from(classSessions)
    .where(and(
      eq(classSessions.staffId, staffId),
      eq(classSessions.classId, classId),
      eq(classSessions.status, "ongoing"),
    ))
    .limit(1);

  if (existing) {
    return c.json({ success: true, data: existing }, 200);
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

  const [session] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, id))
    .limit(1);

  return c.json({ success: true, data: session }, 201);
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
    });
  }

  const endTime = new Date();
  const startTime = new Date(session.startTime!);
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
  const now = nowISO();

  await db
    .update(classSessions)
    .set({
      endTime: endTime.toISOString(),
      durationMinutes,
      remarks: body.remarks,
      status: "completed",
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

  // Batch fetch class info
  const classMap = new Map<string, any>();
  if (classIds.length > 0) {
    const rows = await db
      .select({ id: classes.id, grade: classes.grade, section: classes.section })
      .from(classes)
      .where(inArray(classes.id, classIds));
    for (const r of rows) classMap.set(r.id, r);
  }

  // Batch fetch topics — chunk to avoid D1's 999-variable limit
  const topicsMap = new Map<string, string[]>();
  const CHUNK = 100;
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

  // Batch fetch class info
  const classMap = new Map<string, any>();
  const classIds = [...new Set(sessions.map((s) => s.classId).filter(Boolean))] as string[];
  if (classIds.length > 0) {
    const rows = await db
      .select({ id: classes.id, grade: classes.grade, section: classes.section })
      .from(classes)
      .where(inArray(classes.id, classIds));
    for (const r of rows) classMap.set(r.id, r);
  }

  // Batch fetch staff info (for "all teachers" views)
  const staffMap = new Map<string, any>();
  const staffIds = [...new Set(sessions.map((s) => s.staffId).filter(Boolean))] as string[];
  if (staffIds.length > 0) {
    const rows = await db
      .select({ id: staff.id, name: staff.name, email: staff.email })
      .from(staff)
      .where(inArray(staff.id, staffIds));
    for (const r of rows) staffMap.set(r.id, r);
  }

  // Batch fetch topics — chunk to avoid D1's 999-variable limit
  const topicsMap = new Map<string, string[]>();
  const CHUNK = 100;
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

  return c.json({ success: true, data: enriched });
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
    return c.json({ success: false }, 404);
  }

  // Already completed — no-op
  if (session.status === "completed") {
    return c.json({ success: true });
  }

  const endTime = new Date();
  const startTime = new Date(session.startTime!);
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
  const now = nowISO();

  await db
    .update(classSessions)
    .set({
      endTime: endTime.toISOString(),
      durationMinutes,
      status: "completed",
      remarks: session.remarks || "[auto-closed: tab closed]",
      updatedAt: now,
    })
    .where(eq(classSessions.id, id));

  return c.json({ success: true });
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
    return c.json({ success: false, message: "Session not found" }, 404);
  }

  // No-op if session is already completed — don't error
  if (session.status === "completed") {
    return c.json({ success: true });
  }

  await db
    .update(classSessions)
    .set({ updatedAt: nowISO() })
    .where(eq(classSessions.id, id));

  return c.json({ success: true });
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

export { classSessionController };
