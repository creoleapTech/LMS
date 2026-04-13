import { Hono } from "hono";
import { eq, and, sql, count, gte, desc, ne } from "drizzle-orm";
import type { Bindings, Variables } from "../../env";
import { getDb, type DB } from "../../db";
import { institutions, students, staff, classes } from "../../schema/admin";
import { curricula, gradeBooks, chapters, chapterContents } from "../../schema/books";
import { classSessions, teachingProgress } from "../../schema/staff";
import {
  institutionCurriculumAccess,
  classTeacherIds,
  classStudentIds,
  teachingProgressContents,
} from "../../schema/junction";
import { BadRequestError } from "../../lib/errors/bad-request";
import { adminAuth } from "../../middleware/admin-auth";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", adminAuth);

// ── Helpers ──────────────────────────────────────────────

function getMonthLabel(m: number) {
  return [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ][m - 1];
}

function sixMonthsAgoISO(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function buildDateFilter(year?: number, month?: number): { gte: string; lt?: string } {
  if (year && month) {
    return {
      gte: new Date(year, month - 1, 1).toISOString(),
      lt: new Date(year, month, 1).toISOString(),
    };
  }
  if (year) {
    return {
      gte: new Date(year, 0, 1).toISOString(),
      lt: new Date(year + 1, 0, 1).toISOString(),
    };
  }
  return { gte: sixMonthsAgoISO() };
}

// ── Super Admin Stats ────────────────────────────────────

async function superAdminStats(db: DB) {
  // --- Basic counts ---
  const [totalInst] = await db.select({ c: count() }).from(institutions).where(eq(institutions.isDeleted, 0));
  const [activeInst] = await db.select({ c: count() }).from(institutions).where(and(eq(institutions.isActive, 1), eq(institutions.isDeleted, 0)));
  const [totalStudents] = await db.select({ c: count() }).from(students).where(eq(students.isDeleted, 0));
  const [activeStudents] = await db.select({ c: count() }).from(students).where(and(eq(students.isActive, 1), eq(students.isDeleted, 0)));
  const [totalStaff] = await db.select({ c: count() }).from(staff).where(eq(staff.isDeleted, 0));
  const [activeStaff] = await db.select({ c: count() }).from(staff).where(and(eq(staff.isActive, 1), eq(staff.isDeleted, 0)));
  const [totalClasses] = await db.select({ c: count() }).from(classes).where(eq(classes.isDeleted, 0));
  const [totalCurriculums] = await db.select({ c: count() }).from(curricula);
  const [publishedCurriculums] = await db.select({ c: count() }).from(curricula).where(eq(curricula.isPublished, 1));
  const [totalGradeBooks] = await db.select({ c: count() }).from(gradeBooks);
  const [totalChapters] = await db.select({ c: count() }).from(chapters);
  const [totalContent] = await db.select({ c: count() }).from(chapterContents);

  // --- Content by type ---
  const contentByTypeRows = await db
    .select({
      type: chapterContents.type,
      c: count(),
    })
    .from(chapterContents)
    .groupBy(chapterContents.type);

  const contentByType: Record<string, number> = {};
  for (const row of contentByTypeRows) {
    contentByType[row.type] = row.c;
  }

  // --- Enrollment trend (last 6 months) ---
  const sixAgo = sixMonthsAgoISO();
  const enrollmentRows = await db
    .select({
      yearMonth: sql<string>`strftime('%Y-%m', ${students.createdAt})`.as("ym"),
      c: count(),
    })
    .from(students)
    .where(and(eq(students.isDeleted, 0), gte(students.createdAt, sixAgo)))
    .groupBy(sql`strftime('%Y-%m', ${students.createdAt})`)
    .orderBy(sql`strftime('%Y-%m', ${students.createdAt})`);

  const enrollmentTrend = enrollmentRows.map((r) => {
    const parts = r.yearMonth.split("-");
    return { month: getMonthLabel(Number(parts[1])), count: r.c };
  });

  // --- Institution overview ---
  const institutionList = await db
    .select({ id: institutions.id, name: institutions.name, isActive: institutions.isActive })
    .from(institutions)
    .where(eq(institutions.isDeleted, 0));

  // Per-institution counts via subqueries
  const instStudentCounts = await db
    .select({ institutionId: students.institutionId, c: count() })
    .from(students)
    .where(eq(students.isDeleted, 0))
    .groupBy(students.institutionId);

  const instStaffCounts = await db
    .select({ institutionId: staff.institutionId, c: count() })
    .from(staff)
    .where(eq(staff.isDeleted, 0))
    .groupBy(staff.institutionId);

  const instClassCounts = await db
    .select({ institutionId: classes.institutionId, c: count() })
    .from(classes)
    .where(eq(classes.isDeleted, 0))
    .groupBy(classes.institutionId);

  // Progress by institution
  const progressByInst = await db
    .select({
      institutionId: teachingProgress.institutionId,
      avg: sql<number>`avg(${teachingProgress.overallPercentage})`.as("avg"),
    })
    .from(teachingProgress)
    .groupBy(teachingProgress.institutionId);

  const toMap = (arr: { institutionId: string | null; c: number }[]) => {
    const m: Record<string, number> = {};
    for (const r of arr) if (r.institutionId) m[r.institutionId] = r.c;
    return m;
  };
  const studentMap = toMap(instStudentCounts);
  const staffMap = toMap(instStaffCounts);
  const classMap = toMap(instClassCounts);
  const progressMap: Record<string, number> = {};
  for (const r of progressByInst) {
    if (r.institutionId) progressMap[r.institutionId] = Math.round(r.avg || 0);
  }

  const institutionOverview = institutionList.map((inst) => ({
    _id: inst.id,
    name: inst.name,
    isActive: inst.isActive,
    students: studentMap[inst.id] || 0,
    staff: staffMap[inst.id] || 0,
    classes: classMap[inst.id] || 0,
    avgProgress: progressMap[inst.id] || 0,
  }));

  // --- Recent activity ---
  const recentStudents = await db
    .select({ name: students.name, createdAt: students.createdAt, institutionId: students.institutionId })
    .from(students)
    .where(eq(students.isDeleted, 0))
    .orderBy(desc(students.createdAt))
    .limit(5);

  const recentStaffRows = await db
    .select({ name: staff.name, type: staff.type, createdAt: staff.createdAt, institutionId: staff.institutionId })
    .from(staff)
    .where(eq(staff.isDeleted, 0))
    .orderBy(desc(staff.createdAt))
    .limit(5);

  const recentActivity = [
    ...recentStudents.map((s) => ({
      type: "student" as const,
      name: s.name || "Unknown",
      action: "Student enrolled",
      time: relativeTime(s.createdAt),
      createdAt: s.createdAt,
    })),
    ...recentStaffRows.map((s) => ({
      type: "staff" as const,
      name: s.name || "Unknown",
      action: s.type === "teacher" ? "Teacher joined" : "Staff added",
      time: relativeTime(s.createdAt),
      createdAt: s.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 8);

  return {
    totalInstitutions: totalInst.c,
    activeInstitutions: activeInst.c,
    totalStudents: totalStudents.c,
    activeStudents: activeStudents.c,
    totalStaff: totalStaff.c,
    activeStaff: activeStaff.c,
    totalClasses: totalClasses.c,
    totalCurriculums: totalCurriculums.c,
    publishedCurriculums: publishedCurriculums.c,
    totalGradeBooks: totalGradeBooks.c,
    totalChapters: totalChapters.c,
    totalContent: totalContent.c,
    contentByType,
    enrollmentTrend,
    institutionOverview,
    recentActivity,
  };
}

// ── Admin Stats (institution-scoped) ─────────────────────

async function adminStats(
  db: DB,
  institutionId: string,
  filters: { year?: number; month?: number; classId?: string },
) {
  const dateFilt = buildDateFilter(filters.year, filters.month);

  // Basic counts
  const [totalStudentsR] = await db.select({ c: count() }).from(students).where(and(eq(students.institutionId, institutionId), eq(students.isDeleted, 0)));
  const [activeStudentsR] = await db.select({ c: count() }).from(students).where(and(eq(students.institutionId, institutionId), eq(students.isActive, 1), eq(students.isDeleted, 0)));
  const [totalStaffR] = await db.select({ c: count() }).from(staff).where(and(eq(staff.institutionId, institutionId), eq(staff.isDeleted, 0)));
  const [activeStaffR] = await db.select({ c: count() }).from(staff).where(and(eq(staff.institutionId, institutionId), eq(staff.isActive, 1), eq(staff.isDeleted, 0)));
  const [totalClassesR] = await db.select({ c: count() }).from(classes).where(and(eq(classes.institutionId, institutionId), eq(classes.isDeleted, 0)));

  // Institution name + curriculum access count
  const [inst] = await db
    .select({ id: institutions.id, name: institutions.name })
    .from(institutions)
    .where(eq(institutions.id, institutionId));

  const [currAccessCount] = await db
    .select({ c: count() })
    .from(institutionCurriculumAccess)
    .where(eq(institutionCurriculumAccess.institutionId, institutionId));

  // Avg teaching progress
  const [avgProgR] = await db
    .select({ avg: sql<number>`coalesce(avg(${teachingProgress.overallPercentage}), 0)`.as("avg") })
    .from(teachingProgress)
    .where(eq(teachingProgress.institutionId, institutionId));
  const avgTeachingProgress = Math.round(avgProgR.avg || 0);

  // Class size distribution (count students per class)
  const classRows = await db
    .select({ id: classes.id, grade: classes.grade, section: classes.section })
    .from(classes)
    .where(and(eq(classes.institutionId, institutionId), eq(classes.isDeleted, 0)));

  const classSizeDistribution = [];
  for (const cls of classRows) {
    const [sc] = await db
      .select({ c: count() })
      .from(classStudentIds)
      .where(eq(classStudentIds.classId, cls.id));
    classSizeDistribution.push({
      class: `${cls.grade || "?"}–${cls.section}`,
      students: sc.c,
    });
  }

  // Teacher leaderboard (top 5 by avg progress)
  const teacherProgressRows = await db
    .select({
      staffId: teachingProgress.staffId,
      avg: sql<number>`avg(${teachingProgress.overallPercentage})`.as("avg"),
      totalRecords: count().as("totalRecords"),
    })
    .from(teachingProgress)
    .where(eq(teachingProgress.institutionId, institutionId))
    .groupBy(teachingProgress.staffId)
    .orderBy(desc(sql`avg(${teachingProgress.overallPercentage})`))
    .limit(5);

  const teacherLeaderboard = [];
  for (const row of teacherProgressRows) {
    if (!row.staffId) continue;
    const [teacher] = await db
      .select({ name: staff.name, profileImage: staff.profileImage })
      .from(staff)
      .where(eq(staff.id, row.staffId));
    teacherLeaderboard.push({
      _id: row.staffId,
      name: teacher?.name || "Unknown",
      profileImage: teacher?.profileImage || "",
      avgProgress: Math.round(row.avg || 0),
    });
  }

  // Progress by grade book
  const progressByBookRows = await db
    .select({
      gradeBookId: teachingProgress.gradeBookId,
      avg: sql<number>`avg(${teachingProgress.overallPercentage})`.as("avg"),
    })
    .from(teachingProgress)
    .where(eq(teachingProgress.institutionId, institutionId))
    .groupBy(teachingProgress.gradeBookId);

  const teachingProgressByBook = [];
  for (const row of progressByBookRows) {
    if (!row.gradeBookId) continue;
    const [book] = await db
      .select({ bookTitle: gradeBooks.bookTitle, grade: gradeBooks.grade })
      .from(gradeBooks)
      .where(eq(gradeBooks.id, row.gradeBookId));
    teachingProgressByBook.push({
      _id: row.gradeBookId,
      bookTitle: book?.bookTitle || "Unknown",
      grade: book?.grade || 0,
      avgProgress: Math.round(row.avg || 0),
    });
  }

  // Student growth (by month)
  const dateConditions = [
    eq(students.institutionId, institutionId),
    eq(students.isDeleted, 0),
    gte(students.createdAt, dateFilt.gte),
  ];
  if (dateFilt.lt) dateConditions.push(sql`${students.createdAt} < ${dateFilt.lt}` as any);

  const studentGrowthRows = await db
    .select({
      yearMonth: sql<string>`strftime('%Y-%m', ${students.createdAt})`.as("ym"),
      c: count(),
    })
    .from(students)
    .where(and(...dateConditions))
    .groupBy(sql`strftime('%Y-%m', ${students.createdAt})`)
    .orderBy(sql`strftime('%Y-%m', ${students.createdAt})`);

  const studentGrowth = studentGrowthRows.map((r) => {
    const parts = r.yearMonth.split("-");
    return { month: getMonthLabel(Number(parts[1])), count: r.c };
  });

  // Gender distribution
  const genderRows = await db
    .select({ gender: students.gender, c: count() })
    .from(students)
    .where(and(eq(students.institutionId, institutionId), eq(students.isDeleted, 0)))
    .groupBy(students.gender);

  const genderDistribution = genderRows.map((g) => ({
    name: g.gender || "Not specified",
    value: g.c,
  }));

  // Recent sessions
  const recentSessionRows = await db
    .select({
      id: classSessions.id,
      staffId: classSessions.staffId,
      classId: classSessions.classId,
      durationMinutes: classSessions.durationMinutes,
      status: classSessions.status,
      startTime: classSessions.startTime,
    })
    .from(classSessions)
    .where(eq(classSessions.institutionId, institutionId))
    .orderBy(desc(classSessions.startTime))
    .limit(8);

  const recentSessions = [];
  for (const s of recentSessionRows) {
    const [teacher] = s.staffId
      ? await db.select({ name: staff.name }).from(staff).where(eq(staff.id, s.staffId))
      : [{ name: "Unknown" }];
    const [cls] = s.classId
      ? await db.select({ grade: classes.grade, section: classes.section }).from(classes).where(eq(classes.id, s.classId))
      : [{ grade: "?", section: "?" }];
    recentSessions.push({
      _id: s.id,
      teacher: teacher?.name || "Unknown",
      class: `${cls?.grade || "?"}–${cls?.section || "?"}`,
      duration: s.durationMinutes || 0,
      topics: [],
      status: s.status,
      time: relativeTime(s.startTime),
    });
  }

  // Sessions by month
  const sessionDateConditions = [
    eq(classSessions.institutionId, institutionId),
    gte(classSessions.startTime, dateFilt.gte),
  ];
  if (dateFilt.lt) sessionDateConditions.push(sql`${classSessions.startTime} < ${dateFilt.lt}` as any);

  const sessionsByMonthRows = await db
    .select({
      yearMonth: sql<string>`strftime('%Y-%m', ${classSessions.startTime})`.as("ym"),
      c: count(),
      totalMinutes: sql<number>`coalesce(sum(${classSessions.durationMinutes}), 0)`.as("totalMinutes"),
    })
    .from(classSessions)
    .where(and(...sessionDateConditions))
    .groupBy(sql`strftime('%Y-%m', ${classSessions.startTime})`)
    .orderBy(sql`strftime('%Y-%m', ${classSessions.startTime})`);

  const sessionsByMonth = sessionsByMonthRows.map((r) => {
    const parts = r.yearMonth.split("-");
    return { month: getMonthLabel(Number(parts[1])), sessions: r.c, minutes: r.totalMinutes };
  });

  // Class activity (sessions per class)
  const classActivityRows = await db
    .select({
      classId: classSessions.classId,
      sessions: count(),
      totalMinutes: sql<number>`coalesce(sum(${classSessions.durationMinutes}), 0)`.as("totalMinutes"),
    })
    .from(classSessions)
    .where(and(...sessionDateConditions))
    .groupBy(classSessions.classId);

  const classActivity = [];
  for (const row of classActivityRows) {
    if (!row.classId) continue;
    const [cls] = await db
      .select({ grade: classes.grade, section: classes.section })
      .from(classes)
      .where(eq(classes.id, row.classId));
    classActivity.push({
      class: cls ? `${cls.grade || "?"}–${cls.section}` : "Unknown",
      sessions: row.sessions,
      minutes: row.totalMinutes,
    });
  }

  // Course distribution — grade books per curriculum
  const courseDistRows = await db
    .select({
      curriculumId: gradeBooks.curriculumId,
      books: count(),
    })
    .from(gradeBooks)
    .groupBy(gradeBooks.curriculumId);

  const courseDistribution = [];
  for (const row of courseDistRows) {
    const [curr] = await db
      .select({ name: curricula.name })
      .from(curricula)
      .where(eq(curricula.id, row.curriculumId));
    courseDistribution.push({
      name: curr?.name || "Unknown",
      value: row.books,
    });
  }

  return {
    totalStudents: totalStudentsR.c,
    activeStudents: activeStudentsR.c,
    totalStaff: totalStaffR.c,
    activeStaff: activeStaffR.c,
    totalClasses: totalClassesR.c,
    curriculumAccessCount: currAccessCount.c,
    avgTeachingProgress,
    classSizeDistribution,
    teacherLeaderboard,
    teachingProgressByBook,
    studentGrowth,
    recentSessions,
    institutionName: inst?.name || "",
    genderDistribution,
    sessionsByMonth,
    classActivity,
    courseDistribution,
    schoolProgress: avgTeachingProgress,
  };
}

// ── Teacher Stats ────────────────────────────────────────

async function teacherStats(db: DB, staffId: string, institutionId: string) {
  const sixAgo = sixMonthsAgoISO();

  // My classes (via junction table)
  const myClassIds = await db
    .select({ classId: classTeacherIds.classId })
    .from(classTeacherIds)
    .where(eq(classTeacherIds.staffId, staffId));

  const myClasses = [];
  for (const row of myClassIds) {
    const [cls] = await db
      .select({
        id: classes.id,
        grade: classes.grade,
        section: classes.section,
        year: classes.year,
      })
      .from(classes)
      .where(and(eq(classes.id, row.classId), eq(classes.isDeleted, 0)));
    if (cls) myClasses.push(cls);
  }

  // Count students per class
  const myClassStudentCounts: Record<string, number> = {};
  for (const cls of myClasses) {
    const [sc] = await db
      .select({ c: count() })
      .from(classStudentIds)
      .where(eq(classStudentIds.classId, cls.id));
    myClassStudentCounts[cls.id] = sc.c;
  }

  const totalStudents = Object.values(myClassStudentCounts).reduce((a, b) => a + b, 0);

  // Teaching progress records
  const progressRecords = await db
    .select()
    .from(teachingProgress)
    .where(eq(teachingProgress.staffId, staffId))
    .orderBy(desc(teachingProgress.lastAccessedAt));

  // Enrich progress records with gradebook + class info + content progress
  const enrichedProgress: any[] = [];
  for (const p of progressRecords) {
    let gbInfo: { id: string; bookTitle: string | null; grade: number | null; totalChapters: number | null; coverImage: string | null } | null = null;
    if (p.gradeBookId) {
      const [gb] = await db
        .select({
          id: gradeBooks.id,
          bookTitle: gradeBooks.bookTitle,
          grade: gradeBooks.grade,
          totalChapters: gradeBooks.totalChapters,
          coverImage: gradeBooks.coverImage,
        })
        .from(gradeBooks)
        .where(eq(gradeBooks.id, p.gradeBookId));
      gbInfo = gb || null;
    }

    let clsInfo: { id: string; grade: string | null; section: string } | null = null;
    if (p.classId) {
      const [cls] = await db
        .select({ id: classes.id, grade: classes.grade, section: classes.section })
        .from(classes)
        .where(eq(classes.id, p.classId));
      clsInfo = cls || null;
    }

    // Content progress from junction
    const contentProgressRows = await db
      .select({
        isCompleted: teachingProgressContents.isCompleted,
      })
      .from(teachingProgressContents)
      .where(eq(teachingProgressContents.teachingProgressId, p.id));

    const completedContent = contentProgressRows.filter((c) => c.isCompleted === 1).length;
    const totalContent = contentProgressRows.length;

    enrichedProgress.push({
      ...p,
      gradeBookInfo: gbInfo,
      classInfo: clsInfo,
      completedContent,
      totalContent,
    });
  }

  // Overall progress
  const overallProgress =
    enrichedProgress.length > 0
      ? Math.round(
          enrichedProgress.reduce((s, p) => s + (p.overallPercentage || 0), 0) /
            enrichedProgress.length,
        )
      : 0;

  // Continue teaching — most recently accessed
  let continueTeaching = null;
  if (enrichedProgress.length > 0) {
    const latest = enrichedProgress[0];
    const gb = latest.gradeBookInfo;
    const cl = latest.classInfo;
    continueTeaching = {
      gradeBookId: gb?.id || null,
      classId: cl?.id || null,
      bookTitle: gb?.bookTitle || "Unknown",
      grade: gb?.grade || 0,
      coverImage: gb?.coverImage || "",
      class: cl ? `${cl.grade}–${cl.section}` : "",
      progress: latest.overallPercentage || 0,
      completedContent: latest.completedContent,
      totalContent: latest.totalContent,
      lastAccessedAt: latest.lastAccessedAt,
      lastAccessedLabel: relativeTime(latest.lastAccessedAt),
    };
  }

  // Progress by grade book
  const progressByGradeBook = enrichedProgress.map((p) => {
    const gb = p.gradeBookInfo;
    const cl = p.classInfo;
    return {
      _id: p.id,
      gradeBookId: gb?.id || null,
      bookTitle: gb?.bookTitle || "Unknown",
      grade: gb?.grade || 0,
      class: cl ? `${cl.grade}–${cl.section}` : "",
      progress: p.overallPercentage || 0,
      completedContent: p.completedContent,
      totalContent: p.totalContent,
    };
  });

  // Format my classes with progress info
  const myClassesFormatted = myClasses.map((cls) => {
    const classProgress = enrichedProgress.filter(
      (p) => p.classId === cls.id,
    );
    const avgProg =
      classProgress.length > 0
        ? Math.round(
            classProgress.reduce((s, p) => s + (p.overallPercentage || 0), 0) /
              classProgress.length,
          )
        : 0;
    const lastAccessed =
      classProgress.length > 0
        ? classProgress.sort(
            (a, b) =>
              new Date(b.lastAccessedAt || 0).getTime() -
              new Date(a.lastAccessedAt || 0).getTime(),
          )[0]?.lastAccessedAt
        : null;

    return {
      _id: cls.id,
      grade: cls.grade,
      section: cls.section,
      year: cls.year,
      students: myClassStudentCounts[cls.id] || 0,
      avgProgress: avgProg,
      lastAccessed: lastAccessed ? relativeTime(lastAccessed) : "Never",
    };
  });

  // Session count
  const [sessionCountR] = await db
    .select({ c: count() })
    .from(classSessions)
    .where(eq(classSessions.staffId, staffId));

  // Recent sessions
  const recentSessionRows = await db
    .select({
      id: classSessions.id,
      classId: classSessions.classId,
      durationMinutes: classSessions.durationMinutes,
      status: classSessions.status,
      startTime: classSessions.startTime,
    })
    .from(classSessions)
    .where(eq(classSessions.staffId, staffId))
    .orderBy(desc(classSessions.startTime))
    .limit(5);

  const recentSessions = [];
  for (const s of recentSessionRows) {
    let clsLabel = "?–?";
    if (s.classId) {
      const [cls] = await db
        .select({ grade: classes.grade, section: classes.section })
        .from(classes)
        .where(eq(classes.id, s.classId));
      if (cls) clsLabel = `${cls.grade || "?"}–${cls.section || "?"}`;
    }
    recentSessions.push({
      _id: s.id,
      class: clsLabel,
      duration: s.durationMinutes || 0,
      topics: [],
      status: s.status,
      time: relativeTime(s.startTime),
      startTime: s.startTime,
    });
  }

  // Progress by class (for RadarChart)
  const progressByClass = myClassesFormatted.map((c) => ({
    classLabel: `${c.grade || "?"}–${c.section}`,
    avgProgress: c.avgProgress,
  }));

  // Sessions by month
  const sessionsByMonthRows = await db
    .select({
      yearMonth: sql<string>`strftime('%Y-%m', ${classSessions.startTime})`.as("ym"),
      c: count(),
      totalMinutes: sql<number>`coalesce(sum(${classSessions.durationMinutes}), 0)`.as("totalMinutes"),
    })
    .from(classSessions)
    .where(and(eq(classSessions.staffId, staffId), gte(classSessions.startTime, sixAgo)))
    .groupBy(sql`strftime('%Y-%m', ${classSessions.startTime})`)
    .orderBy(sql`strftime('%Y-%m', ${classSessions.startTime})`);

  const sessionsByMonth = sessionsByMonthRows.map((r) => {
    const parts = r.yearMonth.split("-");
    return { month: getMonthLabel(Number(parts[1])), sessions: r.c, minutes: r.totalMinutes };
  });

  return {
    myClasses: myClassesFormatted,
    totalStudents,
    overallProgress,
    totalSessions: sessionCountR.c,
    continueTeaching,
    progressByGradeBook,
    recentSessions,
    progressByClass,
    sessionsByMonth,
  };
}

// ── Controller ───────────────────────────────────────────

app.get("/stats", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);
  const role = user.role;

  if (role === "super_admin") {
    const data = await superAdminStats(db);
    return c.json({ success: true, role: "super_admin", data });
  }

  if (role === "admin") {
    const institutionId =
      typeof user.institutionId === "object"
        ? (user.institutionId as any)._id?.toString()
        : user.institutionId?.toString();

    if (!institutionId) {
      return c.json({ success: false, message: "No institution assigned" });
    }

    const filters = {
      year: c.req.query("year") ? Number(c.req.query("year")) : undefined,
      month: c.req.query("month") ? Number(c.req.query("month")) : undefined,
      classId: c.req.query("classId") || undefined,
    };

    const data = await adminStats(db, institutionId, filters);
    return c.json({ success: true, role: "admin", data });
  }

  if (role === "teacher" || role === "staff") {
    const staffId = (user._id || user.id)?.toString();
    const institutionId =
      typeof user.institutionId === "object"
        ? (user.institutionId as any)._id?.toString()
        : user.institutionId?.toString();

    if (!staffId) {
      return c.json({ success: false, message: "Invalid user" });
    }

    const data = await teacherStats(db, staffId, institutionId || "");
    return c.json({ success: true, role: "teacher", data });
  }

  return c.json({ success: false, message: "Unknown role" });
});

export { app as dashboardController };
