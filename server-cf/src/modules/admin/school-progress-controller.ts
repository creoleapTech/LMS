import { Hono } from "hono";
import { eq, and, sql, count, inArray } from "drizzle-orm";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { institutions, staff, classes, students } from "../../schema/admin";
import { curricula, gradeBooks, chapters, chapterContents } from "../../schema/books";
import { teachingProgress } from "../../schema/staff";
import {
  institutionCurriculumAccess,
  institutionAccessibleGradebooks,
  classTeacherIds,
  teachingProgressContents,
  classStudentIds,
} from "../../schema/junction";
import { adminAuth } from "../../middleware/admin-auth";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", adminAuth);

// HELPER: Fetch curriculum gradebook-to-grade matching for an institution
async function getInstGradeToBook(db: any, institutionId: string) {
  const allAccess = await db
    .select({
      institutionId: institutionCurriculumAccess.institutionId,
      gradeBookId: institutionAccessibleGradebooks.gradeBookId,
    })
    .from(institutionCurriculumAccess)
    .innerJoin(
      institutionAccessibleGradebooks,
      eq(institutionAccessibleGradebooks.accessId, institutionCurriculumAccess.id),
    )
    .where(eq(institutionCurriculumAccess.institutionId, institutionId));

  const gradeBookIds = allAccess.map((a: any) => a.gradeBookId);
  if (gradeBookIds.length === 0) return new Map<number, string>();

  const gradeBookRows = await db
    .select({ id: gradeBooks.id, grade: gradeBooks.grade })
    .from(gradeBooks)
    .where(inArray(gradeBooks.id, gradeBookIds));

  const gradeMap = new Map<number, string>();
  for (const gb of gradeBookRows) {
    if (gb.grade !== null) gradeMap.set(gb.grade, gb.id);
  }
  return gradeMap;
}

// 1. GET /schools — Overview list of schools
app.get("/schools", async (c) => {
  const db = getDb(c.env.DB);

  // Get active institutions
  const insts = await db
    .select({ id: institutions.id, name: institutions.name, isActive: institutions.isActive })
    .from(institutions)
    .where(eq(institutions.isDeleted, 0));

  // Get count details
  const activeClasses = await db
    .select({ id: classes.id, institutionId: classes.institutionId, grade: classes.grade })
    .from(classes)
    .where(and(eq(classes.isDeleted, 0), eq(classes.isActive, 1)));

  const activeStudents = await db
    .select({ institutionId: students.institutionId, c: count() })
    .from(students)
    .where(and(eq(students.isDeleted, 0), eq(students.isActive, 1)))
    .groupBy(students.institutionId);

  const activeStaff = await db
    .select({ institutionId: staff.institutionId, c: count() })
    .from(staff)
    .where(and(eq(staff.isDeleted, 0), eq(staff.isActive, 1)))
    .groupBy(staff.institutionId);

  // Content counts per gradebook
  const gbContentCounts = await db
    .select({ gradeBookId: chapters.gradeBookId, cnt: count() })
    .from(chapterContents)
    .innerJoin(chapters, eq(chapters.id, chapterContents.chapterId))
    .groupBy(chapters.gradeBookId);

  const gbContentMap = new Map<string, number>();
  for (const row of gbContentCounts) {
    gbContentMap.set(row.gradeBookId, row.cnt);
  }

  // Get all teaching progress records to resolve precise class-to-gradebook mapping
  const allProgress = await db
    .select({ classId: teachingProgress.classId, gradeBookId: teachingProgress.gradeBookId })
    .from(teachingProgress);

  const classProgressGbMap = new Map<string, string>();
  for (const p of allProgress) {
    if (p.classId && p.gradeBookId) {
      classProgressGbMap.set(p.classId, p.gradeBookId);
    }
  }

  // Completed and in-progress content counts per class-gradebook
  const completedCounts = await db
    .select({
      institutionId: teachingProgress.institutionId,
      classId: teachingProgress.classId,
      gradeBookId: teachingProgress.gradeBookId,
      cnt: count(),
    })
    .from(teachingProgressContents)
    .innerJoin(teachingProgress, eq(teachingProgress.id, teachingProgressContents.teachingProgressId))
    .groupBy(teachingProgress.institutionId, teachingProgress.classId, teachingProgress.gradeBookId);

  const completedMap = new Map<string, number>();
  for (const row of completedCounts) {
    if (row.classId && row.gradeBookId) {
      completedMap.set(`${row.classId}_${row.gradeBookId}`, row.cnt);
    }
  }

  // Curriculum mapping cache
  const allAccess = await db
    .select({
      institutionId: institutionCurriculumAccess.institutionId,
      gradeBookId: institutionAccessibleGradebooks.gradeBookId,
    })
    .from(institutionCurriculumAccess)
    .innerJoin(
      institutionAccessibleGradebooks,
      eq(institutionAccessibleGradebooks.accessId, institutionCurriculumAccess.id),
    );

  const gradeBookRows = await db
    .select({ id: gradeBooks.id, grade: gradeBooks.grade })
    .from(gradeBooks);

  const instGradeToBookMap = new Map<string, Map<number, string>>();
  for (const acc of allAccess) {
    if (!instGradeToBookMap.has(acc.institutionId)) {
      instGradeToBookMap.set(acc.institutionId, new Map());
    }
    const gb = gradeBookRows.find((g) => g.id === acc.gradeBookId);
    if (gb && gb.grade !== null) {
      instGradeToBookMap.get(acc.institutionId)!.set(gb.grade, gb.id);
    }
  }

  const studentCountMap = new Map(activeStudents.map((s) => [s.institutionId, s.c]));
  const staffCountMap = new Map(activeStaff.map((s) => [s.institutionId, s.c]));

  const result = insts.map((inst) => {
    const instClasses = activeClasses.filter((c) => c.institutionId === inst.id);
    const gradeMap = instGradeToBookMap.get(inst.id);

    let total = 0;
    let completed = 0;

    for (const cls of instClasses) {
      let gbId = classProgressGbMap.get(cls.id);
      if (!gbId && cls.grade && gradeMap) {
        gbId = gradeMap.get(Number(cls.grade));
      }
      if (gbId) {
        total += gbContentMap.get(gbId) || 0;
        completed += completedMap.get(`${cls.id}_${gbId}`) || 0;
      }
    }

    return {
      id: inst.id,
      name: inst.name,
      isActive: inst.isActive,
      studentsCount: studentCountMap.get(inst.id) || 0,
      staffCount: staffCountMap.get(inst.id) || 0,
      classesCount: instClasses.length,
      completionRate: total > 0 ? Number(((completed / total) * 100).toFixed(2)) : 0,
    };
  });

  return c.json({ success: true, data: result });
});

// 2. GET /kpis — KPI cards statistics for single institution
app.get("/kpis", async (c) => {
  const db = getDb(c.env.DB);
  const institutionId = c.req.query("institutionId");

  if (!institutionId) {
    return c.json({ success: false, message: "Missing institutionId query parameter" }, 400);
  }

  const instClasses = await db
    .select({ id: classes.id, grade: classes.grade })
    .from(classes)
    .where(and(eq(classes.institutionId, institutionId), eq(classes.isDeleted, 0), eq(classes.isActive, 1)));

  const gradeMap = await getInstGradeToBook(db, institutionId);

  // Content counts per gradebook
  const gbContentCounts = await db
    .select({ gradeBookId: chapters.gradeBookId, cnt: count() })
    .from(chapterContents)
    .innerJoin(chapters, eq(chapters.id, chapterContents.chapterId))
    .groupBy(chapters.gradeBookId);

  const gbContentMap = new Map<string, number>();
  for (const row of gbContentCounts) {
    gbContentMap.set(row.gradeBookId, row.cnt);
  }

  // Progress records for the institution
  const progressRows = await db
    .select({ id: teachingProgress.id, classId: teachingProgress.classId, gradeBookId: teachingProgress.gradeBookId, overallPercentage: teachingProgress.overallPercentage })
    .from(teachingProgress)
    .where(eq(teachingProgress.institutionId, institutionId));

  const classProgressGbMap = new Map<string, string>();
  const progressKeyMap = new Map<string, any>();
  for (const pr of progressRows) {
    if (pr.classId && pr.gradeBookId) {
      classProgressGbMap.set(pr.classId, pr.gradeBookId);
      progressKeyMap.set(`${pr.classId}_${pr.gradeBookId}`, pr);
    }
  }

  let totalClasses = 0;
  let ongoingClasses = 0;
  let completedClasses = 0;
  let totalSubchapters = 0;
  let completedSubchapters = 0;

  for (const cls of instClasses) {
    let gbId = classProgressGbMap.get(cls.id);
    if (!gbId && cls.grade) {
      gbId = gradeMap.get(Number(cls.grade));
    }
    if (!gbId) continue;

    totalClasses++;
    const total = gbContentMap.get(gbId) || 0;
    totalSubchapters += total;

    const pr = progressKeyMap.get(`${cls.id}_${gbId}`);
    if (pr) {
      const percentage = pr.overallPercentage || 0;
      if (percentage === 100) {
        completedClasses++;
      } else if (percentage > 0) {
        ongoingClasses++;
      }
      completedSubchapters += (percentage / 100) * total;
    }
  }

  return c.json({
    success: true,
    data: {
      totalClasses,
      ongoingClasses,
      completedClasses,
      overallCompletionRate: totalSubchapters > 0 ? Number(((completedSubchapters / totalSubchapters) * 100).toFixed(2)) : 0,
    },
  });
});

// 3. GET /charts — Charts data for single institution
app.get("/charts", async (c) => {
  const db = getDb(c.env.DB);
  const institutionId = c.req.query("institutionId");

  if (!institutionId) {
    return c.json({ success: false, message: "Missing institutionId query parameter" }, 400);
  }

  const instClasses = await db
    .select({ id: classes.id, grade: classes.grade })
    .from(classes)
    .where(and(eq(classes.institutionId, institutionId), eq(classes.isDeleted, 0), eq(classes.isActive, 1)));

  const gradeMap = await getInstGradeToBook(db, institutionId);

  // Progress records for the institution
  const progressRows = await db
    .select({ id: teachingProgress.id, classId: teachingProgress.classId, gradeBookId: teachingProgress.gradeBookId, overallPercentage: teachingProgress.overallPercentage })
    .from(teachingProgress)
    .where(eq(teachingProgress.institutionId, institutionId));

  const classProgressGbMap = new Map<string, string>();
  const progressKeyMap = new Map<string, any>();
  for (const pr of progressRows) {
    if (pr.classId && pr.gradeBookId) {
      classProgressGbMap.set(pr.classId, pr.gradeBookId);
      progressKeyMap.set(`${pr.classId}_${pr.gradeBookId}`, pr);
    }
  }

  const progressBrackets = { notStarted: 0, bracket1: 0, bracket2: 0, bracket3: 0, bracket4: 0, completed: 0 };

  for (const cls of instClasses) {
    let gbId = classProgressGbMap.get(cls.id);
    if (!gbId && cls.grade) {
      gbId = gradeMap.get(Number(cls.grade));
    }
    if (!gbId) continue;

    const pr = progressKeyMap.get(`${cls.id}_${gbId}`);
    const pct = pr?.overallPercentage || 0;

    if (pct === 0) progressBrackets.notStarted++;
    else if (pct === 100) progressBrackets.completed++;
    else if (pct <= 25) progressBrackets.bracket1++;
    else if (pct <= 50) progressBrackets.bracket2++;
    else if (pct <= 75) progressBrackets.bracket3++;
    else progressBrackets.bracket4++;
  }

  // Content type breakdown
  const progressIds = progressRows.map((p) => p.id);
  const completedContentTypesMap = new Map<string, number>();

  if (progressIds.length > 0) {
    // Fetch all content type metadata
    const allContents = await db
      .select({ id: chapterContents.id, type: chapterContents.type })
      .from(chapterContents);

    const progressContents = await db
      .select({ contentId: teachingProgressContents.contentId })
      .from(teachingProgressContents)
      .where(inArray(teachingProgressContents.teachingProgressId, progressIds));

    for (const pc of progressContents) {
      if (pc.contentId) {
        const matchingContent = allContents.find((c) => c.id === pc.contentId);
        if (matchingContent) {
          const type = matchingContent.type || "other";
          completedContentTypesMap.set(type, (completedContentTypesMap.get(type) || 0) + 1);
        }
      }
    }
  }

  const contentTypeData = Array.from(completedContentTypesMap.entries()).map(([type, count]) => ({
    name: type,
    value: count,
  }));

  return c.json({
    success: true,
    data: {
      distribution: [
        { name: "Not Started", value: progressBrackets.notStarted },
        { name: "1-25%", value: progressBrackets.bracket1 },
        { name: "26-50%", value: progressBrackets.bracket2 },
        { name: "51-75%", value: progressBrackets.bracket3 },
        { name: "76-99%", value: progressBrackets.bracket4 },
        { name: "Completed", value: progressBrackets.completed },
      ],
      contentTypeData,
    },
  });
});

// 4. GET /classes — Paginated class-wise progress details
app.get("/classes", async (c) => {
  const db = getDb(c.env.DB);
  const institutionId = c.req.query("institutionId");
  const page = Math.max(1, Number(c.req.query("page") || 1));
  const limit = Math.max(1, Number(c.req.query("limit") || 10));
  const search = c.req.query("search") || "";
  const courseId = c.req.query("courseId") || "all";
  const status = c.req.query("status") || "all";
  const classId = c.req.query("classId") || "all";
  const dateFrom = c.req.query("dateFrom") || "";
  const dateTo = c.req.query("dateTo") || "";

  if (!institutionId) {
    return c.json({ success: false, message: "Missing institutionId query parameter" }, 400);
  }

  // Active classes
  const instClasses = await db
    .select({ id: classes.id, grade: classes.grade, section: classes.section })
    .from(classes)
    .where(and(eq(classes.institutionId, institutionId), eq(classes.isDeleted, 0), eq(classes.isActive, 1)));

  const gradeMap = await getInstGradeToBook(db, institutionId);

  // Gradebooks
  const gradeBookRows = await db
    .select({ id: gradeBooks.id, bookTitle: gradeBooks.bookTitle, grade: gradeBooks.grade, curriculumId: gradeBooks.curriculumId })
    .from(gradeBooks);

  const gbMap = new Map(gradeBookRows.map((gb) => [gb.id, gb]));

  // Chapters & Contents count maps (ordered for position-based calculation)
  const allChapters = await db
    .select({ id: chapters.id, gradeBookId: chapters.gradeBookId, order: chapters.order })
    .from(chapters)
    .orderBy(chapters.order);

  const gbChaptersMap = new Map<string, string[]>();
  for (const ch of allChapters) {
    const list = gbChaptersMap.get(ch.gradeBookId) || [];
    list.push(ch.id);
    gbChaptersMap.set(ch.gradeBookId, list);
  }

  const allContents = await db
    .select({ id: chapterContents.id, chapterId: chapterContents.chapterId, order: chapterContents.order })
    .from(chapterContents)
    .orderBy(chapterContents.order);

  const chContentsMap = new Map<string, string[]>();
  for (const cnt of allContents) {
    const list = chContentsMap.get(cnt.chapterId) || [];
    list.push(cnt.id);
    chContentsMap.set(cnt.chapterId, list);
  }

  const gbContentMap = new Map<string, number>();
  for (const [gbId, chIds] of gbChaptersMap.entries()) {
    let total = 0;
    for (const chId of chIds) {
      total += chContentsMap.get(chId)?.length || 0;
    }
    gbContentMap.set(gbId, total);
  }

  // Teacher assignments
  const classTeachers = await db
    .select({ classId: classTeacherIds.classId, staffId: classTeacherIds.staffId })
    .from(classTeacherIds);

  const activeStaff = await db
    .select({ id: staff.id, name: staff.name })
    .from(staff)
    .where(and(eq(staff.institutionId, institutionId), eq(staff.isDeleted, 0)));

  const staffMap = new Map(activeStaff.map((s) => [s.id, s.name]));
  const classTeacherMap = new Map(classTeachers.map((ct) => [ct.classId, ct.staffId]));

  // Progress records for the institution
  const progressRows = await db
    .select({ id: teachingProgress.id, classId: teachingProgress.classId, gradeBookId: teachingProgress.gradeBookId, overallPercentage: teachingProgress.overallPercentage, lastAccessedAt: teachingProgress.lastAccessedAt })
    .from(teachingProgress)
    .where(eq(teachingProgress.institutionId, institutionId));

  const classProgressGbMap = new Map<string, string>();
  const progressKeyMap = new Map<string, any>();
  for (const pr of progressRows) {
    if (pr.classId && pr.gradeBookId) {
      classProgressGbMap.set(pr.classId, pr.gradeBookId);
      progressKeyMap.set(`${pr.classId}_${pr.gradeBookId}`, pr);
    }
  }

  // Construct expected units and apply filters
  let list: any[] = [];
  for (const cls of instClasses) {
    let gbId = classProgressGbMap.get(cls.id);
    if (!gbId && cls.grade) {
      gbId = gradeMap.get(Number(cls.grade));
    }
    if (!gbId) continue;

    const gb = gbMap.get(gbId);
    if (!gb) continue;

    const pr = progressKeyMap.get(`${cls.id}_${gbId}`);

    // Filters check
    const teacherId = classTeacherMap.get(cls.id);
    const teacherName = teacherId ? staffMap.get(teacherId) || "Unknown" : "Unassigned";
    const courseTitle = gb.bookTitle || "Unknown Course";
    const className = `${cls.grade}–${cls.section}`;

    const matchesSearch =
      className.toLowerCase().includes(search.toLowerCase()) ||
      courseTitle.toLowerCase().includes(search.toLowerCase()) ||
      teacherName.toLowerCase().includes(search.toLowerCase());

    const matchesCourse = courseId === "all" || (gb && gb.curriculumId === courseId);
    const matchesClass = classId === "all" || cls.id === classId;

    // Date range filter on lastAccessedAt
    let matchesDate = true;
    if (dateFrom || dateTo) {
      const lastAt = pr?.lastAccessedAt ? new Date(pr.lastAccessedAt).getTime() : null;
      if (!lastAt) {
        matchesDate = false;
      } else {
        if (dateFrom) matchesDate = matchesDate && lastAt >= new Date(dateFrom).getTime();
        if (dateTo) {
          const toEnd = new Date(dateTo);
          toEnd.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && lastAt <= toEnd.getTime();
        }
      }
    }

    if (matchesSearch && matchesCourse && matchesClass && matchesDate) {
      list.push({
        classId: cls.id,
        className,
        courseId: gbId,
        courseTitle,
        teacherId: teacherId || null,
        teacherName,
        progressId: pr?.id || null,
        totalChapters: gbChaptersMap.get(gbId)?.length || 0,
        totalSubchapters: gbContentMap.get(gbId) || 0,
        lastAccessedAt: pr?.lastAccessedAt || null,
      });
    }
  }

  // Slice current page
  const offset = (page - 1) * limit;
  const paginatedList = list.slice(offset, offset + limit);

  // OPTIMIZED QUERY: Fetch completed counts/chapters ONLY for the paginated slice
  const paginatedProgressIds = paginatedList.map((item) => item.progressId).filter(Boolean) as string[];
  const completedContentsMap = new Map<string, Set<string>>();

  if (paginatedProgressIds.length > 0) {
    const progressContents = await db
      .select({ teachingProgressId: teachingProgressContents.teachingProgressId, contentId: teachingProgressContents.contentId })
      .from(teachingProgressContents)
      .where(inArray(teachingProgressContents.teachingProgressId, paginatedProgressIds));

    for (const pc of progressContents) {
      if (pc.contentId) {
        if (!completedContentsMap.has(pc.teachingProgressId)) {
          completedContentsMap.set(pc.teachingProgressId, new Set());
        }
        completedContentsMap.get(pc.teachingProgressId)!.add(pc.contentId);
      }
    }
  }

  // Hydrate with position-based progress percentage and completed counts
  const hydratedItems = paginatedList.map((item) => {
    let completedSubchapters = 0;
    let completedChapters = 0;
    let progressPercentage = 0;

    if (item.progressId) {
      const completedSet = completedContentsMap.get(item.progressId);
      if (completedSet) {
        completedSubchapters = completedSet.size;

        // Position-based percentage: find farthest accessed content
        const chapterIds = gbChaptersMap.get(item.courseId) || [];
        const orderedContentIds: string[] = [];
        for (const chId of chapterIds) {
          const chContents = chContentsMap.get(chId) || [];
          orderedContentIds.push(...chContents);
        }

        let maxPosition = 0;
        for (let i = 0; i < orderedContentIds.length; i++) {
          if (completedSet.has(orderedContentIds[i])) {
            maxPosition = i + 1;
          }
        }

        progressPercentage = orderedContentIds.length > 0
          ? Number(((maxPosition / orderedContentIds.length) * 100).toFixed(2))
          : 0;

        for (const chId of chapterIds) {
          const chContents = chContentsMap.get(chId) || [];
          if (chContents.length > 0 && chContents.every((c) => completedSet.has(c))) {
            completedChapters++;
          }
        }
      }
    }

    return {
      ...item,
      completedChapters,
      completedSubchapters,
      progressPercentage,
    };
  });

  // Apply status filter after hydration
  const filteredByStatus = status === "all"
    ? hydratedItems
    : hydratedItems.filter((item) => {
        if (status === "not_started") return item.progressPercentage === 0;
        if (status === "ongoing") return item.progressPercentage > 0 && item.progressPercentage < 100;
        if (status === "completed") return item.progressPercentage === 100;
        return true;
      });

  const total = filteredByStatus.length;

  return c.json({
    success: true,
    data: {
      items: filteredByStatus,
      total,
    },
  });
});

// 5. GET /teachers — Paginated teacher leaderboard
app.get("/teachers", async (c) => {
  const db = getDb(c.env.DB);
  const institutionId = c.req.query("institutionId");
  const page = Math.max(1, Number(c.req.query("page") || 1));
  const limit = Math.max(1, Number(c.req.query("limit") || 10));
  const search = c.req.query("search") || "";

  if (!institutionId) {
    return c.json({ success: false, message: "Missing institutionId query parameter" }, 400);
  }

  // Active classes
  const instClasses = await db
    .select({ id: classes.id, grade: classes.grade })
    .from(classes)
    .where(and(eq(classes.institutionId, institutionId), eq(classes.isDeleted, 0), eq(classes.isActive, 1)));

  const gradeMap = await getInstGradeToBook(db, institutionId);

  // Content counts per gradebook
  const gbContentCounts = await db
    .select({ gradeBookId: chapters.gradeBookId, cnt: count() })
    .from(chapterContents)
    .innerJoin(chapters, eq(chapters.id, chapterContents.chapterId))
    .groupBy(chapters.gradeBookId);

  const gbContentMap = new Map<string, number>();
  for (const row of gbContentCounts) {
    gbContentMap.set(row.gradeBookId, row.cnt);
  }

  // Teacher assignments
  const classTeachers = await db
    .select({ classId: classTeacherIds.classId, staffId: classTeacherIds.staffId })
    .from(classTeacherIds);

  const activeStaff = await db
    .select({ id: staff.id, name: staff.name })
    .from(staff)
    .where(and(eq(staff.institutionId, institutionId), eq(staff.isDeleted, 0)));

  const staffMap = new Map(activeStaff.map((s) => [s.id, s.name]));
  const classTeacherMap = new Map(classTeachers.map((ct) => [ct.classId, ct.staffId]));

  // Progress records for the institution
  const progressRows = await db
    .select({ id: teachingProgress.id, classId: teachingProgress.classId, gradeBookId: teachingProgress.gradeBookId, overallPercentage: teachingProgress.overallPercentage })
    .from(teachingProgress)
    .where(eq(teachingProgress.institutionId, institutionId));

  const classProgressGbMap = new Map<string, string>();
  const progressKeyMap = new Map<string, any>();
  for (const pr of progressRows) {
    if (pr.classId && pr.gradeBookId) {
      classProgressGbMap.set(pr.classId, pr.gradeBookId);
      progressKeyMap.set(`${pr.classId}_${pr.gradeBookId}`, pr);
    }
  }

  // Build teacher stats map
  const teacherStatsMap = new Map<string, { id: string; name: string; totalAssigned: number; completed: number; total: number }>();

  for (const cls of instClasses) {
    let gbId = classProgressGbMap.get(cls.id);
    if (!gbId && cls.grade) {
      gbId = gradeMap.get(Number(cls.grade));
    }
    if (!gbId) continue;

    const teacherId = classTeacherMap.get(cls.id);
    if (!teacherId) continue;

    const teacherName = staffMap.get(teacherId);
    if (!teacherName) continue;

    const totalSubchapters = gbContentMap.get(gbId) || 0;
    const pr = progressKeyMap.get(`${cls.id}_${gbId}`);
    const pct = pr?.overallPercentage || 0;
    const completedSubchapters = Math.round((pct / 100) * totalSubchapters);

    const stats = teacherStatsMap.get(teacherId) || {
      id: teacherId,
      name: teacherName,
      totalAssigned: 0,
      completed: 0,
      total: 0,
    };
    stats.totalAssigned++;
    stats.completed += completedSubchapters;
    stats.total += totalSubchapters;
    teacherStatsMap.set(teacherId, stats);
  }

  // Format, search filter and sort
  let list = Array.from(teacherStatsMap.values()).map((t) => ({
    ...t,
    avgProgress: t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0,
  }));

  if (search) {
    list = list.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
  }

  list.sort((a, b) => b.avgProgress - a.avgProgress);

  const total = list.length;
  const offset = (page - 1) * limit;
  const paginatedList = list.slice(offset, offset + limit);

  return c.json({
    success: true,
    data: {
      items: paginatedList,
      total,
    },
  });
});

// 6. GET /courses — Lightweight courses filter metadata list (unique curricula)
app.get("/courses", async (c) => {
  const db = getDb(c.env.DB);
  const institutionId = c.req.query("institutionId");

  if (!institutionId) {
    return c.json({ success: false, message: "Missing institutionId query parameter" }, 400);
  }

  const courseList = await db
    .selectDistinct({ id: curricula.id, title: curricula.name })
    .from(institutionCurriculumAccess)
    .innerJoin(curricula, eq(institutionCurriculumAccess.curriculumId, curricula.id))
    .where(eq(institutionCurriculumAccess.institutionId, institutionId));

  return c.json({ success: true, data: courseList });
});

// 7. GET /classes-list — Lightweight class filter metadata list
app.get("/classes-list", async (c) => {
  const db = getDb(c.env.DB);
  const institutionId = c.req.query("institutionId");

  if (!institutionId) {
    return c.json({ success: false, message: "Missing institutionId query parameter" }, 400);
  }

  const instClasses = await db
    .select({ id: classes.id, grade: classes.grade, section: classes.section })
    .from(classes)
    .where(and(eq(classes.institutionId, institutionId), eq(classes.isDeleted, 0), eq(classes.isActive, 1)));

  const classList = instClasses.map((cls: any) => ({
    id: cls.id,
    label: `${cls.grade}–${cls.section}`,
  }));

  return c.json({ success: true, data: classList });
});

export { app as schoolProgressController };
