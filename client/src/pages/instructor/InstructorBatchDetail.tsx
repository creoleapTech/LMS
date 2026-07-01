"use client";

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Users, BarChart3, ClipboardCheck, CalendarCheck, Search } from "lucide-react";
import { toast } from "sonner";
import { _axios } from "@/lib/axios";

type BatchInfo = { id: string; name: string; courseId: string; status: string; startDate: string; endDate: string };
type CourseInfo = { id: string; name: string; code: string };
type Student = { id: string; name: string; email: string; enrolledDate: string; status: string };

interface Props {
  batchId: string;
}

export default function InstructorBatchDetail({ batchId }: Props) {
  const navigate = useNavigate();
  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentSearch, setStudentSearch] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: batchRes } = await _axios.get(`/admin/batches/${batchId}`);
      const b: BatchInfo | null = batchRes.data ?? null;
      setBatch(b);

      if (b) {
        const { data: courseRes } = await _axios.get(`/admin/courses/${b.courseId}`);
        setCourse(courseRes.data ?? null);

        const { data: studentsRes } = await _axios.get(`/admin/batches/${batchId}/students`);
        setStudents((studentsRes.data ?? []).map((s: any) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          enrolledDate: s.enrolledDate ?? "—",
          status: s.status ?? "Active",
        })));
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load batch details");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(studentSearch.toLowerCase())
  );

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
                  <TableHead>Last Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">Progress tracking coming soon</TableCell></TableRow>
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="assessments" className="mt-0 space-y-4">
          <p className="text-sm text-muted-foreground">Record and view student assessment scores</p>
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
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Assessments coming soon</TableCell></TableRow>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Attendance tracking coming soon</TableCell></TableRow>
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
