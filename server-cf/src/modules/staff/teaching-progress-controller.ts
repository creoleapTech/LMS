import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { v4 as uuid } from "uuid";
import { nowISO } from "../../lib/utils";
import { eq, and, inArray, sql, count } from "drizzle-orm";
import { adminAuth } from "../../middleware/admin-auth";
import { institutions, classes, students, staff } from "../../schema/admin";
import { gradeBooks, chapters, chapterContents } from "../../schema/books";
import { teachingProgress } from "../../schema/staff";
import {
  institutionCurriculumAccess,
  institutionAccessibleGradebooks,
  teachingProgressContents,
} from "../../schema/junction";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";

const teachingProgressController = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Apply auth to all routes
teachingProgressController.use("*", adminAuth);

// ─── GET /classes/:curriculumId — classes grouped by grade ─

teachingProgressController.get("/classes/:curriculumId", async (c) => {
  const { curriculumId } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  const institutionId = user.institutionId;
  const db = getDb(c.env.DB);

  if (!institutionId) {
    throw new ForbiddenError("No institution associated with this account");
  }

  // 1. Get institution record to verify it exists
  const [inst] = await db
    .select()
    .from(institutions)
    .where(and(eq(institutions.id, institutionId), eq(institutions.isDeleted, 0)))
    .limit(1);

  if (!inst) {
    throw new BadRequestError("Institution not found");
  }

  // 2. Get curriculum access for this institution + curriculum
  const [accessRow] = await db
    .select({ id: institutionCurriculumAccess.id })
    .from(institutionCurriculumAccess)
    .where(
      and(
        eq(institutionCurriculumAccess.institutionId, institutionId),
        eq(institutionCurriculumAccess.curriculumId, curriculumId),
      ),
    )
    .limit(1);

  if (!accessRow) {
    return c.json({ success: true, data: [] });
  }

  // 3. Get accessible gradeBook IDs for this access entry
  const gbAccessRows = await db
    .select({ gradeBookId: institutionAccessibleGradebooks.gradeBookId })
    .from(institutionAccessibleGradebooks)
    .where(eq(institutionAccessibleGradebooks.accessId, accessRow.id));

  if (gbAccessRows.length === 0) {
    return c.json({ success: true, data: [] });
  }

  const accessibleGbIds = gbAccessRows.map((r) => r.gradeBookId);

  // 4. Get gradeBooks to know which grades are available
  const gradeBookRows = await db
    .select({ id: gradeBooks.id, grade: gradeBooks.grade, bookTitle: gradeBooks.bookTitle, coverImage: gradeBooks.coverImage })
    .from(gradeBooks)
    .where(inArray(gradeBooks.id, accessibleGbIds));

  if (gradeBookRows.length === 0) {
    return c.json({ success: true, data: [] });
  }

  // 5. Build a map: grade number -> gradeBook info
  const gradeToBook = new Map<number, { gradeBookId: string; gradeBookTitle: string; coverImage?: string | null }>();
  for (const gb of gradeBookRows) {
    if (gb.grade !== null) {
      gradeToBook.set(gb.grade, {
        gradeBookId: gb.id,
        gradeBookTitle: gb.bookTitle || "",
        coverImage: gb.coverImage,
      });
    }
  }

  // 6. Query classes matching those grades in this institution
  const gradeValues = Array.from(gradeToBook.keys()).map(String);
  const classRows = await db
    .select()
    .from(classes)
    .where(
      and(
        eq(classes.institutionId, institutionId),
        inArray(classes.grade, gradeValues),
        eq(classes.isActive, 1),
        eq(classes.isDeleted, 0),
      ),
    )
    .orderBy(classes.grade, classes.section);

  if (classRows.length === 0) {
    return c.json({ success: true, data: [] });
  }

  // 7. Get student counts per class
  const classIds = classRows.map((cls) => cls.id);
  const studentCountRows = await db
    .select({ classId: students.classId, cnt: count() })
    .from(students)
    .where(and(inArray(students.classId, classIds), eq(students.isDeleted, 0)))
    .groupBy(students.classId);

  const countMap = new Map<string, number>();
  for (const row of studentCountRows) {
    countMap.set(row.classId, row.cnt);
  }

  // 8. Get existing progress summaries for this teacher
  const gbIdList = gradeBookRows.map((gb) => gb.id);
  const progressRows = await db
    .select({
      classId: teachingProgress.classId,
      gradeBookId: teachingProgress.gradeBookId,
      overallPercentage: teachingProgress.overallPercentage,
    })
    .from(teachingProgress)
    .where(
      and(
        eq(teachingProgress.staffId, user.id),
        inArray(teachingProgress.gradeBookId, gbIdList),
        eq(teachingProgress.institutionId, institutionId),
      ),
    );

  const progressMap = new Map<string, number>();
  for (const p of progressRows) {
    progressMap.set(`${p.classId}_${p.gradeBookId}`, p.overallPercentage ?? 0);
  }

  // 9. Group by grade
  const grouped = new Map<
    string,
    {
      grade: string;
      gradeBookId: string;
      gradeBookTitle: string;
      coverImage?: string | null;
      sections: any[];
    }
  >();

  for (const cls of classRows) {
    const grade = cls.grade || "";
    const gradeNum = Number(grade);
    const bookInfo = gradeToBook.get(gradeNum);
    if (!bookInfo) continue;

    if (!grouped.has(grade)) {
      grouped.set(grade, {
        grade,
        gradeBookId: bookInfo.gradeBookId,
        gradeBookTitle: bookInfo.gradeBookTitle,
        coverImage: bookInfo.coverImage,
        sections: [],
      });
    }

    const progressKey = `${cls.id}_${bookInfo.gradeBookId}`;

    grouped.get(grade)!.sections.push({
      classId: cls.id,
      section: cls.section,
      studentCount: countMap.get(cls.id) || 0,
      progressPercentage: progressMap.get(progressKey) || 0,
    });
  }

  // Sort by grade numerically
  const result = Array.from(grouped.values()).sort(
    (a, b) => Number(a.grade) - Number(b.grade),
  );

  return c.json({ success: true, data: result });
});

// ─── GET /:classId/:gradeBookId — teaching progress ─

teachingProgressController.get("/:classId/:gradeBookId", async (c) => {
  const { classId, gradeBookId } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const [progress] = await db
    .select()
    .from(teachingProgress)
    .where(
      and(
        eq(teachingProgress.staffId, user.id),
        eq(teachingProgress.classId, classId),
        eq(teachingProgress.gradeBookId, gradeBookId),
      ),
    )
    .limit(1);

  if (!progress) {
    return c.json({
      success: true,
      data: {
        overallPercentage: 0,
        lastAccessedContentId: null,
        contentProgress: [],
      },
    });
  }

  // Fetch content progress from junction table
  const contentProgressRows = await db
    .select()
    .from(teachingProgressContents)
    .where(eq(teachingProgressContents.teachingProgressId, progress.id));

  return c.json({
    success: true,
    data: {
      overallPercentage: progress.overallPercentage,
      lastAccessedContentId: progress.lastAccessedContentId || null,
      contentProgress: contentProgressRows.map((row) => ({
        contentId: row.contentId,
        chapterId: row.chapterId,
        isCompleted: row.isCompleted === 1,
        completedAt: row.completedAt,
        videoTimestamp: row.videoTimestamp,
        pdfPage: row.pdfPage,
        lastAccessedAt: row.lastAccessedAt,
      })),
    },
  });
});

// ─── PUT /:classId/:gradeBookId/content/:contentId — update content progress ─

teachingProgressController.put("/:classId/:gradeBookId/content/:contentId", async (c) => {
  const { classId, gradeBookId, contentId } = c.req.param();
  const body = await c.req.json();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  // Get the chapter for this content
  const [content] = await db
    .select({ id: chapterContents.id, chapterId: chapterContents.chapterId })
    .from(chapterContents)
    .where(eq(chapterContents.id, contentId))
    .limit(1);

  if (!content) {
    throw new BadRequestError("Content not found");
  }

  const chapterId = content.chapterId;
  const now = nowISO();

  // Check if a teaching progress doc exists
  let [progress] = await db
    .select()
    .from(teachingProgress)
    .where(
      and(
        eq(teachingProgress.staffId, user.id),
        eq(teachingProgress.classId, classId),
        eq(teachingProgress.gradeBookId, gradeBookId),
      ),
    )
    .limit(1);

  if (!progress) {
    // Create the teaching progress record
    const progressId = uuid();
    await db.insert(teachingProgress).values({
      id: progressId,
      staffId: user.id,
      classId,
      gradeBookId,
      institutionId: user.institutionId,
      overallPercentage: 0,
      lastAccessedContentId: contentId,
      lastAccessedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    progress = { id: progressId } as any;
  } else {
    // Update last accessed
    await db
      .update(teachingProgress)
      .set({ lastAccessedContentId: contentId, lastAccessedAt: now, updatedAt: now })
      .where(eq(teachingProgress.id, progress.id));
  }

  // Check if content entry exists in junction table
  const [existingContent] = await db
    .select()
    .from(teachingProgressContents)
    .where(
      and(
        eq(teachingProgressContents.teachingProgressId, progress.id),
        eq(teachingProgressContents.contentId, contentId),
      ),
    )
    .limit(1);

  if (existingContent) {
    // Update existing content entry
    const updates: Record<string, any> = { lastAccessedAt: now };
    if (body.videoTimestamp !== undefined) updates.videoTimestamp = body.videoTimestamp;
    if (body.pdfPage !== undefined) updates.pdfPage = body.pdfPage;
    if (body.isCompleted !== undefined) {
      updates.isCompleted = body.isCompleted ? 1 : 0;
      if (body.isCompleted) updates.completedAt = now;
    }

    await db
      .update(teachingProgressContents)
      .set(updates)
      .where(eq(teachingProgressContents.id, existingContent.id));
  } else {
    // Insert new content entry
    await db.insert(teachingProgressContents).values({
      id: uuid(),
      teachingProgressId: progress.id,
      contentId,
      chapterId,
      isCompleted: body.isCompleted ? 1 : 0,
      completedAt: body.isCompleted ? now : null,
      videoTimestamp: body.videoTimestamp ?? null,
      pdfPage: body.pdfPage ?? null,
      lastAccessedAt: now,
    });
  }

  // Recalculate percentage if completion changed
  if (body.isCompleted !== undefined) {
    await recalculatePercentage(db, progress.id, gradeBookId);
  }

  return c.json({ success: true, data: { updated: true } });
});

// ─── POST /:classId/:gradeBookId/content/:contentId/complete — toggle completion ─

teachingProgressController.post("/:classId/:gradeBookId/content/:contentId/complete", async (c) => {
  const { classId, gradeBookId, contentId } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  // Get the chapter for this content
  const [content] = await db
    .select({ id: chapterContents.id, chapterId: chapterContents.chapterId })
    .from(chapterContents)
    .where(eq(chapterContents.id, contentId))
    .limit(1);

  if (!content) {
    throw new BadRequestError("Content not found");
  }

  const chapterId = content.chapterId;
  const now = nowISO();

  // Check if a teaching progress doc exists
  let [progress] = await db
    .select()
    .from(teachingProgress)
    .where(
      and(
        eq(teachingProgress.staffId, user.id),
        eq(teachingProgress.classId, classId),
        eq(teachingProgress.gradeBookId, gradeBookId),
      ),
    )
    .limit(1);

  if (!progress) {
    // Create the teaching progress record
    const progressId = uuid();
    await db.insert(teachingProgress).values({
      id: progressId,
      staffId: user.id,
      classId,
      gradeBookId,
      institutionId: user.institutionId,
      overallPercentage: 0,
      lastAccessedContentId: contentId,
      lastAccessedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    progress = { id: progressId } as any;
  }

  // Check if content entry exists
  const [existingContent] = await db
    .select()
    .from(teachingProgressContents)
    .where(
      and(
        eq(teachingProgressContents.teachingProgressId, progress.id),
        eq(teachingProgressContents.contentId, contentId),
      ),
    )
    .limit(1);

  let newCompleted: boolean;

  if (existingContent) {
    // Toggle completion
    newCompleted = existingContent.isCompleted !== 1;

    await db
      .update(teachingProgressContents)
      .set({
        isCompleted: newCompleted ? 1 : 0,
        completedAt: newCompleted ? now : null,
        lastAccessedAt: now,
      })
      .where(eq(teachingProgressContents.id, existingContent.id));
  } else {
    // No existing entry -- create with completed=true
    newCompleted = true;

    await db.insert(teachingProgressContents).values({
      id: uuid(),
      teachingProgressId: progress.id,
      contentId,
      chapterId,
      isCompleted: 1,
      completedAt: now,
      lastAccessedAt: now,
    });
  }

  // Update last accessed
  await db
    .update(teachingProgress)
    .set({ lastAccessedContentId: contentId, lastAccessedAt: now, updatedAt: now })
    .where(eq(teachingProgress.id, progress.id));

  // Recalculate percentage
  await recalculatePercentage(db, progress.id, gradeBookId);

  return c.json({ success: true, data: { isCompleted: newCompleted } });
});

// ─── Helper: recalculate overall percentage ────────

async function recalculatePercentage(db: any, progressId: string, gradeBookId: string) {
  // Count total content items in this grade book
  const chapterRows = await db
    .select({ id: chapters.id })
    .from(chapters)
    .where(eq(chapters.gradeBookId, gradeBookId));

  if (chapterRows.length === 0) return;

  const chapterIds = chapterRows.map((ch: any) => ch.id);

  const [totalResult] = await db
    .select({ cnt: count() })
    .from(chapterContents)
    .where(inArray(chapterContents.chapterId, chapterIds));

  const totalContent = totalResult?.cnt || 0;
  if (totalContent === 0) return;

  // Count completed content entries for this progress
  const [completedResult] = await db
    .select({ cnt: count() })
    .from(teachingProgressContents)
    .where(
      and(
        eq(teachingProgressContents.teachingProgressId, progressId),
        eq(teachingProgressContents.isCompleted, 1),
      ),
    );

  const completedCount = completedResult?.cnt || 0;
  const percentage = Math.round((completedCount / totalContent) * 100);

  await db
    .update(teachingProgress)
    .set({ overallPercentage: percentage })
    .where(eq(teachingProgress.id, progressId));
}

export { teachingProgressController };
