import Elysia, { t } from "elysia";
import { adminAuthMacro } from "../admin-macro";
import { InstitutionModel } from "@/schema/admin/institution-model";
import { StudentModel } from "@/schema/admin/student-model";
import { StaffModel } from "@/schema/admin/staff-model";
import { ClassModel } from "@/schema/admin/class-model";
import { CurriculumModel } from "@/schema/books/curriculam-model";
import { GradeBookModel } from "@/schema/books/gradeBook-model";
import { ChapterModel } from "@/schema/books/chapter-model";
import { ChapterContentModel } from "@/schema/books/chapterContent-model";
import { TeachingProgressModel } from "@/schema/staff/teaching-progress-model";
import { ClassSessionModel } from "@/schema/staff/class-session-model";
import { Types } from "mongoose";

// ── helpers ──

function getMonthLabel(m: number) {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
}

function sixMonthsAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildDateFilter(year?: number, month?: number) {
  if (!year && !month) return { $gte: sixMonthsAgo() };
  const filter: any = {};
  if (year && month) {
    filter.$gte = new Date(year, month - 1, 1);
    filter.$lt = new Date(year, month, 1);
  } else if (year) {
    filter.$gte = new Date(year, 0, 1);
    filter.$lt = new Date(year + 1, 0, 1);
  }
  return filter;
}

function relativeTime(date: Date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

// ── Super Admin stats ──

async function superAdminStats() {
  const [
    totalInstitutions,
    activeInstitutions,
    totalStudents,
    activeStudents,
    totalStaff,
    activeStaff,
    totalClasses,
    totalCurriculums,
    publishedCurriculums,
    totalGradeBooks,
    totalChapters,
    totalContent,
    contentByTypeAgg,
    enrollmentAgg,
    institutionList,
    progressByInstitution,
    recentStudents,
    recentStaff,
  ] = await Promise.all([
    InstitutionModel.countDocuments({ isDeleted: { $ne: true } }),
    InstitutionModel.countDocuments({ isActive: true, isDeleted: { $ne: true } }),
    StudentModel.countDocuments({ isDeleted: { $ne: true } }),
    StudentModel.countDocuments({ isActive: true, isDeleted: { $ne: true } }),
    StaffModel.countDocuments({ isDeleted: { $ne: true } }),
    StaffModel.countDocuments({ isActive: true, isDeleted: { $ne: true } }),
    ClassModel.countDocuments({ isDeleted: { $ne: true } }),
    CurriculumModel.countDocuments(),
    CurriculumModel.countDocuments({ isPublished: true }),
    GradeBookModel.countDocuments(),
    ChapterModel.countDocuments(),
    ChapterContentModel.countDocuments(),
    ChapterContentModel.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),
    StudentModel.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo() }, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
    InstitutionModel.find({ isDeleted: { $ne: true } })
      .select("name isActive")
      .lean(),
    TeachingProgressModel.aggregate([
      {
        $group: {
          _id: "$institutionId",
          avgProgress: { $avg: "$overallPercentage" },
        },
      },
    ]),
    StudentModel.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name createdAt institutionId")
      .lean(),
    StaffModel.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name type createdAt institutionId")
      .lean(),
  ]);

  // content by type map
  const contentByType: Record<string, number> = {};
  for (const row of contentByTypeAgg) {
    contentByType[row._id] = row.count;
  }

  // enrollment trend
  const enrollmentTrend = enrollmentAgg.map((r: any) => ({
    month: getMonthLabel(r._id.month),
    count: r.count,
  }));

  // institution overview with counts
  const instStudentCounts = await StudentModel.aggregate([
    { $match: { isDeleted: { $ne: true } } },
    { $group: { _id: "$institutionId", count: { $sum: 1 } } },
  ]);
  const instStaffCounts = await StaffModel.aggregate([
    { $match: { isDeleted: { $ne: true } } },
    { $group: { _id: "$institutionId", count: { $sum: 1 } } },
  ]);
  const instClassCounts = await ClassModel.aggregate([
    { $match: { isDeleted: { $ne: true } } },
    { $group: { _id: "$institutionId", count: { $sum: 1 } } },
  ]);

  const toMap = (arr: any[]) => {
    const m: Record<string, number> = {};
    for (const r of arr) m[r._id?.toString()] = r.count;
    return m;
  };
  const studentMap = toMap(instStudentCounts);
  const staffMap = toMap(instStaffCounts);
  const classMap = toMap(instClassCounts);
  const progressMap: Record<string, number> = {};
  for (const r of progressByInstitution) {
    progressMap[r._id?.toString()] = Math.round(r.avgProgress || 0);
  }

  const institutionOverview = institutionList.map((inst: any) => ({
    _id: inst._id,
    name: inst.name,
    isActive: inst.isActive,
    students: studentMap[inst._id.toString()] || 0,
    staff: staffMap[inst._id.toString()] || 0,
    classes: classMap[inst._id.toString()] || 0,
    avgProgress: progressMap[inst._id.toString()] || 0,
  }));

  // recent activity (merge students + staff, sort by createdAt)
  const recentActivity = [
    ...recentStudents.map((s: any) => ({
      type: "student" as const,
      name: s.name,
      action: "Student enrolled",
      time: relativeTime(s.createdAt),
      createdAt: s.createdAt,
    })),
    ...recentStaff.map((s: any) => ({
      type: "staff" as const,
      name: s.name,
      action: s.type === "teacher" ? "Teacher joined" : "Staff added",
      time: relativeTime(s.createdAt),
      createdAt: s.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return {
    totalInstitutions,
    activeInstitutions,
    totalStudents,
    activeStudents,
    totalStaff,
    activeStaff,
    totalClasses,
    totalCurriculums,
    publishedCurriculums,
    totalGradeBooks,
    totalChapters,
    totalContent,
    contentByType,
    enrollmentTrend,
    institutionOverview,
    recentActivity,
  };
}

// ── Admin stats (institution-scoped) ──

async function adminStats(institutionId: string, filters: { year?: number; month?: number; classId?: string }) {
  const instId = new Types.ObjectId(institutionId);
  const dateFilter = buildDateFilter(filters.year, filters.month);

  // Build class filter for optional class-specific queries
  const classFilter: any = { institutionId: instId, isDeleted: { $ne: true } };
  if (filters.classId) classFilter._id = new Types.ObjectId(filters.classId);

  const [
    totalStudents,
    activeStudents,
    totalStaff,
    activeStaff,
    totalClasses,
    institution,
    classSizes,
    teacherProgressAgg,
    progressByBookAgg,
    recentSessions,
    studentGrowthAgg,
    genderAgg,
    sessionsByMonthAgg,
    classActivityAgg,
  ] = await Promise.all([
    StudentModel.countDocuments({ institutionId: instId, isDeleted: { $ne: true } }),
    StudentModel.countDocuments({ institutionId: instId, isActive: true, isDeleted: { $ne: true } }),
    StaffModel.countDocuments({ institutionId: instId, isDeleted: { $ne: true } }),
    StaffModel.countDocuments({ institutionId: instId, isActive: true, isDeleted: { $ne: true } }),
    ClassModel.countDocuments({ institutionId: instId, isDeleted: { $ne: true } }),
    InstitutionModel.findById(instId).select("name curriculumAccess").lean(),
    ClassModel.find(classFilter)
      .select("grade section studentIds")
      .lean(),
    TeachingProgressModel.aggregate([
      { $match: { institutionId: instId } },
      {
        $group: {
          _id: "$staffId",
          avgProgress: { $avg: "$overallPercentage" },
          totalRecords: { $sum: 1 },
        },
      },
      { $sort: { avgProgress: -1 } },
      { $limit: 5 },
    ]),
    TeachingProgressModel.aggregate([
      { $match: { institutionId: instId } },
      {
        $group: {
          _id: "$gradeBookId",
          avgProgress: { $avg: "$overallPercentage" },
        },
      },
    ]),
    ClassSessionModel.find({ institutionId: instId })
      .sort({ startTime: -1 })
      .limit(8)
      .populate("staffId", "name")
      .populate("classId", "grade section")
      .lean(),
    StudentModel.aggregate([
      {
        $match: {
          institutionId: instId,
          createdAt: dateFilter,
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
    // Gender distribution
    StudentModel.aggregate([
      { $match: { institutionId: instId, isDeleted: { $ne: true } } },
      { $group: { _id: "$gender", count: { $sum: 1 } } },
    ]),
    // Sessions by month
    ClassSessionModel.aggregate([
      {
        $match: {
          institutionId: instId,
          startTime: dateFilter,
        },
      },
      {
        $group: {
          _id: { year: { $year: "$startTime" }, month: { $month: "$startTime" } },
          count: { $sum: 1 },
          totalMinutes: { $sum: { $ifNull: ["$durationMinutes", 0] } },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
    // Class activity (sessions per class)
    ClassSessionModel.aggregate([
      {
        $match: {
          institutionId: instId,
          startTime: dateFilter,
        },
      },
      {
        $group: {
          _id: "$classId",
          sessions: { $sum: 1 },
          totalMinutes: { $sum: { $ifNull: ["$durationMinutes", 0] } },
        },
      },
    ]),
  ]);

  const curriculumAccessCount = institution?.curriculumAccess?.length || 0;

  // avg teaching progress
  const avgProgressAgg = await TeachingProgressModel.aggregate([
    { $match: { institutionId: instId } },
    { $group: { _id: null, avg: { $avg: "$overallPercentage" } } },
  ]);
  const avgTeachingProgress = Math.round(avgProgressAgg[0]?.avg || 0);

  // class size distribution
  const classSizeDistribution = classSizes.map((c: any) => ({
    class: `${c.grade || "?"}–${c.section}`,
    students: c.studentIds?.length || 0,
  }));

  // teacher leaderboard — resolve names
  const teacherIds = teacherProgressAgg.map((t: any) => t._id);
  const teacherDocs = await StaffModel.find({ _id: { $in: teacherIds } })
    .select("name profileImage")
    .lean();
  const teacherMap: Record<string, any> = {};
  for (const t of teacherDocs) teacherMap[(t._id as any).toString()] = t;

  const teacherLeaderboard = teacherProgressAgg.map((t: any) => ({
    _id: t._id,
    name: teacherMap[t._id.toString()]?.name || "Unknown",
    profileImage: teacherMap[t._id.toString()]?.profileImage || "",
    avgProgress: Math.round(t.avgProgress || 0),
  }));

  // progress by book — resolve titles
  const bookIds = progressByBookAgg.map((b: any) => b._id);
  const bookDocs = await GradeBookModel.find({ _id: { $in: bookIds } })
    .select("bookTitle grade")
    .lean();
  const bookMap: Record<string, any> = {};
  for (const b of bookDocs) bookMap[b._id.toString()] = b;

  const teachingProgressByBook = progressByBookAgg.map((b: any) => ({
    _id: b._id,
    bookTitle: bookMap[b._id.toString()]?.bookTitle || "Unknown",
    grade: bookMap[b._id.toString()]?.grade || 0,
    avgProgress: Math.round(b.avgProgress || 0),
  }));

  // student growth
  const studentGrowth = studentGrowthAgg.map((r: any) => ({
    month: getMonthLabel(r._id.month),
    count: r.count,
  }));

  // recent sessions
  const formattedSessions = recentSessions.map((s: any) => ({
    _id: s._id,
    teacher: (s.staffId as any)?.name || "Unknown",
    class: `${(s.classId as any)?.grade || "?"}–${(s.classId as any)?.section || "?"}`,
    duration: s.durationMinutes || 0,
    topics: s.topicsCovered || [],
    status: s.status,
    time: relativeTime(s.startTime),
  }));

  // Gender distribution
  const genderDistribution = genderAgg.map((g: any) => ({
    name: g._id || "Not specified",
    value: g.count,
  }));

  // Sessions by month
  const sessionsByMonth = sessionsByMonthAgg.map((r: any) => ({
    month: getMonthLabel(r._id.month),
    sessions: r.count,
    minutes: r.totalMinutes,
  }));

  // Class activity — resolve class names
  const classActivityIds = classActivityAgg.map((c: any) => c._id);
  const classDocs = await ClassModel.find({ _id: { $in: classActivityIds } })
    .select("grade section")
    .lean();
  const classNameMap: Record<string, string> = {};
  for (const c of classDocs) classNameMap[(c._id as any).toString()] = `${(c as any).grade || "?"}–${c.section}`;

  const classActivity = classActivityAgg.map((c: any) => ({
    class: classNameMap[c._id?.toString()] || "Unknown",
    sessions: c.sessions,
    minutes: c.totalMinutes,
  }));

  // Course distribution — grade books per curriculum
  const courseDistAgg = await GradeBookModel.aggregate([
    {
      $lookup: {
        from: "curriculums",
        localField: "curriculumId",
        foreignField: "_id",
        as: "curriculum",
      },
    },
    { $unwind: "$curriculum" },
    {
      $group: {
        _id: "$curriculumId",
        name: { $first: "$curriculum.name" },
        books: { $sum: 1 },
      },
    },
  ]);
  const courseDistribution = courseDistAgg.map((c: any) => ({
    name: c.name,
    value: c.books,
  }));

  return {
    totalStudents,
    activeStudents,
    totalStaff,
    activeStaff,
    totalClasses,
    curriculumAccessCount,
    avgTeachingProgress,
    classSizeDistribution,
    teacherLeaderboard,
    teachingProgressByBook,
    studentGrowth,
    recentSessions: formattedSessions,
    institutionName: institution?.name || "",
    // New fields
    genderDistribution,
    sessionsByMonth,
    classActivity,
    courseDistribution,
    schoolProgress: avgTeachingProgress,
  };
}

// ── Teacher stats ──

async function teacherStats(staffId: string, institutionId: string) {
  const sId = new Types.ObjectId(staffId);
  const iId = institutionId ? new Types.ObjectId(institutionId) : null;

  const [
    myClasses,
    progressRecords,
    sessionCount,
    recentSessions,
    sessionsByMonthAgg,
  ] = await Promise.all([
    ClassModel.find({ teacherIds: sId, isDeleted: { $ne: true } })
      .select("grade section studentIds year")
      .lean(),
    TeachingProgressModel.find({ staffId: sId })
      .sort({ lastAccessedAt: -1 })
      .populate("gradeBookId", "bookTitle grade totalChapters coverImage")
      .populate("classId", "grade section")
      .lean(),
    ClassSessionModel.countDocuments({ staffId: sId }),
    ClassSessionModel.find({ staffId: sId })
      .sort({ startTime: -1 })
      .limit(5)
      .populate("classId", "grade section")
      .lean(),
    // Sessions by month for teacher
    ClassSessionModel.aggregate([
      { $match: { staffId: sId, startTime: { $gte: sixMonthsAgo() } } },
      {
        $group: {
          _id: { year: { $year: "$startTime" }, month: { $month: "$startTime" } },
          count: { $sum: 1 },
          totalMinutes: { $sum: { $ifNull: ["$durationMinutes", 0] } },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
  ]);

  const totalStudents = myClasses.reduce((sum, c: any) => sum + (c.studentIds?.length || 0), 0);

  // overall progress
  const overallProgress =
    progressRecords.length > 0
      ? Math.round(
          progressRecords.reduce((s, p: any) => s + (p.overallPercentage || 0), 0) /
            progressRecords.length
        )
      : 0;

  // continue teaching — most recently accessed
  let continueTeaching = null;
  if (progressRecords.length > 0) {
    const latest: any = progressRecords[0];
    const gb: any = latest.gradeBookId;
    const cl: any = latest.classId;
    const completedContent = latest.contentProgress?.filter((c: any) => c.isCompleted).length || 0;
    const totalContent = latest.contentProgress?.length || 0;
    continueTeaching = {
      gradeBookId: gb?._id,
      classId: cl?._id,
      bookTitle: gb?.bookTitle || "Unknown",
      grade: gb?.grade || 0,
      coverImage: gb?.coverImage || "",
      class: cl ? `${cl.grade}–${cl.section}` : "",
      progress: latest.overallPercentage || 0,
      completedContent,
      totalContent,
      lastAccessedAt: latest.lastAccessedAt,
      lastAccessedLabel: relativeTime(latest.lastAccessedAt),
    };
  }

  // progress by grade book
  const progressByGradeBook = progressRecords.map((p: any) => {
    const gb: any = p.gradeBookId;
    const cl: any = p.classId;
    const done = p.contentProgress?.filter((c: any) => c.isCompleted).length || 0;
    const total = p.contentProgress?.length || 0;
    return {
      _id: p._id,
      gradeBookId: gb?._id,
      bookTitle: gb?.bookTitle || "Unknown",
      grade: gb?.grade || 0,
      class: cl ? `${cl.grade}–${cl.section}` : "",
      progress: p.overallPercentage || 0,
      completedContent: done,
      totalContent: total,
    };
  });

  // format my classes with progress
  const myClassesFormatted = myClasses.map((c: any) => {
    const classProgress = progressRecords.filter(
      (p: any) => p.classId?._id?.toString() === c._id.toString()
    );
    const avgProg =
      classProgress.length > 0
        ? Math.round(
            classProgress.reduce((s, p: any) => s + (p.overallPercentage || 0), 0) /
              classProgress.length
          )
        : 0;
    const lastAccessed = classProgress.length > 0
      ? classProgress.sort(
          (a: any, b: any) =>
            new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
        )[0]?.lastAccessedAt
      : null;

    return {
      _id: c._id,
      grade: c.grade,
      section: c.section,
      year: c.year,
      students: c.studentIds?.length || 0,
      avgProgress: avgProg,
      lastAccessed: lastAccessed ? relativeTime(lastAccessed) : "Never",
    };
  });

  // recent sessions
  const formattedSessions = recentSessions.map((s: any) => ({
    _id: s._id,
    class: `${(s.classId as any)?.grade || "?"}–${(s.classId as any)?.section || "?"}`,
    duration: s.durationMinutes || 0,
    topics: s.topicsCovered || [],
    status: s.status,
    time: relativeTime(s.startTime),
    startTime: s.startTime,
  }));

  // Progress by class (for RadarChart)
  const progressByClass = myClassesFormatted.map((c) => ({
    classLabel: `${c.grade || "?"}–${c.section}`,
    avgProgress: c.avgProgress,
  }));

  // Sessions by month
  const sessionsByMonth = sessionsByMonthAgg.map((r: any) => ({
    month: getMonthLabel(r._id.month),
    sessions: r.count,
    minutes: r.totalMinutes,
  }));

  return {
    myClasses: myClassesFormatted,
    totalStudents,
    overallProgress,
    totalSessions: sessionCount,
    continueTeaching,
    progressByGradeBook,
    recentSessions: formattedSessions,
    // New fields
    progressByClass,
    sessionsByMonth,
  };
}

// ── Controller ──

export const dashboardController = new Elysia({
  prefix: "/dashboard",
  tags: ["Dashboard"],
})
  .use(adminAuthMacro)
  .guard({ isAuth: true })
  .get("/stats", async ({ user, query }) => {
    const role = user.role;

    if (role === "super_admin") {
      const data = await superAdminStats();
      return { success: true, role: "super_admin", data };
    }

    if (role === "admin") {
      const institutionId =
        typeof user.institutionId === "object"
          ? (user.institutionId as any)._id?.toString()
          : user.institutionId?.toString();
      if (!institutionId) {
        return { success: false, message: "No institution assigned" };
      }
      const filters = {
        year: query.year ? Number(query.year) : undefined,
        month: query.month ? Number(query.month) : undefined,
        classId: query.classId || undefined,
      };
      const data = await adminStats(institutionId, filters);
      return { success: true, role: "admin", data };
    }

    if (role === "teacher" || role === "staff") {
      const staffId = (user._id || user.id)?.toString();
      const institutionId =
        typeof user.institutionId === "object"
          ? (user.institutionId as any)._id?.toString()
          : user.institutionId?.toString();
      if (!staffId) {
        return { success: false, message: "Invalid user" };
      }
      const data = await teacherStats(staffId, institutionId || "");
      return { success: true, role: "teacher", data };
    }

    return { success: false, message: "Unknown role" };
  }, {
    query: t.Object({
      year: t.Optional(t.String()),
      month: t.Optional(t.String()),
      classId: t.Optional(t.String()),
    }),
  });
