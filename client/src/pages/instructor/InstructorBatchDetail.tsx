"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Users, BarChart3, ClipboardCheck, CalendarCheck,
  CircleCheck, X, Plus, Search, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/service";
import type { Batch, Course, Student, Progress, Assessment, Attendance } from "@/lib/api/types";

interface Props {
  batchId: string;
}

function ProgressCircle({ value, size = 40 }: { value: number; size?: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? "#22c55e" : value >= 60 ? "#eab308" : "#ef4444";
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="oklch(0.869 0 0)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} className="transition-all duration-700" />
    </svg>
  );
}

export default function InstructorBatchDetail({ batchId }: Props) {
  const navigate = useNavigate();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentSearch, setStudentSearch] = useState("");

  const [assessmentDialogOpen, setAssessmentDialogOpen] = useState(false);
  const [assessmentStudentId, setAssessmentStudentId] = useState("");
  const [assessmentName, setAssessmentName] = useState("");
  const [assessmentScore, setAssessmentScore] = useState(0);
  const [assessmentTotal, setAssessmentTotal] = useState(100);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const b = await api.getBatch(batchId);
      setBatch(b || null);
      if (b) {
        const c = await api.getCourse(b.courseId);
        setCourse(c || null);
        const s = await api.getStudents(b.id);
        setStudents(s);
        const p = await api.getProgress(s.map(st => st.id));
        setProgress(p);
        const a = await api.getAssessments(s.map(st => st.id));
        setAssessments(a);
        const att = await api.getAttendance(s.map(st => st.id));
        setAttendance(att);
      }
      setLoading(false);
    }
    load();
  }, [batchId]);

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const handleAddAssessment = async () => {
    if (!assessmentName.trim() || !assessmentStudentId) { toast.error("Fill all fields"); return; }
    setSaving(true);
    await api.createAssessment({
      studentId: assessmentStudentId,
      studentName: students.find(s => s.id === assessmentStudentId)?.name || "",
      assessmentName,
      score: assessmentScore,
      totalMarks: assessmentTotal,
      date: new Date().toISOString().split("T")[0],
      status: assessmentScore / assessmentTotal >= 0.4 ? "Pass" : "Fail",
    });
    const updated = await api.getAssessments(students.map(s => s.id));
    setAssessments(updated);
    setSaving(false);
    setAssessmentDialogOpen(false);
    toast.success("Assessment recorded");
  };

  const handleMarkAttendance = async (studentId: string, present: boolean) => {
    const record = attendance.find(a => a.studentId === studentId);
    if (record) {
      const newAttended = present ? record.attended + 1 : record.attended;
      const newTotal = record.totalClasses + 1;
      await api.updateAttendance(studentId, {
        totalClasses: newTotal,
        attended: newAttended,
        percentage: Math.round((newAttended / newTotal) * 1000) / 10,
      });
    } else {
      await api.updateAttendance(studentId, {
        totalClasses: 1,
        attended: present ? 1 : 0,
        percentage: present ? 100 : 0,
      });
    }
    const updated = await api.getAttendance(students.map(s => s.id));
    setAttendance(updated);
    toast.success(present ? "Attendance marked present" : "Attendance marked absent");
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading batch...</div>;
  if (!batch) return <div className="p-8 text-center text-muted-foreground">Batch not found</div>;

  return (
    <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/instructor/batches" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{batch.name}</h1>
            <Badge variant={batch.status === "Active" ? "default" : batch.status === "Upcoming" ? "secondary" : "outline"}>{batch.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {course?.name && <>{course.name} &middot; </>}
            {batch.startDate} – {batch.endDate} &middot; {students.length} student{students.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <Tabs defaultValue="students" className="space-y-5">
        <TabsList className="w-full sm:w-auto flex-wrap">
          <TabsTrigger value="students"><Users className="h-4 w-4" /> Students</TabsTrigger>
          <TabsTrigger value="progress"><BarChart3 className="h-4 w-4" /> Progress</TabsTrigger>
          <TabsTrigger value="assessments"><ClipboardCheck className="h-4 w-4" /> Assessments</TabsTrigger>
          <TabsTrigger value="attendance"><CalendarCheck className="h-4 w-4" /> Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-0 space-y-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search students..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="pl-10 rounded-xl h-9" />
          </div>
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
                {filteredStudents.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No students found</TableCell></TableRow>
                ) : filteredStudents.map(s => (
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

        <TabsContent value="progress" className="mt-0 space-y-4">
          <p className="text-sm text-muted-foreground">Track each student's learning progress</p>
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
                {progress.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No progress data</TableCell></TableRow>
                ) : progress.map(p => (
                  <TableRow key={p.studentId}>
                    <TableCell className="font-medium">{p.studentName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ProgressCircle value={p.overallPercentage} />
                        <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${p.overallPercentage >= 80 ? "bg-emerald-500" : p.overallPercentage >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${p.overallPercentage}%` }} />
                        </div>
                        <span className="text-xs font-semibold">{p.overallPercentage}%</span>
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

        <TabsContent value="assessments" className="mt-0 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Record and view student assessment scores</p>
            <Button size="sm" onClick={() => { setAssessmentStudentId(""); setAssessmentName(""); setAssessmentScore(0); setAssessmentTotal(100); setAssessmentDialogOpen(true); }} className="rounded-xl">
              <Plus className="mr-1.5 h-4 w-4" /> Add Assessment
            </Button>
          </div>
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
                {assessments.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No assessments recorded</TableCell></TableRow>
                ) : assessments.map((a, i) => (
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

        <TabsContent value="attendance" className="mt-0 space-y-4">
          <p className="text-sm text-muted-foreground">Mark attendance for today's class</p>
          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Attended</TableHead>
                  <TableHead>Percentage</TableHead>
                  <TableHead>Mark Today</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No students</TableCell></TableRow>
                ) : filteredStudents.map(s => {
                  const att = attendance.find(a => a.studentId === s.id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{att?.totalClasses || 0}</TableCell>
                      <TableCell>{att?.attended || 0}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${(att?.percentage || 0) >= 80 ? "bg-emerald-500" : (att?.percentage || 0) >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${att?.percentage || 0}%` }} />
                          </div>
                          <span className="text-xs font-semibold">{att?.percentage || 0}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={() => handleMarkAttendance(s.id, true)}>
                            <CircleCheck className="h-3 w-3 mr-1 text-emerald-500" /> Present
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={() => handleMarkAttendance(s.id, false)}>
                            <X className="h-3 w-3 mr-1 text-red-500" /> Absent
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={assessmentDialogOpen} onOpenChange={setAssessmentDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Assessment</DialogTitle>
            <DialogDescription>Add a new assessment score for a student</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Student <span className="text-destructive">*</span></Label>
              <Select value={assessmentStudentId} onValueChange={setAssessmentStudentId}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assessment Name <span className="text-destructive">*</span></Label>
              <Input value={assessmentName} onChange={e => setAssessmentName(e.target.value)} placeholder="e.g. Weekly Test 4" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Score</Label>
                <Input type="number" value={assessmentScore} onChange={e => setAssessmentScore(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Total Marks</Label>
                <Input type="number" value={assessmentTotal} onChange={e => setAssessmentTotal(Number(e.target.value))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssessmentDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleAddAssessment} disabled={saving} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
