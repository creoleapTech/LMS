// src/components/course/CourseFormDialog.tsx
"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
type Course = {
  id: string;
  code: string;          // e.g., MATH101
  name: string;
  description?: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string;      // e.g., "3 Months", "1 Year"
  fees: number;
  status: "Active" | "Inactive" | "Archived";
  startDate: string;     // YYYY-MM-DD
  instructor?: string;
};
const courseSchema = z.object({
  code: z.string().min(3).max(10).toUpperCase(),
  name: z.string().min(3),
  description: z.string().optional(),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
  duration: z.string().min(2),
  fees: z.coerce.number().min(0),
  status: z.enum(["Active", "Inactive", "Archived"]),
  startDate: z.string(),
  instructor: z.string().optional(),
});

type FormValues = z.infer<typeof courseSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course?: Course | null;
  onSave: (data: FormValues) => void;
}

export function CourseFormDialog({ open, onOpenChange, course, onSave }: Props) {
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      level: "Intermediate",
      status: "Active",
      fees: 0,
      startDate: new Date().toISOString().split("T")[0],
    },
  });

  useEffect(() => {
    if (open) {
      if (course) {
        reset({
          ...course,
          fees: Number(course.fees),
        });
      } else {
        reset({
          code: "",
          name: "",
          description: "",
          level: "Intermediate",
          duration: "",
          fees: 0,
          status: "Active",
          startDate: new Date().toISOString().split("T")[0],
          instructor: "",
        });
      }
    }
  }, [course, open, reset]);

  const onSubmit = (data: FormValues) => {
    onSave(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{course ? "Edit" : "Create New"} Course</DialogTitle>
          <DialogDescription>
            {course ? "Update course details" : "Add a new course to your institution"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Course Code *</Label>
              <Input {...register("code")} placeholder="MATH101" className="uppercase" />
              {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Course Name *</Label>
              <Input {...register("name")} placeholder="Mathematics Grade 10" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Description (optional)</Label>
              <Textarea {...register("description")} placeholder="Brief description of the course..." rows={3} />
            </div>

            <div className="space-y-2">
              <Label>Level *</Label>
              <Select onValueChange={(v) => setValue("level", v as any)} defaultValue={course?.level || "Intermediate"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Beginner">Beginner</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Duration *</Label>
              <Input {...register("duration")} placeholder="6 Months" />
            </div>

            <div className="space-y-2">
              <Label>Fees (₹) *</Label>
              <Input type="number" {...register("fees")} placeholder="25000" />
            </div>

            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Input type="date" {...register("startDate")} />
            </div>

            <div className="space-y-2">
              <Label>Instructor (optional)</Label>
              <Input {...register("instructor")} placeholder="Mr. Rajesh Kumar" />
            </div>

            <div className="space-y-2">
              <Label>Status *</Label>
              <Select onValueChange={(v) => setValue("status", v as any)} defaultValue={course?.status || "Active"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving... </>
              ) : course ? "Update Course" : "Create Course"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}