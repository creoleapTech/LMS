"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, Users, CalendarCheck, UserCheck, ArrowLeft, BookOpen } from "lucide-react";
import { useAuthStore } from "@/store/userAuthStore";
import { api } from "@/lib/api/service";
import type { Batch } from "@/lib/api/types";

export default function InstructorBatches() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [batches, setBatches] = useState<(Batch & { courseName?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const inst = await api.getInstructor(user?._id || "");
      const allBatches = await api.getBatches();
      const allCourses = await api.getCourses();
      const myBatches = allBatches
        .filter(b => inst?.assignedBatchIds.includes(b.id))
        .map(b => ({ ...b, courseName: allCourses.find(c => c.id === b.courseId)?.name }));
      setBatches(myBatches);
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
          <h1 className="text-2xl font-bold tracking-tight">My Batches</h1>
          <p className="text-sm text-muted-foreground">Batches assigned to you for instruction</p>
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card">
          <Layers className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <h3 className="font-semibold">No batches assigned</h3>
          <p className="text-sm text-muted-foreground mt-1">Contact your admin to get batch assignments</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {batches.map(batch => (
            <Card
              key={batch.id}
              className="p-4 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all cursor-pointer"
              onClick={() => navigate({ to: "/instructor/batches/$batchId", params: { batchId: batch.id } })}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{batch.name}</h3>
                  <Badge variant={batch.status === "Active" ? "default" : batch.status === "Upcoming" ? "secondary" : "outline"} className="mt-1 text-[10px]">{batch.status}</Badge>
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 shrink-0" />
                  <span>{batch.courseName || "—"}</span>
                </div>
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
    </div>
  );
}
