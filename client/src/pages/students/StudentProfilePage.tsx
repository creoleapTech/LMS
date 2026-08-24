"use client";

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { _axios } from "@/lib/axios";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Activity,
  FileText,
  Star,
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
  blue: "from-blue-500 via-indigo-500 to-violet-600",
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
  const examinations: any[] = profile.examinations || [];
  const quizzes: any[] = profile.quizzes || [];
  const quizStats = profile.quizStats;
  const overallStats = profile.overallStats || {};
  const teachingProgress = profile.teachingProgress;

  const classLabel = classInfo ? `${classInfo.grade ?? ""} - ${classInfo.section}` : "Unassigned";
  const studentName = student.name || "Unnamed Student";
  const roll = student.rollNumber || student.username || "-";
  const admissionNo = student.admissionNumber || "-";

  // Chart data — only use data we actually have: class teaching progress + real exam/quiz results
  const progressDonut = [
    { name: "Class Taught", value: teachingStats?.overallPercentage ?? 0, fill: "#6366f1" },
    { name: "Remaining", value: Math.max(0, 100 - (teachingStats?.overallPercentage ?? 0)), fill: "#e2e8f0" },
  ];
  const assessmentChartData = examinations
    .filter((e) => e.percentage !== null)
    .slice(0, 6)
    .map((e) => ({ name: e.name.slice(0, 14), value: e.percentage ?? 0 }));
  const quizChartData = quizzes.slice(0, 6).map((q: any) => ({
    name: q.quizTitle.slice(0, 14),
    score: q.percentage,
  }));
  const chapterProgressData = chapters.slice(0, 8).map((ch: any) => {
    const chContents = contents.filter((c: any) => c.chapterId === ch.id);
    const teachingSet = new Set<string>((teachingProgress?.contents || []).filter((tc: any) => tc.isCompleted === 1 && tc.chapterId === ch.id).map((tc: any) => tc.contentId));
    const total = chContents.length || 0;
    const taught = chContents.filter((c: any) => teachingSet.has(c.id)).length;
    return {
      name: ch.title?.slice(0, 18) || `Ch ${ch.chapterNumber ?? ch.order ?? ""}`,
      taught,
      total,
    };
  });

  // Overview bars: only teaching + real performance metrics
  const overviewPie = [
    { name: "Teaching", value: teachingStats?.overallPercentage ?? 0, fill: "#6366f1" },
    { name: "Assessments", value: overallStats.avgExam ?? 0, fill: "#f59e0b" },
    { name: "Quizzes", value: overallStats.avgQuiz ?? 0, fill: "#ec4899" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20">
      <div className="max-w-screen-2xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Back */}
        <Button
          variant="ghost"
          onClick={() => {
            // try history back, fallback to /students
            if (window.history.length > 1) window.history.back();
            else navigate({ to: "/students" as any });
          }}
          className="gap-2 rounded-full"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {/* Hero Header */}
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
            </div>
            {/* Quick progress mini */}
            <div className="hidden lg:flex flex-col gap-3 shrink-0 w-[220px]">
              <div className="rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Class Coverage</p>
                <p className="text-2xl font-black mt-1 text-indigo-600">{teachingStats?.overallPercentage ?? 0}%</p>
                <Progress value={teachingStats?.overallPercentage ?? 0} className="mt-2 h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {teachingStats?.completedContents ?? 0}/{teachingStats?.totalContents ?? 0} items
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row — only data we have: class teaching progress (real) + assessments + quizzes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatsCard
            title="Class Teaching Progress"
            value={`${teachingStats?.overallPercentage ?? 0}%`}
            subtitle={`${teachingStats?.completedContents ?? 0}/${teachingStats?.totalContents ?? 0} contents • ${teachingStats?.completedChapters ?? 0}/${teachingStats?.totalChapters ?? 0} chapters`}
            icon={BookOpen}
            gradient={GRADIENTS.blue}
            trend={teachingStats?.lastAccessedAt ? `Active ${new Date(teachingStats.lastAccessedAt).toLocaleDateString()}` : "No activity yet"}
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

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex flex-wrap w-full max-w-3xl h-auto min-h-12 rounded-xl p-1 gap-1 bg-white dark:bg-slate-900 border shadow-sm">
            <TabsTrigger value="overview" className="rounded-lg gap-1.5">
              <Activity className="h-4 w-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="progress" className="rounded-lg gap-1.5">
              <TrendingUp className="h-4 w-4" /> Learning Progress
            </TabsTrigger>
            <TabsTrigger value="assessments" className="rounded-lg gap-1.5">
              <ClipboardList className="h-4 w-4" /> Assessments
            </TabsTrigger>
            <TabsTrigger value="quizzes" className="rounded-lg gap-1.5">
              <Trophy className="h-4 w-4" /> Quizzes
            </TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-indigo-600" /> Progress Snapshot
                  </CardTitle>
                  <CardDescription>Class teaching coverage vs assessment & quiz averages — only real data</CardDescription>
                </CardHeader>
                <CardContent>
                  {overviewPie.every((p) => p.value === 0) ? (
                    <p className="text-sm text-muted-foreground py-10 text-center">No progress data yet</p>
                  ) : (
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={overviewPie}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                            {overviewPie.map((entry, idx) => (
                              <Cell key={idx} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <PieIcon className="h-4 w-4 text-indigo-600" /> Class Coverage
                    </CardTitle>
                    <CardDescription>How much of the curriculum the class has been taught</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col items-center">
                      <div className="h-[160px] w-full max-w-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={progressDonut} dataKey="value" innerRadius={44} outerRadius={68} paddingAngle={2} stroke="none">
                              {progressDonut.map((e, i) => (
                                <Cell key={i} fill={e.fill} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-2xl font-black text-indigo-600">{teachingStats?.overallPercentage ?? 0}%</p>
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Class Taught</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {teachingStats?.completedContents ?? 0}/{teachingStats?.totalContents ?? 0} items • {teachingStats?.completedChapters ?? 0}/{teachingStats?.totalChapters ?? 0} chapters
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clock className="h-4 w-4 text-slate-500" /> Quick Facts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Enrolled</span>
                      <span className="font-mono font-semibold">{new Date(student.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Updated</span>
                      <span className="font-mono font-semibold">{new Date(student.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Chapters</span>
                      <span className="font-semibold">
                        {teachingStats?.completedChapters ?? 0} / {teachingStats?.totalChapters ?? 0} taught
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Exams Taken</span>
                      <span className="font-semibold">{examinations.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quiz Attempts</span>
                      <span className="font-semibold">{quizStats?.totalAttempts ?? 0}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Recent Assessments preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Award className="h-5 w-5 text-amber-500" /> Recent Assessments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {examinations.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No assessments linked to this class yet</p>
                  ) : (
                    <div className="space-y-3">
                      {examinations.slice(0, 3).map((ex: any) => (
                        <div key={ex.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border">
                          <div>
                            <p className="font-semibold text-sm">{ex.name}</p>
                            <p className="text-xs text-muted-foreground">{ex.columns.length} columns</p>
                          </div>
                          <Badge
                            className={`rounded-full font-bold ${ex.percentage === null ? "bg-slate-200 text-slate-700" : ex.percentage >= 75 ? "bg-emerald-500" : ex.percentage >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                          >
                            {ex.percentage === null ? "No score" : `${ex.percentage}%`}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Zap className="h-5 w-5 text-violet-500" /> Recent Quizzes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {quizzes.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No quiz attempts yet</p>
                  ) : (
                    <div className="space-y-3">
                      {quizzes.slice(0, 3).map((q: any) => (
                        <div key={q.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm truncate">{q.quizTitle}</p>
                            <p className="text-xs text-muted-foreground">
                              {q.completedAt ? new Date(q.completedAt).toLocaleDateString() : "In progress"} • Attempt {q.attemptNumber}
                            </p>
                          </div>
                          <Badge className={`rounded-full shrink-0 ${q.percentage >= 75 ? "bg-emerald-500" : q.percentage >= 50 ? "bg-amber-500" : "bg-red-500"}`}>
                            {q.percentage}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Progress */}
          <TabsContent value="progress" className="space-y-6">
            {!gradeBook ? (
              <Card className="p-10 text-center border-dashed">
                <BookOpen className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                <p className="font-semibold">No curriculum assigned to this class</p>
                <p className="text-sm text-muted-foreground mt-1">Assign a curriculum to the class grade ({classInfo?.grade}) to track teaching progress</p>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-indigo-600" /> Chapter-wise Progress
                      </CardTitle>
                      <CardDescription>Class teaching progress per chapter — only real teaching data</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {chapterProgressData.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">No chapters in this grade book</p>
                      ) : (
                        <div className="h-[280px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chapterProgressData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} dy={10} height={60} />
                              <YAxis tick={{ fontSize: 12 }} />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="taught" name="Taught" fill="#6366f1" radius={[6, 6, 0, 0]} />
                              <Bar dataKey="total" name="Total" fill="#e2e8f0" radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <PieIcon className="h-5 w-5 text-violet-600" /> Coverage
                      </CardTitle>
                      <CardDescription>Based on real teaching-progress from class sessions</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm font-semibold mb-1">
                          <span>Class Coverage</span>
                          <span className="text-indigo-600">{teachingStats?.overallPercentage ?? 0}%</span>
                        </div>
                        <Progress value={teachingStats?.overallPercentage ?? 0} className="[&>div]:from-indigo-500 [&>div]:to-violet-600" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {teachingStats?.completedContents ?? 0} / {teachingStats?.totalContents ?? 0} contents • {teachingStats?.completedChapters ?? 0}/{teachingStats?.totalChapters ?? 0} chapters
                        </p>
                      </div>
                      <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 p-4 border border-indigo-100 dark:border-indigo-900">
                        <p className="text-sm font-semibold flex items-center gap-2">
                          <Star className="h-4 w-4 text-amber-500" /> Insight
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                          {(() => {
                            const c = teachingStats?.overallPercentage ?? 0;
                            if (c === 0) return "Class has not started covering the curriculum yet.";
                            if (c >= 90) return "Class has nearly completed the curriculum — excellent coverage!";
                            if (c >= 50) return "Class is halfway through the curriculum — steady progress.";
                            return "Class is in early stages of curriculum coverage.";
                          })()}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 border text-xs">
                        <p className="font-semibold flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5" /> Grade Book
                        </p>
                        <p className="text-muted-foreground mt-1">{gradeBook?.bookTitle || `Grade ${gradeBook?.grade ?? ""}`} • {chapters.length} chapters • {contents.length} contents</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed chapter list */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-slate-600" /> Chapter Details
                    </CardTitle>
                    <CardDescription>Colorful status per content item</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {chapters.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No chapters</p>
                    ) : (
                      chapters.map((ch: any) => {
                        const chContents = contents.filter((c: any) => c.chapterId === ch.id);
                        const teachingSet = new Set<string>((teachingProgress?.contents || []).filter((tc: any) => tc.chapterId === ch.id && tc.isCompleted === 1).map((tc: any) => tc.contentId));
                        return (
                          <div key={ch.id} className="rounded-2xl border bg-white dark:bg-slate-900 p-4 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-bold">
                                  {ch.chapterNumber ? `Ch ${ch.chapterNumber}: ` : ""}{ch.title || "Untitled Chapter"}
                                </p>
                                <p className="text-xs text-muted-foreground">{chContents.length} items • Duration {ch.durationMinutes ?? 0}m</p>
                              </div>
                              <Badge variant="outline" className="rounded-full gap-1">
                                <CheckCircle2 className="h-3 w-3 text-indigo-600" /> {teachingSet.size}/{chContents.length} taught
                              </Badge>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                              {chContents.map((ct: any) => {
                                const taught = teachingSet.has(ct.id);
                                return (
                                  <div
                                    key={ct.id}
                                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium ${taught ? "bg-indigo-50 border-indigo-200 text-indigo-800 dark:bg-indigo-950/30 dark:border-indigo-900 dark:text-indigo-300" : "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700"}`}
                                  >
                                    {taught ? <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600" /> : <Clock className="h-4 w-4 shrink-0 opacity-50" />}
                                    <span className="truncate" title={ct.title}>
                                      {ct.title || ct.type} • {ct.type}
                                    </span>
                                  </div>
                                );
                              })}
                              {chContents.length === 0 && <p className="text-xs text-muted-foreground col-span-full">No contents in this chapter</p>}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Assessments */}
          <TabsContent value="assessments" className="space-y-6">
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
          </TabsContent>

          {/* Quizzes */}
          <TabsContent value="quizzes" className="space-y-6">
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
          </TabsContent>
        </Tabs>
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
