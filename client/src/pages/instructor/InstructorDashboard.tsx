"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, ClipboardCheck, CalendarCheck, TrendingUp, ArrowRight, Layers } from "lucide-react";
import { useAuthStore } from "@/store/userAuthStore";
import { api } from "@/lib/api/service";
import type { Course, Batch } from "@/lib/api/types";

export default function InstructorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const inst = await api.getInstructor(user?._id || "");
      const allCourses = await api.getCourses();
      const myCourses = allCourses.filter(c => inst?.assignedCourseIds.includes(c.id));
      setCourses(myCourses);
      const allBatches = await api.getBatches();
      const myBatches = allBatches.filter(b => inst?.assignedBatchIds.includes(b.id));
      setBatches(myBatches);
      setLoading(false);
    }
    load();
  }, [user?._id]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading dashboard...</div>;
  }

  const totalStudents = batches.reduce((sum, b) => sum + b.studentCount, 0);

  return (
    <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome, {user?.name}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Instructor Dashboard — manage your courses and students</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30">
            <BookOpen className="h-5.5 w-5.5" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-tight">{courses.length}</p>
            <p className="text-xs text-muted-foreground">My Courses</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/30">
            <Layers className="h-5.5 w-5.5" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-tight">{batches.length}</p>
            <p className="text-xs text-muted-foreground">My Batches</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30">
            <Users className="h-5.5 w-5.5" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-tight">{totalStudents}</p>
            <p className="text-xs text-muted-foreground">Total Students</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30">
            <TrendingUp className="h-5.5 w-5.5" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-tight">{batches.filter(b => b.status === "Active").length}</p>
            <p className="text-xs text-muted-foreground">Active Batches</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4" /> My Courses</h3>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate({ to: "/instructor/courses" })}>
              View All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No courses assigned yet</p>
          ) : (
            <div className="space-y-2">
              {courses.map(course => (
                <div key={course.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{course.name}</p>
                    <p className="text-xs text-muted-foreground">{course.code} &middot; {course.level}</p>
                  </div>
                  <Badge variant={course.status === "Active" ? "default" : "secondary"} className="text-[10px]">{course.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><Layers className="h-4 w-4" /> My Batches</h3>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate({ to: "/instructor/batches" })}>
              View All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No batches assigned yet</p>
          ) : (
            <div className="space-y-2">
              {batches.map(batch => (
                <div key={batch.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{batch.name}</p>
                    <p className="text-xs text-muted-foreground">{batch.studentCount} students &middot; {batch.startDate}</p>
                  </div>
                  <Badge variant={batch.status === "Active" ? "default" : batch.status === "Upcoming" ? "secondary" : "outline"} className="text-[10px]">{batch.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button onClick={() => navigate({ to: "/instructor/batches" })} className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:shadow-md transition-shadow text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600"><Users className="h-5 w-5" /></div>
          <div><p className="text-sm font-semibold">Manage Students</p><p className="text-xs text-muted-foreground">View & manage batch students</p></div>
        </button>
        <button onClick={() => navigate({ to: "/instructor/batches" })} className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:shadow-md transition-shadow text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600"><ClipboardCheck className="h-5 w-5" /></div>
          <div><p className="text-sm font-semibold">Assessments</p><p className="text-xs text-muted-foreground">Record & view student scores</p></div>
        </button>
        <button onClick={() => navigate({ to: "/instructor/batches" })} className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:shadow-md transition-shadow text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600"><CalendarCheck className="h-5 w-5" /></div>
          <div><p className="text-sm font-semibold">Attendance</p><p className="text-xs text-muted-foreground">Mark & track attendance</p></div>
        </button>
      </div>
    </div>
  );
}
