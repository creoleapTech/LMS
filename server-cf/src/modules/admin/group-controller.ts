import { Hono } from "hono";
import { z } from "zod";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { v4 as uuid } from "uuid";
import { nowISO } from "../../lib/utils";
import { eq, and, like, or, count, inArray, sql } from "drizzle-orm";
import { adminAuth } from "../../middleware/admin-auth";
import {
  classes,
  students,
  institutions,
  studentGroups,
} from "../../schema/admin";
import { studentGroupMembers } from "../../schema/junction";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";

const groupController = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Apply auth to all routes
groupController.use("*", adminAuth);

function requireGroupWriteAccess(user: Record<string, any>): void {
  if (!["super_admin", "admin", "teacher"].includes(user.role)) {
    throw new ForbiddenError("Access denied. Only super admin, admin and teachers can manage groups");
  }
}

function resolveUserInstitutionId(user: Record<string, any>): string | undefined {
  const raw = (user as any)?.institutionId;
  if (!raw) return undefined;
  if (typeof raw === "object") return raw._id ?? raw.id;
  return String(raw);
}

async function assertClassAccess(
  db: any,
  user: Record<string, any>,
  classId: string,
) {
  const [classData] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.isDeleted, 0)))
    .limit(1);

  if (!classData) {
    throw new BadRequestError("Class not found");
  }

  if (user.role !== "super_admin") {
    const userInstId = resolveUserInstitutionId(user);
    if (!userInstId || classData.institutionId !== userInstId) {
      throw new ForbiddenError("Access denied");
    }
  }

  return classData;
}

async function validateStudentIdsForClass(
  db: any,
  studentIds: string[],
  classData: { id: string; institutionId: string },
) {
  const uniqueIds = [...new Set(studentIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  // Fetch in chunks to stay within D1 variable limits
  const found: any[] = [];
  for (let i = 0; i < uniqueIds.length; i += 40) {
    const chunkIds = uniqueIds.slice(i, i + 40);
    const rows = await db
      .select({
        id: students.id,
        name: students.name,
        classId: students.classId,
        institutionId: students.institutionId,
        isDeleted: students.isDeleted,
      })
      .from(students)
      .where(inArray(students.id, chunkIds));
    found.push(...rows);
  }

  const foundMap = new Map(found.map((s: any) => [s.id, s]));
  const invalid: string[] = [];

  for (const sid of uniqueIds) {
    const s = foundMap.get(sid);
    if (!s || s.isDeleted === 1) {
      invalid.push(sid);
      continue;
    }
    if (s.classId !== classData.id) {
      throw new BadRequestError(
        `Student "${s.name || sid}" does not belong to this class-section. Only students from the same class can be added to the group.`,
      );
    }
    if (s.institutionId !== classData.institutionId) {
      throw new BadRequestError(
        `Student "${s.name || sid}" does not belong to this institution.`,
      );
    }
  }

  if (invalid.length > 0) {
    throw new BadRequestError("One or more selected students were not found");
  }

  return uniqueIds;
}

async function fetchMembersForGroups(db: any, groupIds: string[]) {
  if (groupIds.length === 0) return new Map<string, any[]>();

  const memberRows: any[] = [];
  for (let i = 0; i < groupIds.length; i += 40) {
    const chunkIds = groupIds.slice(i, i + 40);
    const rows = await db
      .select({
        groupId: studentGroupMembers.groupId,
        studentId: studentGroupMembers.studentId,
        addedAt: studentGroupMembers.addedAt,
        studentName: students.name,
        rollNumber: students.rollNumber,
        username: students.username,
        admissionNumber: students.admissionNumber,
      })
      .from(studentGroupMembers)
      .leftJoin(students, eq(studentGroupMembers.studentId, students.id))
      .where(inArray(studentGroupMembers.groupId, chunkIds));
    memberRows.push(...rows);
  }

  const map = new Map<string, any[]>();
  for (const r of memberRows) {
    const list = map.get(r.groupId) ?? [];
    list.push({
      _id: r.studentId,
      id: r.studentId,
      name: r.studentName,
      rollNumber: r.rollNumber || r.username || "",
      admissionNumber: r.admissionNumber || "",
      addedAt: r.addedAt,
    });
    map.set(r.groupId, list);
  }
  return map;
}

function buildLeader(members: any[], leaderId: string | null | undefined) {
  if (!leaderId) return null;
  return members.find((m: any) => m._id === leaderId) ?? null;
}

async function getGroupMemberIds(db: any, groupId: string): Promise<string[]> {
  const rows = await db
    .select({ studentId: studentGroupMembers.studentId })
    .from(studentGroupMembers)
    .where(eq(studentGroupMembers.groupId, groupId));
  return rows.map((r: any) => r.studentId as string);
}

async function fetchClassById(db: any, classId: string) {
  const [classData] = await db
    .select()
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);
  if (!classData) throw new BadRequestError("Class not found for this group");
  return classData;
}

// Validate a leader candidate (must be a student of the group's class)
// and ensure they are a member of the group (auto-added if missing).
async function setGroupLeader(
  db: any,
  group: { id: string; classId: string },
  studentId: string,
) {
  const classData = await fetchClassById(db, group.classId);
  await validateStudentIdsForClass(db, [studentId], classData);

  const now = nowISO();
  const existing = await db
    .select({ studentId: studentGroupMembers.studentId })
    .from(studentGroupMembers)
    .where(
      and(
        eq(studentGroupMembers.groupId, group.id),
        eq(studentGroupMembers.studentId, studentId),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(studentGroupMembers).values({
      id: uuid(),
      groupId: group.id,
      studentId,
      addedAt: now,
    });
  }

  await db
    .update(studentGroups)
    .set({ leaderId: studentId, updatedAt: now })
    .where(eq(studentGroups.id, group.id));

  return now;
}

const groupCreateSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(100, "Group name too long"),
  description: z.string().trim().max(500, "Description too long").optional().nullable().or(z.literal("")),
  classId: z.string().min(1, "Class is required"),
  institutionId: z.string().optional(),
  studentIds: z.array(z.string().min(1)).max(200, "Too many students selected").optional().default([]),
  leaderId: z.string().min(1, "Invalid leader").optional().nullable().or(z.literal("")),
});

// ─── CREATE Group ──────────────────────────────────
groupController.post("/", async (c) => {
  const user = c.get("user") as Record<string, any>;
  requireGroupWriteAccess(user);
  const db = getDb(c.env.DB);

  const body = await c.req.json();
  const parsed = groupCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const classData = await assertClassAccess(db, user, parsed.data.classId);

  if (parsed.data.institutionId && parsed.data.institutionId !== classData.institutionId) {
    throw new BadRequestError("Class does not belong to the given institution");
  }

  // Duplicate name check within same class (case-insensitive)
  const normalized = parsed.data.name.trim().toLowerCase();
  const siblings = await db
    .select({ id: studentGroups.id, name: studentGroups.name })
    .from(studentGroups)
    .where(and(eq(studentGroups.classId, classData.id), eq(studentGroups.isDeleted, 0)));

  if (siblings.some((g: any) => (g.name || "").trim().toLowerCase() === normalized)) {
    throw new BadRequestError(
      `A group named "${parsed.data.name.trim()}" already exists in this class-section`,
    );
  }

  const validatedStudentIds = await validateStudentIdsForClass(db, parsed.data.studentIds ?? [], classData);

  // Resolve leader (must be a student of the same class-section).
  // Auto-included in the group if not among the selected students.
  let leaderId: string | null = null;
  if (parsed.data.leaderId) {
    const validatedLeader = await validateStudentIdsForClass(db, [parsed.data.leaderId], classData);
    leaderId = validatedLeader[0] ?? null;
  }

  let memberIds = validatedStudentIds;
  if (leaderId && !memberIds.includes(leaderId)) {
    memberIds = [...memberIds, leaderId];
  }

  const groupId = uuid();
  const now = nowISO();

  const [created] = await db
    .insert(studentGroups)
    .values({
      id: groupId,
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
      classId: classData.id,
      institutionId: classData.institutionId,
      leaderId,
      createdBy: (user as any)?.id ?? (user as any)?._id ?? null,
      isActive: 1,
      isDeleted: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (memberIds.length > 0) {
    const memberValues = memberIds.map((sid) => ({
      id: uuid(),
      groupId,
      studentId: sid,
      addedAt: now,
    }));
    for (let i = 0; i < memberValues.length; i += 30) {
      await db.insert(studentGroupMembers).values(memberValues.slice(i, i + 30));
    }
  }

  const membersMap = await fetchMembersForGroups(db, [groupId]);
  const members = membersMap.get(groupId) ?? [];

  return c.json(
    {
      success: true,
      data: {
        ...created,
        _id: created.id,
        memberCount: members.length,
        members,
        leader: buildLeader(members, leaderId),
      },
    },
    201,
  );
});

// ─── GET All Groups ────────────────────────────────
groupController.get("/", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const institutionId = c.req.query("institutionId");
  const classId = c.req.query("classId");
  const search = c.req.query("search")?.trim();
  const isActiveParam = c.req.query("isActive");
  const rawPage = parseInt(c.req.query("page") || "1", 10);
  const page = Number.isNaN(rawPage) ? 1 : Math.max(1, rawPage);
  const rawLimit = parseInt(c.req.query("limit") || "50", 10);
  const limit = Number.isNaN(rawLimit) ? 50 : Math.max(1, Math.min(100, rawLimit));
  const offset = (page - 1) * limit;

  const conditions: any[] = [eq(studentGroups.isDeleted, 0)];

  if (institutionId) {
    conditions.push(eq(studentGroups.institutionId, institutionId));
  } else if (user.role !== "super_admin") {
    const userInstId = resolveUserInstitutionId(user);
    if (userInstId) conditions.push(eq(studentGroups.institutionId, userInstId));
  }

  if (classId) {
    conditions.push(eq(studentGroups.classId, classId));
  }

  if (isActiveParam === "1" || isActiveParam === "0") {
    conditions.push(eq(studentGroups.isActive, Number(isActiveParam)));
  }

  if (search) {
    conditions.push(
      or(
        like(studentGroups.name, `%${search}%`),
        like(studentGroups.description, `%${search}%`),
      ),
    );
  }

  // Institution isolation: non-super-admins can only see their own institution
  if (user.role !== "super_admin" && !institutionId && !resolveUserInstitutionId(user)) {
    return c.json({ success: true, data: [], pagination: { total: 0, page, limit, pages: 0 } }, 200);
  }

  const [countRow] = await db
    .select({ count: count() })
    .from(studentGroups)
    .where(and(...conditions));
  const total = countRow?.count ?? 0;

  const groupRows = await db
    .select()
    .from(studentGroups)
    .where(and(...conditions))
    .orderBy(sql`${studentGroups.updatedAt} DESC`)
    .limit(limit)
    .offset(offset);

  const groupIds = groupRows.map((g: any) => g.id);
  const classIds = [...new Set(groupRows.map((g: any) => g.classId).filter(Boolean))];
  const institutionIds = [...new Set(groupRows.map((g: any) => g.institutionId).filter(Boolean))];

  const classMap = new Map<string, any>();
  if (classIds.length > 0) {
    for (let i = 0; i < classIds.length; i += 40) {
      const chunkIds = classIds.slice(i, i + 40);
      const rows = await db
        .select({ id: classes.id, grade: classes.grade, section: classes.section, year: classes.year })
        .from(classes)
        .where(inArray(classes.id, chunkIds as string[]));
      for (const r of rows) classMap.set(r.id, r);
    }
  }

  const institutionMap = new Map<string, any>();
  if (institutionIds.length > 0) {
    for (let i = 0; i < institutionIds.length; i += 40) {
      const chunkIds = institutionIds.slice(i, i + 40);
      const rows = await db
        .select({ id: institutions.id, name: institutions.name })
        .from(institutions)
        .where(inArray(institutions.id, chunkIds as string[]));
      for (const r of rows) institutionMap.set(r.id, r);
    }
  }

  const membersMap = await fetchMembersForGroups(db, groupIds);

  const enriched = groupRows.map((g: any) => {
    const members = membersMap.get(g.id) ?? [];
    const cls = classMap.get(g.classId);
    const inst = institutionMap.get(g.institutionId);
    return {
      ...g,
      _id: g.id,
      classId: cls ? { ...cls, _id: cls.id } : g.classId,
      institutionId: inst ? { ...inst, _id: inst.id } : g.institutionId,
      members,
      memberCount: members.length,
      leader: buildLeader(members, g.leaderId),
    };
  });

  return c.json(
    { success: true, data: enriched, pagination: { total, page, limit, pages: Math.ceil(total / limit) } },
    200,
  );
});

// ─── GET Single Group ──────────────────────────────
groupController.get("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const [group] = await db
    .select()
    .from(studentGroups)
    .where(and(eq(studentGroups.id, id), eq(studentGroups.isDeleted, 0)))
    .limit(1);

  if (!group) {
    throw new BadRequestError("Group not found");
  }

  if (user.role !== "super_admin" && group.institutionId !== resolveUserInstitutionId(user)) {
    throw new ForbiddenError("Access denied");
  }

  const [cls] = group.classId
    ? await db
        .select({ id: classes.id, grade: classes.grade, section: classes.section, year: classes.year })
        .from(classes)
        .where(eq(classes.id, group.classId))
        .limit(1)
    : [null];

  const [inst] = group.institutionId
    ? await db
        .select({ id: institutions.id, name: institutions.name })
        .from(institutions)
        .where(eq(institutions.id, group.institutionId))
        .limit(1)
    : [null];

  const membersMap = await fetchMembersForGroups(db, [group.id]);
  const members = membersMap.get(group.id) ?? [];

  return c.json(
    {
      success: true,
      data: {
        ...group,
        _id: group.id,
        classId: cls ? { ...cls, _id: cls.id } : group.classId,
        institutionId: inst ? { ...inst, _id: inst.id } : group.institutionId,
        members,
        memberCount: members.length,
        leader: buildLeader(members, (group as any).leaderId),
      },
    },
    200,
  );
});

// ─── UPDATE Group ──────────────────────────────────
const groupUpdateSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(100, "Group name too long").optional(),
  description: z.string().trim().max(500, "Description too long").optional().nullable().or(z.literal("")),
  isActive: z.union([z.literal(1), z.literal(0)]).optional(),
  studentIds: z.array(z.string().min(1)).max(200, "Too many students selected").optional(),
  leaderId: z.string().min(1, "Invalid leader").optional().nullable().or(z.literal("")),
});

groupController.patch("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  requireGroupWriteAccess(user);
  const db = getDb(c.env.DB);

  const [group] = await db
    .select()
    .from(studentGroups)
    .where(and(eq(studentGroups.id, id), eq(studentGroups.isDeleted, 0)))
    .limit(1);

  if (!group) {
    throw new BadRequestError("Group not found");
  }

  if (user.role !== "super_admin" && group.institutionId !== resolveUserInstitutionId(user)) {
    throw new ForbiddenError("Access denied");
  }

  const body = await c.req.json();
  const parsed = groupUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(", "));
  }

  // Duplicate name check within same class
  if (parsed.data.name && parsed.data.name.trim().toLowerCase() !== (group.name || "").trim().toLowerCase()) {
    const normalized = parsed.data.name.trim().toLowerCase();
    const siblings = await db
      .select({ id: studentGroups.id, name: studentGroups.name })
      .from(studentGroups)
      .where(and(eq(studentGroups.classId, group.classId), eq(studentGroups.isDeleted, 0)));
    if (siblings.some((g: any) => g.id !== group.id && (g.name || "").trim().toLowerCase() === normalized)) {
      throw new BadRequestError(`A group named "${parsed.data.name.trim()}" already exists in this class-section`);
    }
  }

  const updateData: Record<string, any> = { updatedAt: nowISO() };
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description?.trim() || null;
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

  // Replace membership if studentIds provided
  let finalMemberIds: string[] | null = null;
  if (parsed.data.studentIds !== undefined) {
    const classData = await fetchClassById(db, group.classId);

    const validated = await validateStudentIdsForClass(db, parsed.data.studentIds, classData);

    // Delete existing members
    await db.delete(studentGroupMembers).where(eq(studentGroupMembers.groupId, id));

    if (validated.length > 0) {
      const now = nowISO();
      const memberValues = validated.map((sid) => ({
        id: uuid(),
        groupId: id,
        studentId: sid,
        addedAt: now,
      }));
      for (let i = 0; i < memberValues.length; i += 30) {
        await db.insert(studentGroupMembers).values(memberValues.slice(i, i + 30));
      }
    }

    finalMemberIds = validated;
  }

  // Resolve leader intent:
  // - leaderId provided (id) → set (must be a group member afterwards)
  // - leaderId null/"" → clear
  // - leaderId omitted + membership replaced + current leader dropped → auto-clear
  if (parsed.data.leaderId !== undefined) {
    const raw = parsed.data.leaderId;
    if (raw) {
      const classData = await fetchClassById(db, group.classId);
      await validateStudentIdsForClass(db, [raw], classData);
      const pool = finalMemberIds ?? (await getGroupMemberIds(db, id));
      if (!pool.includes(raw)) {
        throw new BadRequestError("Group leader must be one of the group's students. Add the student to the group first.");
      }
      updateData.leaderId = raw;
    } else {
      updateData.leaderId = null;
    }
  } else if (
    finalMemberIds !== null &&
    (group as any).leaderId &&
    !finalMemberIds.includes((group as any).leaderId)
  ) {
    updateData.leaderId = null;
  }

  await db.update(studentGroups).set(updateData).where(eq(studentGroups.id, id));

  const [updated] = await db
    .select()
    .from(studentGroups)
    .where(eq(studentGroups.id, id))
    .limit(1);

  const membersMap = await fetchMembersForGroups(db, [id]);
  const updatedMembers = membersMap.get(id) ?? [];

  return c.json(
    {
      success: true,
      data: {
        ...updated,
        _id: updated.id,
        members: updatedMembers,
        memberCount: updatedMembers.length,
        leader: buildLeader(updatedMembers, (updated as any).leaderId),
      },
    },
    200,
  );
});

// ─── DELETE Group (Soft Delete) ────────────────────
groupController.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  requireGroupWriteAccess(user);
  const db = getDb(c.env.DB);

  const [group] = await db
    .select()
    .from(studentGroups)
    .where(and(eq(studentGroups.id, id), eq(studentGroups.isDeleted, 0)))
    .limit(1);

  if (!group) {
    throw new BadRequestError("Group not found");
  }

  if (user.role !== "super_admin" && group.institutionId !== resolveUserInstitutionId(user)) {
    throw new ForbiddenError("Access denied");
  }

  await db
    .update(studentGroups)
    .set({ isDeleted: 1, isActive: 0, updatedAt: nowISO() })
    .where(eq(studentGroups.id, id));

  await db.delete(studentGroupMembers).where(eq(studentGroupMembers.groupId, id));

  return c.json({ success: true, message: "Group deleted successfully" }, 200);
});

// ─── ADD Members ───────────────────────────────────
groupController.post("/:id/members", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  requireGroupWriteAccess(user);
  const db = getDb(c.env.DB);

  const [group] = await db
    .select()
    .from(studentGroups)
    .where(and(eq(studentGroups.id, id), eq(studentGroups.isDeleted, 0)))
    .limit(1);

  if (!group) throw new BadRequestError("Group not found");
  if (user.role !== "super_admin" && group.institutionId !== resolveUserInstitutionId(user)) {
    throw new ForbiddenError("Access denied");
  }

  const body = await c.req.json<{ studentIds: string[] }>();
  const studentIds = Array.isArray(body?.studentIds) ? body.studentIds : [];
  if (studentIds.length === 0) throw new BadRequestError("studentIds is required");

  const [classData] = await db
    .select()
    .from(classes)
    .where(eq(classes.id, group.classId))
    .limit(1);
  if (!classData) throw new BadRequestError("Class not found for this group");

  const validated = await validateStudentIdsForClass(db, studentIds, classData);

  const existing = await db
    .select({ studentId: studentGroupMembers.studentId })
    .from(studentGroupMembers)
    .where(eq(studentGroupMembers.groupId, id));
  const existingSet = new Set(existing.map((e: any) => e.studentId));
  const toAdd = validated.filter((sid) => !existingSet.has(sid));

  if (toAdd.length > 0) {
    const now = nowISO();
    const values = toAdd.map((sid) => ({ id: uuid(), groupId: id, studentId: sid, addedAt: now }));
    for (let i = 0; i < values.length; i += 30) {
      await db.insert(studentGroupMembers).values(values.slice(i, i + 30));
    }
    await db.update(studentGroups).set({ updatedAt: now }).where(eq(studentGroups.id, id));
  }

  const membersMap = await fetchMembersForGroups(db, [id]);
  return c.json(
    { success: true, data: { members: membersMap.get(id) ?? [], memberCount: (membersMap.get(id) ?? []).length } },
    200,
  );
});

// ─── REMOVE Member ─────────────────────────────────
groupController.delete("/:id/members/:studentId", async (c) => {
  const { id, studentId } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  requireGroupWriteAccess(user);
  const db = getDb(c.env.DB);

  const [group] = await db
    .select()
    .from(studentGroups)
    .where(and(eq(studentGroups.id, id), eq(studentGroups.isDeleted, 0)))
    .limit(1);

  if (!group) throw new BadRequestError("Group not found");
  if (user.role !== "super_admin" && group.institutionId !== resolveUserInstitutionId(user)) {
    throw new ForbiddenError("Access denied");
  }

  await db
    .delete(studentGroupMembers)
    .where(and(eq(studentGroupMembers.groupId, id), eq(studentGroupMembers.studentId, studentId)));

  // If the removed student was the leader, clear leadership
  const leaderUpdate: Record<string, any> = { updatedAt: nowISO() };
  if ((group as any).leaderId && (group as any).leaderId === studentId) {
    leaderUpdate.leaderId = null;
  }
  await db.update(studentGroups).set(leaderUpdate).where(eq(studentGroups.id, id));

  return c.json({ success: true, message: "Student removed from group" }, 200);
});

// ─── SET Group Leader ──────────────────────────────
groupController.patch("/:id/leader", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  requireGroupWriteAccess(user);
  const db = getDb(c.env.DB);

  const [group] = await db
    .select()
    .from(studentGroups)
    .where(and(eq(studentGroups.id, id), eq(studentGroups.isDeleted, 0)))
    .limit(1);

  if (!group) throw new BadRequestError("Group not found");
  if (user.role !== "super_admin" && group.institutionId !== resolveUserInstitutionId(user)) {
    throw new ForbiddenError("Access denied");
  }

  const body = await c.req.json<{ studentId?: string }>();
  const studentId = body?.studentId?.trim();
  if (!studentId) throw new BadRequestError("studentId is required");

  await setGroupLeader(db, group as { id: string; classId: string }, studentId);

  const membersMap = await fetchMembersForGroups(db, [id]);
  const members = membersMap.get(id) ?? [];

  return c.json(
    {
      success: true,
      message: "Group leader assigned",
      data: { members, memberCount: members.length, leader: buildLeader(members, studentId) },
    },
    200,
  );
});

// ─── CLEAR Group Leader ────────────────────────────
groupController.delete("/:id/leader", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  requireGroupWriteAccess(user);
  const db = getDb(c.env.DB);

  const [group] = await db
    .select()
    .from(studentGroups)
    .where(and(eq(studentGroups.id, id), eq(studentGroups.isDeleted, 0)))
    .limit(1);

  if (!group) throw new BadRequestError("Group not found");
  if (user.role !== "super_admin" && group.institutionId !== resolveUserInstitutionId(user)) {
    throw new ForbiddenError("Access denied");
  }

  await db
    .update(studentGroups)
    .set({ leaderId: null, updatedAt: nowISO() })
    .where(eq(studentGroups.id, id));

  return c.json({ success: true, message: "Group leader removed" }, 200);
});

export { groupController };
