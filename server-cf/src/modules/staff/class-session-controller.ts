import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { v4 as uuid } from "uuid";
import { nowISO } from "../../lib/utils";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { adminAuth } from "../../middleware/admin-auth";
import { staff, classes } from "../../schema/admin";
import { classSessions } from "../../schema/staff";
import { classSessionTopics } from "../../schema/junction";
import { BadRequestError } from "../../lib/errors/bad-request";

const classSessionController = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Apply auth to all routes
classSessionController.use("*", adminAuth);

// ─── POST /start — start a class session ──────────

classSessionController.post("/start", async (c) => {
  const body = await c.req.json();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const { classId, courseId } = body;
  // Use staffId and institutionId from the auth token — don't trust body for these
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
    throw new BadRequestError("Session already completed");
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
    const d = new Date(date);
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);

    sessions = await db
      .select()
      .from(classSessions)
      .where(
        and(
          eq(classSessions.staffId, staffId),
          sql`${classSessions.startTime} >= ${dayStart.toISOString()}`,
          sql`${classSessions.startTime} <= ${dayEnd.toISOString()}`,
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

  // Batch fetch topics
  const topicsMap = new Map<string, string[]>();
  if (sessionIds.length > 0) {
    const rows = await db
      .select({ sessionId: classSessionTopics.sessionId, topic: classSessionTopics.topic })
      .from(classSessionTopics)
      .where(inArray(classSessionTopics.sessionId, sessionIds));
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

classSessionController.get("/diary", async (c) => {
  const staffId = c.req.query("staffId");
  const fromDate = c.req.query("fromDate");
  const toDate = c.req.query("toDate");
  if (!staffId) {
    throw new BadRequestError("Staff ID required");
  }

  const db = getDb(c.env.DB);

  const conditions: any[] = [eq(classSessions.staffId, staffId)];
  if (fromDate) {
    conditions.push(sql`${classSessions.startTime} >= ${new Date(fromDate).toISOString()}`);
  }
  if (toDate) {
    const d = new Date(toDate);
    d.setHours(23, 59, 59, 999);
    conditions.push(sql`${classSessions.startTime} <= ${d.toISOString()}`);
  }

  const sessions = await db
    .select()
    .from(classSessions)
    .where(and(...conditions))
    .orderBy(desc(classSessions.startTime));

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

  // Batch fetch topics
  const topicsMap = new Map<string, string[]>();
  if (sessionIds.length > 0) {
    const rows = await db
      .select({ sessionId: classSessionTopics.sessionId, topic: classSessionTopics.topic })
      .from(classSessionTopics)
      .where(inArray(classSessionTopics.sessionId, sessionIds));
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

export { classSessionController };
