"use client";

import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  ArrowLeft, BookOpen, Layers, Users, GraduationCap, ClipboardCheck, CalendarCheck,
  TrendingUp, Plus, Pencil, Trash2, Search, IndianRupee, Clock,
  CircleCheck, CircleEllipsis, X, BarChart3, UserCheck, BookText
} from "lucide-react";
import { toast } from "sonner";
import { CourseContentManager } from "./CourseContentManager";

interface Props {
  courseId: string;
}

type Batch = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  studentCount: number;
  status: "Active" | "Upcoming" | "Completed";
  instructor?: string;
};

type Student = {
  id: string;
  name: string;
  email: string;
  batchId: string;
  enrolledDate: string;
  status: "Active" | "Inactive";
};

type Progress = {
  studentId: string;
  studentName: string;
  overallPercentage: number;
  chaptersCompleted: number;
  totalChapters: number;
  lastActive: string;
};

type Assessment = {
  studentId: string;
  studentName: string;
  assessmentName: string;
  score: number;
  totalMarks: number;
  date: string;
  status: "Pass" | "Fail" | "Pending";
};

type Attendance = {
  studentId: string;
  studentName: string;
  totalClasses: number;
  attended: number;
  percentage: number;
};

const allCourses = new Map<string, { code: string; name: string; description?: string; thumbnail?: string; level: string; duration: string; fees: number; status: string; startDate: string }>([
  ["1", { code: "MATH101", name: "Mathematics Grade 10", description: "CBSE Math for Class 10 covering algebra, geometry, and trigonometry", level: "Intermediate", duration: "1 Year", fees: 25000, status: "Active", startDate: "2025-04-01" }],
  ["2", { code: "SCI202", name: "Physics Advanced", description: "Advanced physics concepts including mechanics, thermodynamics, and electromagnetism", level: "Advanced", duration: "6 Months", fees: 35000, status: "Active", startDate: "2025-06-15" }],
  ["3", { code: "ENG101", name: "English Foundation", description: "Foundational English language skills", level: "Beginner", duration: "3 Months", fees: 15000, status: "Inactive", startDate: "2025-01-10" }],
]);

const mockBatches: Batch[] = [
  { id: "b1", name: "Batch A - Morning", startDate: "2025-04-01", endDate: "2026-03-31", studentCount: 24, status: "Active", instructor: "Rajesh Kumar" },
  { id: "b2", name: "Batch B - Afternoon", startDate: "2025-04-01", endDate: "2026-03-31", studentCount: 18, status: "Active", instructor: "Priya Singh" },
  { id: "b3", name: "Batch C - Weekend", startDate: "2025-06-01", endDate: "2026-05-31", studentCount: 12, status: "Upcoming" },
];

const mockStudents: Student[] = [
  { id: "s1", name: "Aarav Sharma", email: "aarav@example.com", batchId: "b1", enrolledDate: "2025-04-01", status: "Active" },
  { id: "s2", name: "Ananya Patel", email: "ananya@example.com", batchId: "b1", enrolledDate: "2025-04-01", status: "Active" },
  { id: "s3", name: "Rohan Verma", email: "rohan@example.com", batchId: "b1", enrolledDate: "2025-04-01", status: "Active" },
  { id: "s4", name: "Priya Gupta", email: "priya@example.com", batchId: "b1", enrolledDate: "2025-04-05", status: "Active" },
  { id: "s5", name: "Arjun Nair", email: "arjun@example.com", batchId: "b1", enrolledDate: "2025-04-01", status: "Active" },
  { id: "s6", name: "Diya Reddy", email: "diya@example.com", batchId: "b1", enrolledDate: "2025-04-10", status: "Active" },
  { id: "s7", name: "Karan Joshi", email: "karan@example.com", batchId: "b2", enrolledDate: "2025-04-01", status: "Active" },
  { id: "s8", name: "Neha Kapoor", email: "neha@example.com", batchId: "b2", enrolledDate: "2025-04-02", status: "Active" },
  { id: "s9", name: "Vikram Singh", email: "vikram@example.com", batchId: "b2", enrolledDate: "2025-04-01", status: "Active" },
  { id: "s10", name: "Isha Mehta", email: "isha@example.com", batchId: "b2", enrolledDate: "2025-04-03", status: "Inactive" },
];

const mockProgress: Progress[] = [
  { studentId: "s1", studentName: "Aarav Sharma", overallPercentage: 82, chaptersCompleted: 9, totalChapters: 12, lastActive: "2025-06-28" },
  { studentId: "s2", studentName: "Ananya Patel", overallPercentage: 75, chaptersCompleted: 9, totalChapters: 12, lastActive: "2025-06-27" },
  { studentId: "s3", studentName: "Rohan Verma", overallPercentage: 91, chaptersCompleted: 11, totalChapters: 12, lastActive: "2025-06-29" },
  { studentId: "s4", studentName: "Priya Gupta", overallPercentage: 68, chaptersCompleted: 8, totalChapters: 12, lastActive: "2025-06-25" },
  { studentId: "s5", studentName: "Arjun Nair", overallPercentage: 45, chaptersCompleted: 5, totalChapters: 12, lastActive: "2025-06-20" },
  { studentId: "s6", studentName: "Diya Reddy", overallPercentage: 88, chaptersCompleted: 10, totalChapters: 12, lastActive: "2025-06-28" },
  { studentId: "s7", studentName: "Karan Joshi", overallPercentage: 73, chaptersCompleted: 8, totalChapters: 11, lastActive: "2025-06-26" },
  { studentId: "s8", studentName: "Neha Kapoor", overallPercentage: 95, chaptersCompleted: 10, totalChapters: 11, lastActive: "2025-06-29" },
  { studentId: "s9", studentName: "Vikram Singh", overallPercentage: 60, chaptersCompleted: 7, totalChapters: 11, lastActive: "2025-06-22" },
  { studentId: "s10", studentName: "Isha Mehta", overallPercentage: 30, chaptersCompleted: 3, totalChapters: 11, lastActive: "2025-06-15" },
];

const mockAssessments: Assessment[] = [
  { studentId: "s1", studentName: "Aarav Sharma", assessmentName: "Mid-Term Exam", score: 78, totalMarks: 100, date: "2025-05-15", status: "Pass" },
  { studentId: "s1", studentName: "Aarav Sharma", assessmentName: "Weekly Test 3", score: 18, totalMarks: 20, date: "2025-06-10", status: "Pass" },
  { studentId: "s2", studentName: "Ananya Patel", assessmentName: "Mid-Term Exam", score: 72, totalMarks: 100, date: "2025-05-15", status: "Pass" },
  { studentId: "s2", studentName: "Ananya Patel", assessmentName: "Weekly Test 3", score: 15, totalMarks: 20, date: "2025-06-10", status: "Pass" },
  { studentId: "s3", studentName: "Rohan Verma", assessmentName: "Mid-Term Exam", score: 88, totalMarks: 100, date: "2025-05-15", status: "Pass" },
  { studentId: "s3", studentName: "Rohan Verma", assessmentName: "Weekly Test 3", score: 19, totalMarks: 20, date: "2025-06-10", status: "Pass" },
  { studentId: "s4", studentName: "Priya Gupta", assessmentName: "Mid-Term Exam", score: 65, totalMarks: 100, date: "2025-05-15", status: "Pass" },
  { studentId: "s4", studentName: "Priya Gupta", assessmentName: "Weekly Test 3", score: 12, totalMarks: 20, date: "2025-06-10", status: "Pass" },
  { studentId: "s5", studentName: "Arjun Nair", assessmentName: "Mid-Term Exam", score: 45, totalMarks: 100, date: "2025-05-15", status: "Fail" },
  { studentId: "s5", studentName: "Arjun Nair", assessmentName: "Weekly Test 3", score: 8, totalMarks: 20, date: "2025-06-10", status: "Fail" },
  { studentId: "s6", studentName: "Diya Reddy", assessmentName: "Mid-Term Exam", score: 85, totalMarks: 100, date: "2025-05-15", status: "Pass" },
  { studentId: "s7", studentName: "Karan Joshi", assessmentName: "Mid-Term Exam", score: 70, totalMarks: 100, date: "2025-05-16", status: "Pass" },
  { studentId: "s8", studentName: "Neha Kapoor", assessmentName: "Mid-Term Exam", score: 92, totalMarks: 100, date: "2025-05-16", status: "Pass" },
  { studentId: "s9", studentName: "Vikram Singh", assessmentName: "Mid-Term Exam", score: 58, totalMarks: 100, date: "2025-05-16", status: "Fail" },
];

const mockAttendance: Attendance[] = [
  { studentId: "s1", studentName: "Aarav Sharma", totalClasses: 48, attended: 44, percentage: 91.7 },
  { studentId: "s2", studentName: "Ananya Patel", totalClasses: 48, attended: 42, percentage: 87.5 },
  { studentId: "s3", studentName: "Rohan Verma", totalClasses: 48, attended: 46, percentage: 95.8 },
  { studentId: "s4", studentName: "Priya Gupta", totalClasses: 48, attended: 38, percentage: 79.2 },
  { studentId: "s5", studentName: "Arjun Nair", totalClasses: 48, attended: 32, percentage: 66.7 },
  { studentId: "s6", studentName: "Diya Reddy", totalClasses: 48, attended: 43, percentage: 89.6 },
  { studentId: "s7", studentName: "Karan Joshi", totalClasses: 42, attended: 37, percentage: 88.1 },
  { studentId: "s8", studentName: "Neha Kapoor", totalClasses: 42, attended: 40, percentage: 95.2 },
  { studentId: "s9", studentName: "Vikram Singh", totalClasses: 42, attended: 33, percentage: 78.6 },
  { studentId: "s10", studentName: "Isha Mehta", totalClasses: 42, attended: 20, percentage: 47.6 },
];

function ProgressCircle({ value, size = 56 }: { value: number; size?: number }) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? "#22c55e" : value >= 60 ? "#eab308" : "#ef4444";
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="oklch(0.869 0 0)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} className="transition-all duration-700" />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">{Math.round(value)}%</text>
    </svg>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-5.5 w-5.5" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

const levelColors: Record<string, string> = {
  Beginner: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Intermediate: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Advanced: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

export function CourseManagementPage({ courseId }: Props) {
  const navigate = useNavigate();
  const course = allCourses.get(courseId);

  const [batches, setBatches] = useState(mockBatches);
  const [students, setStudents] = useState(mockStudents);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [batchName, setBatchName] = useState("");
  const [batchStart, setBatchStart] = useState("");
  const [batchEnd, setBatchEnd] = useState("");
  const [batchInstructor, setBatchInstructor] = useState("");
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [detailBatchId, setDetailBatchId] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("all");
  const [studentSearch, setStudentSearch] = useState("");
  const [addStudentDialog, setAddStudentDialog] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentBatch, setStudentBatch] = useState("");
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);

  const filteredStudents = useMemo(() => {
    let list = students;
    if (selectedBatchId !== "all") list = list.filter(s => s.batchId === selectedBatchId);
    if (studentSearch) list = list.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.email.toLowerCase().includes(studentSearch.toLowerCase()));
    return list;
  }, [students, selectedBatchId, studentSearch]);

  if (!course) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Course not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ to: "/courses" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Courses
        </Button>
      </div>
    );
  }

  const avgProgress = Math.round(mockProgress.reduce((sum, p) => sum + p.overallPercentage, 0) / mockProgress.length);
  const avgAttendance = Math.round(mockAttendance.reduce((sum, a) => sum + a.percentage, 0) / mockAttendance.length);

  const overviewStats = [
    { label: "Total Batches", value: batches.length, icon: Layers, color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" },
    { label: "Total Students", value: students.length, icon: Users, color: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" },
    { label: "Avg Progress", value: `${avgProgress}%`, icon: TrendingUp, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
    { label: "Avg Attendance", value: `${avgAttendance}%`, icon: CalendarCheck, color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
  ];

  return (
    <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate({ to: "/courses" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {course.thumbnail ? (
            <img src={course.thumbnail} alt="" className="h-12 w-9 rounded-lg object-cover border shrink-0" />
          ) : (
            <div className="h-12 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <BookOpen className="h-5 w-5 text-muted-foreground/50" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight truncate">{course.name}</h1>
              <Badge variant="outline" className={`text-[10px] font-mono uppercase`}>{course.code}</Badge>
              <Badge variant="outline" className={`text-[10px] ${levelColors[course.level]}`}>{course.level}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {course.duration} &middot; <IndianRupee className="h-3 w-3 inline" />{course.fees.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {overviewStats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="w-full sm:w-auto flex-wrap">
          <TabsTrigger value="overview"><BookOpen className="h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="batches"><Layers className="h-4 w-4" /> Batches</TabsTrigger>
          <TabsTrigger value="students"><Users className="h-4 w-4" /> Students</TabsTrigger>
          <TabsTrigger value="progress"><BarChart3 className="h-4 w-4" /> Progress</TabsTrigger>
          <TabsTrigger value="assessments"><ClipboardCheck className="h-4 w-4" /> Assessments</TabsTrigger>
          <TabsTrigger value="content"><BookText className="h-4 w-4" /> Content</TabsTrigger>
          <TabsTrigger value="attendance"><CalendarCheck className="h-4 w-4" /> Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-0">
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 shrink-0">
                <BookOpen className="h-7 w-7" />
              </div>
              <div className="space-y-2 flex-1 min-w-0">
                <h2 className="text-lg font-semibold">{course.name}</h2>
                {course.description && <p className="text-sm text-muted-foreground">{course.description}</p>}
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-4 w-4" /> {course.duration}</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground"><IndianRupee className="h-4 w-4" /> {course.fees.toLocaleString("en-IN")}</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground"><GraduationCap className="h-4 w-4" /> Started {course.startDate}</span>
                </div>
              </div>
              <Badge variant={course.status === "Active" ? "default" : course.status === "Inactive" ? "secondary" : "outline"} className="shrink-0">{course.status}</Badge>
            </div>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Active Batches</span>
                <Layers className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold">{batches.filter(b => b.status === "Active").length}/{batches.length}</p>
              <div className="flex flex-wrap gap-1.5">
                {batches.map(b => (
                  <Badge key={b.id} variant="outline" className="text-[10px]">{b.name}</Badge>
                ))}
              </div>
            </Card>
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Active Students</span>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold">{students.filter(s => s.status === "Active").length}/{students.length}</p>
              <p className="text-xs text-muted-foreground">Across {batches.length} batches</p>
            </Card>
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Course Progress</span>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-4">
                <p className="text-3xl font-bold">{avgProgress}%</p>
                <ProgressCircle value={avgProgress} size={48} />
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Top Performing Students</h3>
            <div className="space-y-2">
              {[...mockProgress].sort((a, b) => b.overallPercentage - a.overallPercentage).slice(0, 5).map((p, i) => (
                <div key={p.studentId} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono text-muted-foreground w-4">#{i + 1}</span>
                    <span className="text-sm font-medium">{p.studentName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${p.overallPercentage}%` }} />
                    </div>
                    <span className="text-xs font-semibold w-10 text-right">{p.overallPercentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="batches" className="space-y-4 mt-0">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{batches.length} batch{batches.length !== 1 ? "es" : ""}</p>
            <Button size="sm" onClick={() => { setEditingBatch(null); setBatchName(""); setBatchStart(""); setBatchEnd(""); setBatchInstructor(""); setBatchDialogOpen(true); }} className="rounded-xl">
              <Plus className="mr-1.5 h-4 w-4" /> Create Batch
            </Button>
          </div>

          {batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border rounded-xl bg-card">
              <Layers className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold">No batches yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Create your first batch to organize students</p>
            </div>
          ) : detailBatchId ? (
            (() => {
              const batch = batches.find(b => b.id === detailBatchId);
              if (!batch) return null;
              const batchStudentIds = students.filter(s => s.batchId === batch.id).map(s => s.id);
              const batchProgress = mockProgress.filter(p => batchStudentIds.includes(p.studentId));
              const batchAssessments = mockAssessments.filter(a => batchStudentIds.includes(a.studentId));
              const batchAttendance = mockAttendance.filter(a => batchStudentIds.includes(a.studentId));
              return (
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setDetailBatchId(null)}>
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{batch.name}</h3>
                        <Badge variant={batch.status === "Active" ? "default" : batch.status === "Upcoming" ? "secondary" : "outline"} className="text-[10px]">{batch.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {batch.startDate} – {batch.endDate}
                        {batch.instructor && <> &middot; Instructor: {batch.instructor}</>}
                        <> &middot; {batchStudentIds.length} student{batchStudentIds.length !== 1 ? "s" : ""}</>
                      </p>
                    </div>
                  </div>

                  <Tabs defaultValue="students" className="space-y-4">
                    <TabsList className="w-full sm:w-auto flex-wrap">
                      <TabsTrigger value="students"><Users className="h-4 w-4" /> Students</TabsTrigger>
                      <TabsTrigger value="progress"><BarChart3 className="h-4 w-4" /> Progress</TabsTrigger>
                      <TabsTrigger value="assessments"><ClipboardCheck className="h-4 w-4" /> Assessments</TabsTrigger>
                      <TabsTrigger value="attendance"><CalendarCheck className="h-4 w-4" /> Attendance</TabsTrigger>
                    </TabsList>

                    <TabsContent value="students" className="mt-0">
                      <div className="rounded-xl border bg-card overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Enrolled</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {students.filter(s => s.batchId === batch.id).length === 0 ? (
                              <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No students in this batch</TableCell></TableRow>
                            ) : students.filter(s => s.batchId === batch.id).map(s => (
                              <TableRow key={s.id}>
                                <TableCell className="font-medium">{s.name}</TableCell>
                                <TableCell className="text-muted-foreground">{s.email}</TableCell>
                                <TableCell className="text-muted-foreground">{s.enrolledDate}</TableCell>
                                <TableCell><Badge variant={s.status === "Active" ? "default" : "secondary"} className="text-[10px]">{s.status}</Badge></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>

                    <TabsContent value="progress" className="mt-0">
                      <div className="rounded-xl border bg-card overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student</TableHead>
                              <TableHead>Progress</TableHead>
                              <TableHead>Chapters</TableHead>
                              <TableHead>Last Active</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {batchProgress.length === 0 ? (
                              <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No progress data</TableCell></TableRow>
                            ) : batchProgress.map(p => (
                              <TableRow key={p.studentId}>
                                <TableCell className="font-medium">{p.studentName}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <ProgressCircle value={p.overallPercentage} size={36} />
                                    <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                                      <div className={`h-full rounded-full ${p.overallPercentage >= 80 ? "bg-emerald-500" : p.overallPercentage >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${p.overallPercentage}%` }} />
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>{p.chaptersCompleted}/{p.totalChapters}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">{p.lastActive}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>

                    <TabsContent value="assessments" className="mt-0">
                      <div className="rounded-xl border bg-card overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student</TableHead>
                              <TableHead>Assessment</TableHead>
                              <TableHead>Score</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {batchAssessments.length === 0 ? (
                              <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No assessments recorded</TableCell></TableRow>
                            ) : batchAssessments.map((a, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{a.studentName}</TableCell>
                                <TableCell>{a.assessmentName}</TableCell>
                                <TableCell><span className="font-semibold">{a.score}</span><span className="text-muted-foreground">/{a.totalMarks}</span></TableCell>
                                <TableCell className="text-muted-foreground text-sm">{a.date}</TableCell>
                                <TableCell>
                                  {a.status === "Pass" ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-[10px] flex items-center gap-1 w-fit">
                                      <CircleCheck className="h-3 w-3" /> Pass
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive" className="text-[10px] flex items-center gap-1 w-fit">
                                      <X className="h-3 w-3" /> Fail
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>

                    <TabsContent value="attendance" className="mt-0">
                      <div className="rounded-xl border bg-card overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead>Attended</TableHead>
                              <TableHead>Percentage</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {batchAttendance.length === 0 ? (
                              <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No attendance data</TableCell></TableRow>
                            ) : batchAttendance.map(a => (
                              <TableRow key={a.studentId}>
                                <TableCell className="font-medium">{a.studentName}</TableCell>
                                <TableCell>{a.totalClasses}</TableCell>
                                <TableCell>{a.attended}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                                      <div className={`h-full rounded-full ${a.percentage >= 80 ? "bg-emerald-500" : a.percentage >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${a.percentage}%` }} />
                                    </div>
                                    <span className="text-xs font-semibold">{a.percentage}%</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {a.percentage >= 80 ? <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">Good</Badge>
                                    : a.percentage >= 60 ? <Badge variant="secondary" className="text-[10px]">Average</Badge>
                                    : <Badge variant="destructive" className="text-[10px]">Poor</Badge>}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              );
            })()
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {batches.map(batch => (
                <Card
                  key={batch.id}
                  className="p-4 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all cursor-pointer"
                  onClick={() => setDetailBatchId(batch.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{batch.name}</h3>
                      <Badge variant={batch.status === "Active" ? "default" : batch.status === "Upcoming" ? "secondary" : "outline"} className="mt-1 text-[10px]">{batch.status}</Badge>
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setEditingBatch(batch); setBatchName(batch.name); setBatchStart(batch.startDate); setBatchEnd(batch.endDate); setBatchInstructor(batch.instructor || ""); setBatchDialogOpen(true); }} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => setDeletingBatchId(batch.id)} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                    <div className="space-y-1.5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
                        <span>{batch.startDate} – {batch.endDate}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 shrink-0" />
                        <span>{batch.studentCount} student{batch.studentCount !== 1 ? "s" : ""}</span>
                      </div>
                      {batch.instructor && (
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-3.5 w-3.5 shrink-0" />
                          <span>{batch.instructor}</span>
                        </div>
                      )}
                    </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="students" className="space-y-4 mt-0">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-1 flex-wrap gap-3 items-center">
              <div className="relative min-w-[200px] max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search students..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="pl-10 rounded-xl h-9" />
              </div>
              <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                <SelectTrigger className="rounded-xl h-9 w-[160px]"><SelectValue placeholder="All Batches" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  {batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={() => { setAddStudentDialog(true); setStudentName(""); setStudentEmail(""); setStudentBatch(""); }} className="rounded-xl">
              <Plus className="mr-1.5 h-4 w-4" /> Add Student
            </Button>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        {studentSearch || selectedBatchId !== "all" ? "No students match your search" : "No students enrolled yet"}
                      </TableCell>
                    </TableRow>
                  ) : filteredStudents.map(s => {
                    const batch = batches.find(b => b.id === s.batchId);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-muted-foreground">{s.email}</TableCell>
                        <TableCell>{batch?.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{s.enrolledDate}</TableCell>
                        <TableCell><Badge variant={s.status === "Active" ? "default" : "secondary"} className="text-[10px]">{s.status}</Badge></TableCell>
                        <TableCell>
                          <button onClick={() => setDeletingStudentId(s.id)} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="progress" className="space-y-4 mt-0">
          <p className="text-sm text-muted-foreground">Track each student's learning progress through the course curriculum</p>
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Chapters</TableHead>
                    <TableHead>Avg Score</TableHead>
                    <TableHead>Last Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockProgress.map(p => {
                    const studentAssessments = mockAssessments.filter(a => a.studentId === p.studentId);
                    const avgScore = studentAssessments.length ? Math.round(studentAssessments.reduce((sum, a) => sum + (a.score / a.totalMarks) * 100, 0) / studentAssessments.length) : 0;
                    return (
                      <TableRow key={p.studentId}>
                        <TableCell className="font-medium">{p.studentName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <ProgressCircle value={p.overallPercentage} size={40} />
                            <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${p.overallPercentage >= 80 ? "bg-emerald-500" : p.overallPercentage >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${p.overallPercentage}%` }} />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{p.chaptersCompleted}/{p.totalChapters}</TableCell>
                        <TableCell>
                          <Badge variant={avgScore >= 60 ? "default" : "destructive"} className="text-[10px]">{avgScore}%</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{p.lastActive}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="assessments" className="space-y-4 mt-0">
          <p className="text-sm text-muted-foreground">View student assessment scores, pass/fail status, and performance trends</p>
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Assessment</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockAssessments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No assessments recorded</TableCell>
                    </TableRow>
                  ) : mockAssessments.map((a, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{a.studentName}</TableCell>
                      <TableCell>{a.assessmentName}</TableCell>
                      <TableCell>
                        <span className="font-semibold">{a.score}</span>
                        <span className="text-muted-foreground">/{a.totalMarks}</span>
                        <span className="text-muted-foreground ml-1">({Math.round((a.score / a.totalMarks) * 100)}%)</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{a.date}</TableCell>
                      <TableCell>
                        {a.status === "Pass" ? (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-[10px] flex items-center gap-1 w-fit">
                            <CircleCheck className="h-3 w-3" /> Pass
                          </Badge>
                        ) : a.status === "Fail" ? (
                          <Badge variant="destructive" className="text-[10px] flex items-center gap-1 w-fit">
                            <X className="h-3 w-3" /> Fail
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] flex items-center gap-1 w-fit">
                            <CircleEllipsis className="h-3 w-3" /> Pending
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="content" className="space-y-4 mt-0">
          <CourseContentManager courseId={courseId} />
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4 mt-0">
          <p className="text-sm text-muted-foreground">Monitor student attendance records across all classes</p>
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Total Classes</TableHead>
                    <TableHead>Attended</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockAttendance.map(a => (
                    <TableRow key={a.studentId}>
                      <TableCell className="font-medium">{a.studentName}</TableCell>
                      <TableCell>{a.totalClasses}</TableCell>
                      <TableCell>{a.attended}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${a.percentage >= 80 ? "bg-emerald-500" : a.percentage >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${a.percentage}%` }} />
                          </div>
                          <span className="text-xs font-semibold w-10 text-right">{a.percentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {a.percentage >= 80 ? (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-[10px]">Good</Badge>
                        ) : a.percentage >= 60 ? (
                          <Badge variant="secondary" className="text-[10px]">Average</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">Poor</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBatch ? "Edit Batch" : "Create Batch"}</DialogTitle>
            <DialogDescription>{editingBatch ? "Update batch details" : "Add a new batch to organize students"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Batch Name <span className="text-destructive">*</span></Label>
              <Input value={batchName} onChange={e => setBatchName(e.target.value)} placeholder="e.g. Batch A - Morning" />
            </div>
            <div className="space-y-1.5">
              <Label>Instructor</Label>
              <Input value={batchInstructor} onChange={e => setBatchInstructor(e.target.value)} placeholder="e.g. Rajesh Kumar" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={batchStart} onChange={e => setBatchStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input type="date" value={batchEnd} onChange={e => setBatchEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={() => {
              if (!batchName.trim()) { toast.error("Batch name is required"); return; }
              if (editingBatch) {
                setBatches(prev => prev.map(b => b.id === editingBatch.id ? { ...b, name: batchName, startDate: batchStart, endDate: batchEnd, instructor: batchInstructor || undefined } : b));
                toast.success("Batch updated");
              } else {
                const newBatch: Batch = { id: `b${Date.now()}`, name: batchName, startDate: batchStart || new Date().toISOString().split("T")[0], endDate: batchEnd || "", studentCount: 0, status: "Upcoming", instructor: batchInstructor || undefined };
                setBatches(prev => [...prev, newBatch]);
                toast.success("Batch created");
              }
              setBatchDialogOpen(false);
            }} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
              {editingBatch ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addStudentDialog} onOpenChange={setAddStudentDialog}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
            <DialogDescription>Enroll a student to this course</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Student Name <span className="text-destructive">*</span></Label>
              <Input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={studentEmail} onChange={e => setStudentEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Batch <span className="text-destructive">*</span></Label>
              <Select value={studentBatch} onValueChange={setStudentBatch}>
                <SelectTrigger><SelectValue placeholder="Select a batch" /></SelectTrigger>
                <SelectContent>
                  {batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStudentDialog(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={() => {
              if (!studentName.trim() || !studentBatch) { toast.error("Name and batch are required"); return; }
              const newStudent: Student = { id: `s${Date.now()}`, name: studentName, email: studentEmail || `${studentName.toLowerCase().replace(/\s+/g, ".")}@example.com`, batchId: studentBatch, enrolledDate: new Date().toISOString().split("T")[0], status: "Active" };
              setStudents(prev => [...prev, newStudent]);
              setBatches(prev => prev.map(b => b.id === studentBatch ? { ...b, studentCount: b.studentCount + 1 } : b));
              setAddStudentDialog(false);
              toast.success("Student added");
            }} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
              Add Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingBatchId} onOpenChange={() => setDeletingBatchId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Batch?</AlertDialogTitle>
            <AlertDialogDescription>Students in this batch will not be deleted but will become unassigned.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setBatches(prev => prev.filter(b => b.id !== deletingBatchId));
              setDeletingBatchId(null);
              toast.success("Batch deleted");
            }} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingStudentId} onOpenChange={() => setDeletingStudentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Student?</AlertDialogTitle>
            <AlertDialogDescription>The student will be removed from this course batch.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const sid = deletingStudentId!;
              const s = students.find(st => st.id === sid);
              setStudents(prev => prev.filter(st => st.id !== sid));
              if (s) setBatches(prev => prev.map(b => b.id === s.batchId ? { ...b, studentCount: Math.max(0, b.studentCount - 1) } : b));
              setDeletingStudentId(null);
              toast.success("Student removed");
            }} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
