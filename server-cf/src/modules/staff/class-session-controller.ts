import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { v4 as uuid } from "uuid";
import { nowISO } from "../../lib/utils";
import { eq, and, desc } from "drizzle-orm";
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

  const { staffId, classId, institutionId, courseId } = body;

  // Verify staff belongs to institution
  const [staffRow] = await db
    .select({ id: staff.id, institutionId: staff.institutionId })
    .from(staff)
    .where(eq(staff.id, staffId))
    .limit(1);

  if (!staffRow || staffRow.institutionId !== institutionId) {
    throw new BadRequestError("Invalid Staff or Institution");
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

// ─── GET /my-history — session history for a staff member ─

classSessionController.get("/my-history", async (c) => {
  const staffId = c.req.query("staffId");
  if (!staffId) {
    throw new BadRequestError("Staff ID required");
  }

  const db = getDb(c.env.DB);

  const sessions = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.staffId, staffId))
    .orderBy(desc(classSessions.startTime));

  // Populate class info for each session
  const enriched = await Promise.all(
    sessions.map(async (session) => {
      let classInfo = null;
      if (session.classId) {
        const [cls] = await db
          .select({ id: classes.id, grade: classes.grade, section: classes.section })
          .from(classes)
          .where(eq(classes.id, session.classId))
          .limit(1);
        classInfo = cls || null;
      }

      // Fetch topics for this session
      const topics = await db
        .select({ topic: classSessionTopics.topic })
        .from(classSessionTopics)
        .where(eq(classSessionTopics.sessionId, session.id));

      return {
        ...session,
        classId: classInfo,
        topicsCovered: topics.map((t: any) => t.topic),
      };
    }),
  );

  return c.json({ success: true, data: enriched });
});

export { classSessionController };
