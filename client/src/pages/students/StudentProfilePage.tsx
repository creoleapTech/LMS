"use client";

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { _axios } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  GraduationCap,
  BookOpen,
  Award,
  ClipboardList,
  Zap,
  Clock,
  Trophy,
  Users,
  Mail,
  Phone,
  MapPin,
  Calendar,
  User,
  Building2,
  CheckCircle2,
  XCircle,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  FileText,
  Circle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface Props {
  id: string;
}

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6"];
const GRADIENTS = {
  emerald: "from-emerald-500 via-teal-500 to-cyan-600",
  amber: "from-amber-500 via-orange-500 to-pink-500",
  violet: "from-violet-500 via-purple-500 to-fuchsia-600",
};

function initials(name: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function StudentProfilePage({ id }: Props) {
  const navigate = useNavigate();
  const { data: profile, isLoading, isError, error } = useQuery<any>({
    queryKey: ["student-profile", id],
    queryFn: async () => {
      const res = await _axios.get(`/admin/students/${id}/profile`);
      return res.data.data;
    },
    enabled: !!id,
  });

  if (isLoading) return <StudentProfileSkeleton />;
  if (isError || !profile) {
    return (
      <div className="py-10 px-5 sm:px-8 max-w-screen-2xl mx-auto text-center">
        <Button variant="ghost" onClick={() => navigate({ to: "/students" as any })} className="mb-6 gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Students
        </Button>
        <Card className="max-w-lg mx-auto p-10 border-dashed">
          <XCircle className="h-12 w-12 mx-auto text-destructive/60 mb-4" />
          <p className="font-semibold text-lg">Failed to load student profile</p>
          <p className="text-sm text-muted-foreground mt-2">{(error as any)?.response?.data?.message || "Student not found or access denied"}</p>
        </Card>
      </div>
    );
  }

  const student = profile.student;
  const classInfo = profile.class;
  const institution = profile.institution;
  const gradeBook = profile.gradeBook;
  const chapters: any[] = profile.chapters || [];
  const contents: any[] = profile.contents || [];
  const teachingStats = profile.teachingStats;
  const teachingProgress = profile.teachingProgress;
  const examinations: any[] = profile.examinations || [];
  const quizzes: any[] = profile.quizzes || [];
  const quizStats = profile.quizStats;
  const overallStats = profile.overallStats || {};

  const classLabel = classInfo ? `${classInfo.grade ?? ""} - ${classInfo.section}` : "Unassigned";
  const studentName = student.name || "Unnamed Student";
  const roll = student.rollNumber || student.username || "-";
  const admissionNo = student.admissionNumber || "-";

  // Chart data — real per-student data: assessments + quizzes
  const assessmentChartData = examinations
    .filter((e) => e.percentage !== null)
    .slice(0, 6)
    .map((e) => ({ name: e.name.slice(0, 14), value: e.percentage ?? 0 }));
  const quizChartData = quizzes.slice(0, 6).map((q: any) => ({
    name: q.quizTitle.slice(0, 14),
    score: q.percentage,
  }));

  // Teaching progress data
  const chapterProgressData = chapters.slice(0, 10).map((ch: any) => {
    const chContents = contents.filter((c: any) => c.chapterId === ch.id);
    const teachingSet = new Set<string>(
      (teachingProgress?.contents || [])
        .filter((tc: any) => tc.isCompleted === 1 && tc.chapterId === ch.id)
        .map((tc: any) => tc.contentId)
    );
    const total = chContents.length || 0;
    const taught = chContents.filter((c: any) => teachingSet.has(c.id)).length;
    const pct = total > 0 ? Math.round((taught / total) * 100) : 0;
    return {
      id: ch.id,
      name: ch.title?.slice(0, 22) || `Ch ${ch.chapterNumber ?? ch.order ?? ""}`,
      chapterNumber: ch.chapterNumber ?? ch.order ?? "",
      taught,
      total,
      pct,
      duration: ch.durationMinutes ?? 0,
    };
  });

  const totalTaught = chapterProgressData.reduce((s, ch) => s + ch.taught, 0);
  const totalContents = chapterProgressData.reduce((s, ch) => s + ch.total, 0);
  const overallPct = totalContents > 0 ? Math.round((totalTaught / totalContents) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20">
      <div className="max-w-screen-2xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Back */}
        <Button
          variant="ghost"
          onClick={() => {
            if (window.history.length > 1) window.history.back();
            else navigate({ to: "/students" as any });
          }}
          className="gap-2 rounded-full"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {/* ═══════════════════════════════════════════════════════════════
            PROFILE CARD — full width, single-page hero
        ═══════════════════════════════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-[24px] border border-white/60 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 backdrop-blur shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10" />
          <div className="absolute -top-24 -right-24 h-72 w-72 bg-gradient-to-br from-indigo-400 to-violet-400 rounded-full blur-[80px] opacity-20" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 bg-gradient-to-br from-emerald-400 to-teal-400 rounded-full blur-[80px] opacity-20" />
          <div className="relative p-6 sm:p-8 flex flex-col lg:flex-row gap-6 items-start">
            {/* Avatar */}
            <div className="shrink-0">
              {student.profileImage ? (
                <img src={student.profileImage} alt={studentName} className="h-24 w-24 rounded-[20px] object-cover border-4 border-white shadow-lg" />
              ) : (
                <div className="h-24 w-24 rounded-[20px] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 flex items-center justify-center text-white text-2xl font-black shadow-lg border-4 border-white">
                  {initials(studentName)}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">{studentName}</h1>
                <Badge className="rounded-full bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {student.isActive ? "Active" : "Inactive"}
                </Badge>
                {classInfo && (
                  <Badge variant="outline" className="rounded-full bg-white gap-1 font-semibold">
                    <GraduationCap className="h-3.5 w-3.5 text-indigo-600" /> Class {classLabel}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge className="rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono font-bold">
                  LMS: {roll}
                </Badge>
                <Badge variant="secondary" className="rounded-full font-mono">
                  Adm: {admissionNo}
                </Badge>
                {institution && (
                  <Badge variant="outline" className="rounded-full gap-1 bg-white">
                    <Building2 className="h-3.5 w-3.5" /> {institution.name}
                  </Badge>
                )}
                {gradeBook && (
                  <Badge variant="outline" className="rounded-full bg-white gap-1">
                    <BookOpen className="h-3.5 w-3.5 text-violet-600" /> {gradeBook.bookTitle || `Grade ${gradeBook.grade}`}
                  </Badge>
                )}
              </div>
              {/* Contact grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5 text-sm">
                {student.email && (
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
                      <Mail className="h-4 w-4 text-blue-600" />
                    </span>
                    <span className="truncate">{student.email}</span>
                  </span>
                )}
                {student.mobileNumber && (
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                      <Phone className="h-4 w-4 text-emerald-600" />
                    </span>
                    {student.mobileNumber}
                  </span>
                )}
                {student.parentName && (
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="h-8 w-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
                      <User className="h-4 w-4 text-amber-600" />
                    </span>
                    Parent: {student.parentName} {student.parentMobile ? `• ${student.parentMobile}` : ""}
                  </span>
                )}
                {student.dateOfBirth && (
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="h-8 w-8 rounded-xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-violet-600" />
                    </span>
                    DOB: {new Date(student.dateOfBirth).toLocaleDateString()}
                  </span>
                )}
                {student.gender && (
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 capitalize">
                    <span className="h-8 w-8 rounded-xl bg-pink-50 dark:bg-pink-950/40 flex items-center justify-center">
                      <Users className="h-4 w-4 text-pink-600" />
                    </span>
                    {student.gender}
                  </span>
                )}
                {student.address && (
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-slate-600" />
                    </span>
                    <span className="truncate">{student.address}</span>
                  </span>
                )}
              </div>
              {/* Quick Facts Row */}
              <div className="flex flex-wrap gap-4 mt-5 pt-5 border-t border-slate-200/60 dark:border-slate-700/60 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span className="text-muted-foreground">Enrolled</span>
                  <span className="font-mono font-semibold">{new Date(student.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span className="text-muted-foreground">Updated</span>
                  <span className="font-mono font-semibold">{new Date(student.updatedAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-slate-400" />
                  <span className="text-muted-foreground">Exams</span>
                  <span className="font-semibold">{examinations.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-slate-400" />
                  <span className="text-muted-foreground">Quiz Attempts</span>
                  <span className="font-semibold">{quizStats?.totalAttempts ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            STATS ROW
        ═══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard
            title="Class Progress"
            value={`${overallPct}%`}
            subtitle={`${totalTaught}/${totalContents} contents • ${teachingStats?.completedChapters ?? 0}/${teachingStats?.totalChapters ?? 0} chapters`}
            icon={TrendingUp}
            gradient="from-blue-500 via-indigo-500 to-violet-600"
            trend={overallPct >= 75 ? "Excellent coverage" : overallPct >= 50 ? "Halfway there" : "Early stages"}
          />
          <StatsCard
            title="Assessments Avg"
            value={`${overallStats.avgExam ?? 0}%`}
            subtitle={`${examinations.length} exams • ${examinations.filter((e: any) => e.percentage !== null).length} graded`}
            icon={Award}
            gradient={GRADIENTS.amber}
            trend={overallStats.avgExam >= 75 ? "High performer" : overallStats.avgExam >= 50 ? "Average" : "Needs support"}
          />
          <StatsCard
            title="Quizzes Avg"
            value={`${overallStats.avgQuiz ?? 0}%`}
            subtitle={`${quizStats?.totalAttempts ?? 0} attempts • ${quizStats?.totalQuizzes ?? 0} quizzes • best ${quizStats?.bestPercentage ?? 0}%`}
            icon={Zap}
            gradient={GRADIENTS.violet}
            trend={quizStats?.passedCount ? `${quizStats.passedCount} passed` : "No passes yet"}
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION: LEARNING PROGRESS
        ═══════════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md">
              <TrendingUp className="h-5 w-5 text-white" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Learning Progress</h2>
              <p className="text-sm text-muted-foreground">Teaching coverage for this class</p>
            </div>
          </div>
          {!gradeBook ? (
            <Card className="p-10 text-center border-dashed">
              <BookOpen className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="font-semibold">No curriculum assigned to this class</p>
              <p className="text-sm text-muted-foreground mt-1">Assign a curriculum to Class {classInfo?.grade} to track teaching progress</p>
            </Card>
          ) : (
            <>
              {/* Hero Stats Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Main Coverage Donut */}
                <Card className="lg:col-span-1 overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center">
                      <div className="relative h-[180px] w-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: "Taught", value: totalTaught, fill: "#6366f1" },
                                { name: "Remaining", value: Math.max(0, totalContents - totalTaught), fill: "#e2e8f0" },
                              ]}
                              dataKey="value"
                              innerRadius={55}
                              outerRadius={80}
                              paddingAngle={3}
                              stroke="none"
                              startAngle={90}
                              endAngle={-270}
                            >
                              <Cell fill="#6366f1" />
                              <Cell fill="#e2e8f0" />
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <p className="text-3xl font-black text-indigo-600">{overallPct}%</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Covered</p>
                        </div>
                      </div>
                      <div className="mt-4 text-center space-y-1">
                        <p className="text-sm font-semibold">{totalTaught} of {totalContents} items taught</p>
                        <p className="text-xs text-muted-foreground">{teachingStats?.completedChapters ?? 0} of {teachingStats?.totalChapters ?? 0} chapters completed</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Chapter Progress Bars */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="h-4 w-4 text-indigo-600" /> Chapter Coverage
                    </CardTitle>
                    <CardDescription>Teaching progress per chapter — based on class sessions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {chapterProgressData.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-8 text-center">No chapters in this grade book</p>
                    ) : (
                      <div className="space-y-3">
                        {chapterProgressData.map((ch) => (
                          <div key={ch.id} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-bold text-slate-400 w-6 text-right shrink-0">
                                  {ch.chapterNumber ? `${ch.chapterNumber}.` : ""}
                                </span>
                                <span className="text-sm font-medium truncate">{ch.name}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="text-xs text-muted-foreground">{ch.taught}/{ch.total}</span>
                                <span className={`text-xs font-bold ${ch.pct >= 75 ? "text-emerald-600" : ch.pct >= 50 ? "text-amber-600" : ch.pct > 0 ? "text-indigo-600" : "text-slate-400"}`}>
                                  {ch.pct}%
                                </span>
                              </div>
                            </div>
                            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${ch.pct >= 75 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : ch.pct >= 50 ? "bg-gradient-to-r from-amber-500 to-amber-400" : ch.pct > 0 ? "bg-gradient-to-r from-indigo-500 to-violet-500" : "bg-slate-200"}`}
                                style={{ width: `${ch.pct}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Chapter Cards */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 px-1">Chapter Details</h3>
                {chapters.length === 0 ? (
                  <Card className="p-8 text-center border-dashed">
                    <p className="text-sm text-muted-foreground">No chapters available</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {chapters.map((ch: any) => {
                      const chContents = contents.filter((c: any) => c.chapterId === ch.id);
                      const teachingSet = new Set<string>(
                        (teachingProgress?.contents || [])
                          .filter((tc: any) => tc.chapterId === ch.id && tc.isCompleted === 1)
                          .map((tc: any) => tc.contentId)
                      );
                      const taught = chContents.filter((c: any) => teachingSet.has(c.id)).length;
                      const pct = chContents.length > 0 ? Math.round((taught / chContents.length) * 100) : 0;

                      return (
                        <Card key={ch.id} className="overflow-hidden">
                          <div className="flex items-stretch">
                            <div className={`w-1.5 shrink-0 ${pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : pct > 0 ? "bg-indigo-500" : "bg-slate-200"}`} />
                            <div className="flex-1 p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-sm">
                                      {ch.chapterNumber ? <span className="text-slate-400 mr-1">Ch {ch.chapterNumber}:</span> : null}
                                      {ch.title || "Untitled Chapter"}
                                    </p>
                                    <Badge variant="outline" className={`rounded-full text-[10px] font-bold px-2 py-0 ${pct >= 75 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : pct >= 50 ? "bg-amber-50 text-amber-700 border-amber-200" : pct > 0 ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
                                      {pct}%
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {chContents.length} items • {ch.durationMinutes ?? 0}m duration
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500" />
                                  <span className="font-semibold">{taught}/{chContents.length}</span>
                                  <span>taught</span>
                                </div>
                              </div>
                              {chContents.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-3">
                                  {chContents.map((ct: any) => {
                                    const isTaught = teachingSet.has(ct.id);
                                    return (
                                      <span
                                        key={ct.id}
                                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border ${isTaught ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-800 dark:text-indigo-300" : "bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"}`}
                                      >
                                        {isTaught ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3 opacity-40" />}
                                        <span className="truncate max-w-[120px]" title={ct.title}>{ct.title || ct.type}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION: ASSESSMENTS
        ═══════════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
              <Award className="h-5 w-5 text-white" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Assessments</h2>
              <p className="text-sm text-muted-foreground">Examination scores and performance</p>
            </div>
          </div>
          {examinations.length === 0 ? (
            <Card className="p-10 text-center border-dashed">
              <ClipboardList className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="font-semibold">No assessments for this student</p>
              <p className="text-sm text-muted-foreground mt-1">Examinations are linked to classes — create one targeting Class {classLabel}</p>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-amber-600" /> Assessment Performance
                  </CardTitle>
                  <CardDescription>Colorful bar of scores per examination</CardDescription>
                </CardHeader>
                <CardContent>
                  {assessmentChartData.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No graded number columns to chart — add marks to examinations</p>
                  ) : (
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={assessmentChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                            {assessmentChartData.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-6">
                {examinations.map((ex: any) => (
                  <Card key={ex.id} className="overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-b">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg">{ex.name}</CardTitle>
                          <CardDescription>
                            {ex.columns.length} columns • {ex.cells.filter((c: any) => c.type === "number" && c.value).length} scores entered •{" "}
                            {ex.createdAt ? new Date(ex.createdAt).toLocaleDateString() : ""}
                          </CardDescription>
                        </div>
                        {ex.percentage !== null && (
                          <Badge className={`rounded-full px-3 py-1 text-sm font-black ${ex.percentage >= 75 ? "bg-emerald-500" : ex.percentage >= 50 ? "bg-amber-500" : "bg-red-500"}`}>
                            {ex.percentage}% {ex.percentage >= 75 ? "Excellent" : ex.percentage >= 50 ? "Good" : "Needs Help"}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                              <th className="text-left p-3 font-bold">Subject / Column</th>
                              <th className="text-left p-3 font-bold">Type</th>
                              <th className="text-left p-3 font-bold">Max Marks</th>
                              <th className="text-left p-3 font-bold">Score</th>
                              <th className="text-left p-3 font-bold">% of Max</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ex.cells.map((cell: any) => {
                              const pct = cell.maxMarks && cell.value ? Number(((Number(cell.value) / Number(cell.maxMarks)) * 100).toFixed(1)) : null;
                              return (
                                <tr key={cell.columnId} className="border-b last:border-0 hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                                  <td className="p-3 font-medium">{cell.columnName}</td>
                                  <td className="p-3">
                                    <Badge variant="outline" className="rounded-full capitalize text-xs">
                                      {cell.type}
                                    </Badge>
                                  </td>
                                  <td className="p-3 font-mono">{cell.maxMarks ?? "-"}</td>
                                  <td className="p-3 font-mono font-bold">{cell.value || <span className="text-muted-foreground">—</span>}</td>
                                  <td className="p-3">
                                    {pct === null ? (
                                      <span className="text-muted-foreground">—</span>
                                    ) : (
                                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${pct >= 75 ? "bg-emerald-50 text-emerald-700" : pct >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                                        {pct}%
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                            {ex.cells.length === 0 && (
                              <tr>
                                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                  No marks entered for this student in this examination
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION: QUIZZES
        ═══════════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-md">
              <Trophy className="h-5 w-5 text-white" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Quizzes</h2>
              <p className="text-sm text-muted-foreground">Quiz attempts and scores</p>
            </div>
          </div>
          {quizzes.length === 0 ? (
            <Card className="p-10 text-center border-dashed">
              <Trophy className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="font-semibold">No quiz attempts yet</p>
              <p className="text-sm text-muted-foreground mt-1">Quizzes for this institution will appear here once the student attempts them</p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl p-4 bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-lg">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-80">Total Attempts</p>
                  <p className="text-2xl font-black mt-1">{quizStats.totalAttempts}</p>
                  <p className="text-xs opacity-80 mt-1">{quizStats.totalQuizzes} quizzes</p>
                </div>
                <div className="rounded-2xl p-4 bg-white dark:bg-slate-900 border shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Average Score</p>
                  <p className="text-2xl font-black mt-1 text-violet-600">{quizStats.avgPercentage}%</p>
                  <Progress value={quizStats.avgPercentage} className="mt-2 h-1.5" />
                </div>
                <div className="rounded-2xl p-4 bg-white dark:bg-slate-900 border shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Best Score</p>
                  <p className="text-2xl font-black mt-1 text-emerald-600">{quizStats.bestPercentage}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Personal best</p>
                </div>
                <div className="rounded-2xl p-4 bg-white dark:bg-slate-900 border shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Passed</p>
                  <p className="text-2xl font-black mt-1 text-amber-600">
                    {quizStats.passedCount}/{quizStats.totalAttempts}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Attempts passed</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-violet-600" /> Quiz Scores Trend
                    </CardTitle>
                    <CardDescription>Colorful scores per quiz (latest 6)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={quizChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="score" name="Score %" radius={[8, 8, 0, 0]}>
                            {quizChartData.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <PieIcon className="h-5 w-5 text-emerald-600" /> Pass / Fail
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Passed", value: quizStats.passedCount, fill: "#10b981" },
                              { name: "Failed / Pending", value: Math.max(0, quizStats.totalAttempts - quizStats.passedCount), fill: "#e2e8f0" },
                            ]}
                            dataKey="value"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                            stroke="none"
                          >
                            <Cell fill="#10b981" />
                            <Cell fill="#e2e8f0" />
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-slate-600" /> All Attempts
                  </CardTitle>
                  <CardDescription>Detailed timeline — most recent first</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b bg-slate-50 dark:bg-slate-800/50 text-xs font-bold uppercase tracking-wider text-slate-500">
                          <th className="text-left p-3">Quiz</th>
                          <th className="text-center p-3">Attempt</th>
                          <th className="text-center p-3">Score</th>
                          <th className="text-center p-3">%</th>
                          <th className="text-center p-3">Status</th>
                          <th className="text-left p-3">Date</th>
                          <th className="text-center p-3">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quizzes.map((q: any) => (
                          <tr key={q.id} className="border-b last:border-0 hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                            <td className="p-3 font-medium max-w-[220px] truncate" title={q.quizTitle}>
                              {q.quizTitle}
                            </td>
                            <td className="p-3 text-center font-mono">{q.attemptNumber}</td>
                            <td className="p-3 text-center font-mono font-bold">
                              {q.score}/{q.maxScore}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${q.percentage >= 75 ? "bg-emerald-50 text-emerald-700" : q.percentage >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                                {q.percentage}%
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {q.isPassed === null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : q.isPassed ? (
                                <Badge className="bg-emerald-500 rounded-full gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Pass
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="rounded-full gap-1 bg-red-50 text-red-700 border border-red-200">
                                  <XCircle className="h-3 w-3" /> Fail
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 text-xs">{q.completedAt ? new Date(q.completedAt).toLocaleString() : q.startedAt ? new Date(q.startedAt).toLocaleString() : "-"}</td>
                            <td className="p-3 text-center font-mono text-xs">{q.timeTakenSeconds ? `${Math.round(q.timeTakenSeconds / 60)}m` : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, subtitle, icon: Icon, gradient, trend }: any) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br ${gradient}`}>
      <div className="absolute -top-10 -right-10 h-32 w-32 bg-white/20 rounded-full blur-2xl" />
      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">{title}</p>
          <p className="text-2xl font-black mt-2 tracking-tight">{value}</p>
          <p className="text-xs font-medium opacity-80 mt-1 leading-snug line-clamp-2">{subtitle}</p>
          <p className="text-[11px] font-bold mt-3 bg-white/20 inline-flex px-2 py-1 rounded-full backdrop-blur">{trend}</p>
        </div>
        <div className="h-11 w-11 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur shrink-0 ml-3">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function StudentProfileSkeleton() {
  return (
    <div className="max-w-screen-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      <Skeleton className="h-10 w-24 rounded-full" />
      <Skeleton className="h-48 w-full rounded-[24px]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[400px] w-full rounded-2xl" />
    </div>
  );
}
