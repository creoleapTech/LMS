"use client";

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Clock, ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/store/userAuthStore";
import { _axios } from "@/lib/axios";
import { toast } from "sonner";

type Course = { id: string; code: string; name: string; level: string; duration: string; fees: number };
type Batch = { id: string; name: string; courseId: string; status: string; startDate: string; endDate: string; courseName?: string; instructorName?: string };

export default function StudentMyCourses() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user?._id) return;
    try {
      setLoading(true);
      const { data: batchRes } = await _axios.get("/admin/batches", { params: { studentId: user._id } });
      const myBatches: Batch[] = batchRes.data ?? [];

      const courseIds = [...new Set(myBatches.map(b => b.courseId))];
      const courseMap = new Map<string, Course>();
      await Promise.all(
        courseIds.map(id =>
          _axios.get(`/admin/courses/${id}`).then(r => {
            if (r.data.data) courseMap.set(id, r.data.data);
          })
        )
      );

      setBatches(
        myBatches.map(b => ({
          ...b,
          courseName: courseMap.get(b.courseId)?.name,
        }))
      );
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load courses");
    } finally {
      setLoading(false);
    }
  }, [user?._id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading your courses...</div>;

  return (
    <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/dashboard" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Courses</h1>
          <p className="text-sm text-muted-foreground">Courses you are enrolled in</p>
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card">
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <h3 className="font-semibold">No courses enrolled</h3>
          <p className="text-sm text-muted-foreground mt-1">Contact your administrator to get enrolled in a course</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {batches.map(batch => (
            <Card key={batch.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 shrink-0">
                  <BookOpen className="h-7 w-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{batch.courseName || "Course"}</h3>
                    <Badge variant="outline" className="text-[10px]">{batch.name}</Badge>
                    <Badge variant={batch.status === "Active" ? "default" : "secondary"} className="text-[10px]">{batch.status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {batch.startDate} – {batch.endDate}</span>
                  </div>
                  {batch.instructorName && (
                    <p className="text-xs text-muted-foreground mt-1">Instructor: {batch.instructorName}</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
