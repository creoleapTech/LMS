"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Layers, IndianRupee, Clock, ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/store/userAuthStore";
import { api } from "@/lib/api/service";
import type { Course, Batch } from "@/lib/api/types";

const levelColors: Record<string, string> = {
  Beginner: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Intermediate: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Advanced: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

export default function InstructorCourses() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<(Course & { batches: Batch[] })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const inst = await api.getInstructor(user?._id || "");
      const allCourses = await api.getCourses();
      const allBatches = await api.getBatches();
      const myCourses = allCourses
        .filter(c => inst?.assignedCourseIds.includes(c.id))
        .map(c => ({ ...c, batches: allBatches.filter(b => b.courseId === c.id && inst?.assignedBatchIds.includes(b.id)) }));
      setCourses(myCourses);
      setLoading(false);
    }
    load();
  }, [user?._id]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/instructor/dashboard" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Courses</h1>
          <p className="text-sm text-muted-foreground">Courses assigned to you</p>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card">
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <h3 className="font-semibold">No courses assigned</h3>
          <p className="text-sm text-muted-foreground mt-1">Contact your admin to get course assignments</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {courses.map(course => (
            <Card key={course.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 shrink-0">
                  <BookOpen className="h-7 w-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{course.name}</h3>
                    <Badge variant="outline" className="text-[10px] font-mono">{course.code}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${levelColors[course.level]}`}>{course.level}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {course.duration}</span>
                    <span className="flex items-center gap-1"><IndianRupee className="h-3 w-3" /> {course.fees.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Assigned Batches ({course.batches.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {course.batches.map(b => (
                        <Badge
                          key={b.id}
                          variant="secondary"
                          className="text-[10px] cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                          onClick={() => navigate({ to: "/instructor/batches/$batchId", params: { batchId: b.id } })}
                        >
                          <Layers className="h-3 w-3 mr-1" /> {b.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
