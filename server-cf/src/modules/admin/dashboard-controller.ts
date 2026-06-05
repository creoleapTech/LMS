import { Hono } from "hono";
import { eq, and, sql, count, gte, desc, ne, inArray } from "drizzle-orm";
import type { Bindings, Variables } from "../../env";
import { getDb, type DB } from "../../db";
import { institutions, students, staff, classes } from "../../schema/admin";
import { curricula, gradeBooks, chapters, chapterContents } from "../../schema/books";
import { classSessions, teachingProgress } from "../../schema/staff";
import {
  institutionCurriculumAccess,
  institutionAccessibleGradebooks,
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

  const classIds = classRows.map((c) => c.id);
  const classSizeMap = new Map<string, number>();
  if (classIds.length > 0) {
    const countRows = await db
      .select({ classId: classStudentIds.classId, c: count() })
      .from(classStudentIds)
      .where(inArray(classStudentIds.classId, classIds))
      .groupBy(classStudentIds.classId);
    for (const r of countRows) classSizeMap.set(r.classId!, r.c);
  }

  const classSizeDistribution = classRows.map((cls) => ({
    id: cls.id,
    class: `${cls.grade || "?"}–${cls.section}`,
    students: classSizeMap.get(cls.id) || 0,
  }));

  // Build classId -> label map for reuse
  const classIdToLabel: Record<string, string> = {};
  for (const cls of classRows) {
    classIdToLabel[cls.id] = `${cls.grade || "?"}–${cls.section}`;
  }

  // Apply classId filter to session/activity queries
  const filteredClassIds = filters.classId
    ? classRows.filter((c) => c.id === filters.classId).map((c) => c.id)
    : classRows.map((c) => c.id);

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

  const teacherIds = teacherProgressRows.map((r) => r.staffId).filter(Boolean) as string[];
  const teacherMap = new Map<string, any>();
  if (teacherIds.length > 0) {
    const teacherRows = await db
      .select({ id: staff.id, name: staff.name, profileImage: staff.profileImage })
      .from(staff)
      .where(inArray(staff.id, teacherIds));
    for (const t of teacherRows) teacherMap.set(t.id, t);
  }

  const teacherLeaderboard = teacherProgressRows.map((row) => ({
    _id: row.staffId,
    name: teacherMap.get(row.staffId!)?.name || "Unknown",
    profileImage: teacherMap.get(row.staffId!)?.profileImage || "",
    avgProgress: Math.round(row.avg || 0),
  }));

  // Progress by grade book
  const progressByBookRows = await db
    .select({
      gradeBookId: teachingProgress.gradeBookId,
      avg: sql<number>`avg(${teachingProgress.overallPercentage})`.as("avg"),
    })
    .from(teachingProgress)
    .where(eq(teachingProgress.institutionId, institutionId))
    .groupBy(teachingProgress.gradeBookId);

  const bookIds = progressByBookRows.map((r) => r.gradeBookId).filter(Boolean) as string[];
  const bookMap = new Map<string, any>();
  if (bookIds.length > 0) {
    const bookRows = await db
      .select({ id: gradeBooks.id, bookTitle: gradeBooks.bookTitle, grade: gradeBooks.grade })
      .from(gradeBooks)
      .where(inArray(gradeBooks.id, bookIds));
    for (const b of bookRows) bookMap.set(b.id, b);
  }

  const teachingProgressByBook = progressByBookRows.map((row) => ({
    _id: row.gradeBookId,
    bookTitle: bookMap.get(row.gradeBookId!)?.bookTitle || "Unknown",
    grade: bookMap.get(row.gradeBookId!)?.grade || 0,
    avgProgress: Math.round(row.avg || 0),
  }));

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

  const recentStaffIds = recentSessionRows.map((s) => s.staffId).filter(Boolean) as string[];
  const recentClassIds = recentSessionRows.map((s) => s.classId).filter(Boolean) as string[];

  const recentStaffMap = new Map<string, any>();
  if (recentStaffIds.length > 0) {
    const rows = await db.select({ id: staff.id, name: staff.name }).from(staff).where(inArray(staff.id, recentStaffIds));
    for (const r of rows) recentStaffMap.set(r.id, r);
  }

  const recentClassMap = new Map<string, any>();
  if (recentClassIds.length > 0) {
    const rows = await db.select({ id: classes.id, grade: classes.grade, section: classes.section }).from(classes).where(inArray(classes.id, recentClassIds));
    for (const r of rows) recentClassMap.set(r.id, r);
  }

  const recentSessions = recentSessionRows.map((s) => {
    const teacher = recentStaffMap.get(s.staffId!);
    const cls = recentClassMap.get(s.classId!);
    return {
      _id: s.id,
      teacher: teacher?.name || "Unknown",
      class: `${cls?.grade || "?"}–${cls?.section || "?"}`,
      duration: s.durationMinutes || 0,
      topics: [],
      status: s.status,
      time: relativeTime(s.startTime),
    };
  });

  // Sessions by month
  const sessionDateConditions: any[] = [
    eq(classSessions.institutionId, institutionId),
    gte(classSessions.startTime, dateFilt.gte),
  ];
  if (dateFilt.lt) sessionDateConditions.push(sql`${classSessions.startTime} < ${dateFilt.lt}`);
  if (filteredClassIds.length > 0 && filters.classId) {
    sessionDateConditions.push(sql`${classSessions.classId} = ${filters.classId}`);
  }

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

  const activityClassIds = classActivityRows.map((r) => r.classId).filter(Boolean) as string[];
  const activityClassMap = new Map<string, any>();
  if (activityClassIds.length > 0) {
    const rows = await db
      .select({ id: classes.id, grade: classes.grade, section: classes.section })
      .from(classes)
      .where(inArray(classes.id, activityClassIds));
    for (const r of rows) activityClassMap.set(r.id, r);
  }

  const classActivity = classActivityRows.map((row) => ({
    class: activityClassMap.get(row.classId!)
      ? `${activityClassMap.get(row.classId!).grade || "?"}–${activityClassMap.get(row.classId!).section}`
      : "Unknown",
    sessions: row.sessions,
    minutes: row.totalMinutes,
  }));

  // Classwise progress — avg teaching completion per class
  const classProgressRows = await db
    .select({
      classId: teachingProgress.classId,
      avg: sql<number>`coalesce(avg(${teachingProgress.overallPercentage}), 0)`.as("avg"),
    })
    .from(teachingProgress)
    .where(and(
      eq(teachingProgress.institutionId, institutionId),
      sql`${teachingProgress.classId} is not null`,
    ))
    .groupBy(teachingProgress.classId);

  const missingClassIds = classProgressRows
    .map((r) => r.classId)
    .filter((id): id is string => !!id && !classIdToLabel[id]);

  const missingClassMap = new Map<string, any>();
  if (missingClassIds.length > 0) {
    const rows = await db
      .select({ id: classes.id, grade: classes.grade, section: classes.section })
      .from(classes)
      .where(inArray(classes.id, missingClassIds));
    for (const r of rows) missingClassMap.set(r.id, r);
  }

  const classwiseProgress: { class: string; avgProgress: number }[] = [];

  if (classProgressRows.length > 0) {
    for (const row of classProgressRows) {
      if (!row.classId) continue;
      let label = classIdToLabel[row.classId];
      if (!label) {
        const cls = missingClassMap.get(row.classId);
        label = cls ? `${cls.grade || "?"}–${cls.section}` : "Unknown";
      }
      classwiseProgress.push({ class: label, avgProgress: Math.round(row.avg || 0) });
    }
  } else {
    // No progress records yet — show all classes at 0%
    for (const cls of classRows) {
      classwiseProgress.push({
        class: `${cls.grade || "?"}–${cls.section}`,
        avgProgress: 0,
      });
    }
  }

  classwiseProgress.sort((a, b) => a.class.localeCompare(b.class));

  // Course distribution — grade books accessible to this institution (scoped)
  const accessRows = await db
    .select({ id: institutionCurriculumAccess.id, curriculumId: institutionCurriculumAccess.curriculumId })
    .from(institutionCurriculumAccess)
    .where(eq(institutionCurriculumAccess.institutionId, institutionId));

  const accessCurriculumIds = accessRows.map((a) => a.curriculumId);
  const curriculumMap = new Map<string, any>();
  if (accessCurriculumIds.length > 0) {
    const rows = await db
      .select({ id: curricula.id, name: curricula.name })
      .from(curricula)
      .where(inArray(curricula.id, accessCurriculumIds));
    for (const r of rows) curriculumMap.set(r.id, r);
  }

  // Count accessible grade books for all access entries in one query
  const accessIds = accessRows.map((a) => a.id);
  const gbCountMap = new Map<string, number>();
  if (accessIds.length > 0) {
    const countRows = await db
      .select({ accessId: institutionAccessibleGradebooks.accessId, c: count() })
      .from(institutionAccessibleGradebooks)
      .where(inArray(institutionAccessibleGradebooks.accessId, accessIds))
      .groupBy(institutionAccessibleGradebooks.accessId);
    for (const r of countRows) gbCountMap.set(r.accessId, r.c);
  }

  const courseDistribution = accessRows.map((access) => ({
    name: curriculumMap.get(access.curriculumId)?.name || "Unknown",
    value: gbCountMap.get(access.id) || 0,
  }));

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
    classwiseProgress,
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

  const myClassIdList = myClassIds.map((r) => r.classId);
  const myClasses = myClassIdList.length > 0
    ? await db
        .select({ id: classes.id, grade: classes.grade, section: classes.section, year: classes.year })
        .from(classes)
        .where(and(inArray(classes.id, myClassIdList), eq(classes.isDeleted, 0)))
    : [];

  // Count students per class
  const myClassIdsForCount = myClasses.map((c) => c.id);
  const myClassStudentCounts: Record<string, number> = {};
  if (myClassIdsForCount.length > 0) {
    const countRows = await db
      .select({ classId: classStudentIds.classId, c: count() })
      .from(classStudentIds)
      .where(inArray(classStudentIds.classId, myClassIdsForCount))
      .groupBy(classStudentIds.classId);
    for (const r of countRows) myClassStudentCounts[r.classId!] = r.c;
  }

  const totalStudents = Object.values(myClassStudentCounts).reduce((a, b) => a + b, 0);

  // Teaching progress records
  const progressRecords = await db
    .select()
    .from(teachingProgress)
    .where(eq(teachingProgress.staffId, staffId))
    .orderBy(desc(teachingProgress.lastAccessedAt));

  // Enrich progress records with gradebook + class info + content progress
  const progressIds = progressRecords.map((p) => p.id);
  const gradeBookIds = [...new Set(progressRecords.map((p) => p.gradeBookId).filter(Boolean))] as string[];
  const classIds = [...new Set(progressRecords.map((p) => p.classId).filter(Boolean))] as string[];

  const gbMap = new Map<string, any>();
  if (gradeBookIds.length > 0) {
    const rows = await db
      .select({ id: gradeBooks.id, bookTitle: gradeBooks.bookTitle, grade: gradeBooks.grade, totalChapters: gradeBooks.totalChapters, coverImage: gradeBooks.coverImage })
      .from(gradeBooks)
      .where(inArray(gradeBooks.id, gradeBookIds));
    for (const r of rows) gbMap.set(r.id, r);
  }

  const classMap = new Map<string, any>();
  if (classIds.length > 0) {
    const rows = await db
      .select({ id: classes.id, grade: classes.grade, section: classes.section })
      .from(classes)
      .where(inArray(classes.id, classIds));
    for (const r of rows) classMap.set(r.id, r);
  }

  const contentProgressMap = new Map<string, { completed: number; total: number }>();
  if (progressIds.length > 0) {
    const rows = await db
      .select({ teachingProgressId: teachingProgressContents.teachingProgressId, isCompleted: teachingProgressContents.isCompleted })
      .from(teachingProgressContents)
      .where(inArray(teachingProgressContents.teachingProgressId, progressIds));
    for (const r of rows) {
      const existing = contentProgressMap.get(r.teachingProgressId) || { completed: 0, total: 0 };
      existing.total++;
      if (r.isCompleted === 1) existing.completed++;
      contentProgressMap.set(r.teachingProgressId, existing);
    }
  }

  const enrichedProgress = progressRecords.map((p) => {
    const contentStats = contentProgressMap.get(p.id) || { completed: 0, total: 0 };
    return {
      ...p,
      gradeBookInfo: p.gradeBookId ? gbMap.get(p.gradeBookId) || null : null,
      classInfo: p.classId ? classMap.get(p.classId) || null : null,
      completedContent: contentStats.completed,
      totalContent: contentStats.total,
    };
  });

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

  const recentClassIds = recentSessionRows.map((s) => s.classId).filter(Boolean) as string[];
  const recentClassMap = new Map<string, any>();
  if (recentClassIds.length > 0) {
    const rows = await db
      .select({ id: classes.id, grade: classes.grade, section: classes.section })
      .from(classes)
      .where(inArray(classes.id, recentClassIds));
    for (const r of rows) recentClassMap.set(r.id, r);
  }

  const recentSessions = recentSessionRows.map((s) => {
    const cls = recentClassMap.get(s.classId!);
    return {
      _id: s.id,
      class: cls ? `${cls.grade || "?"}–${cls.section || "?"}` : "?–?",
      duration: s.durationMinutes || 0,
      topics: [],
      status: s.status,
      time: relativeTime(s.startTime),
      startTime: s.startTime,
    };
  });

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
