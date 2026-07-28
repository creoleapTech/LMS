"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePlus, Loader2, X, Book, BookOpen, IndianRupee, CalendarDays, Tag } from "lucide-react";
import { compressImage } from "@/lib/imageUtils";
import { TEXT_LIMITS } from "@/lib/validation/textLimits";

type Course = {
  id: string;
  code: string;
  name: string;
  description?: string;
  thumbnail?: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  fees: number;
  status: "Active" | "Inactive" | "Archived";
  startDate: string;
};

const courseSchema = z.object({
  code: z.string().trim().min(3, "Code must be at least 3 characters").max(TEXT_LIMITS.courseCode, "Code too long").transform((value) => value.toUpperCase()),
  name: z.string().trim().min(3, "Name must be at least 3 characters").max(TEXT_LIMITS.courseName, "Name too long"),
  description: z.string().trim().max(TEXT_LIMITS.courseDescription, "Description too long").optional().or(z.literal("")),
  thumbnail: z.string().optional(),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
  duration: z.string().trim().min(2, "Duration is required").max(TEXT_LIMITS.courseDuration, "Duration too long"),
  fees: z.coerce.number().min(0, "Fees cannot be negative"),
  status: z.enum(["Active", "Inactive", "Archived"]),
  startDate: z.string(),
});

type FormValues = z.infer<typeof courseSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course?: Course | null;
  onSave: (data: FormValues) => void;
}

export function CourseFormDialog({ open, onOpenChange, course, onSave }: Props) {
  const [thumbnailPreview, setThumbnailPreview] = useState("");

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
        setThumbnailPreview(course.thumbnail || "");
      } else {
        reset({
          code: "",
          name: "",
          description: "",
          thumbnail: "",
          level: "Intermediate",
          duration: "",
          fees: 0,
          status: "Active",
          startDate: new Date().toISOString().split("T")[0],
        });
        setThumbnailPreview("");
      }
    }
  }, [course, open, reset]);

  const handleThumbnailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file, { maxWidth: 400, maxHeight: 600, quality: 0.85 });
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setThumbnailPreview(dataUrl);
        setValue("thumbnail", dataUrl);
      };
      reader.readAsDataURL(compressed);
    }
  };

  const removeThumbnail = () => {
    setThumbnailPreview("");
    setValue("thumbnail", "");
  };

  const onSubmit = (data: FormValues) => {
    onSave(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl p-0 gap-0 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600/5 via-purple-600/5 to-pink-600/5 px-6 pt-6 pb-4 border-b">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 shrink-0">
                <Book className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">
                  {course ? "Edit Course" : "Create New Course"}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                  {course ? "Update course details and settings" : "Add a new course to your institution"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-6 overflow-y-auto max-h-[65vh]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> Basic Info
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Course Code <span className="text-destructive">*</span></Label>
                <Input {...register("code")} maxLength={TEXT_LIMITS.courseCode} placeholder="e.g. MATH101" className="uppercase" />
                {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Course Name <span className="text-destructive">*</span></Label>
                <Input {...register("name")} maxLength={TEXT_LIMITS.courseName} placeholder="e.g. Mathematics Grade 10" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label className="text-sm font-medium">Description</Label>
                </div>
                <Textarea {...register("description")} maxLength={TEXT_LIMITS.courseDescription} placeholder="Brief description of the course..." rows={3} className="resize-none" />
              </div>

              <div className="space-y-1.5">
                <Label>Level <span className="text-destructive">*</span></Label>
                <Select onValueChange={(v) => setValue("level", v as any)} defaultValue={course?.level || "Intermediate"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status <span className="text-destructive">*</span></Label>
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
          </div>

          <div className="border-t pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <IndianRupee className="h-3.5 w-3.5" /> Financial & Schedule
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Duration <span className="text-destructive">*</span></Label>
                <Input {...register("duration")} maxLength={TEXT_LIMITS.courseDuration} placeholder="e.g. 6 Months" />
              </div>

              <div className="space-y-1.5">
                <Label>Fees (₹) <span className="text-destructive">*</span></Label>
                <Input type="number" {...register("fees")} placeholder="e.g. 25000" />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label className="text-sm font-medium">Start Date <span className="text-destructive">*</span></Label>
                </div>
                <Input type="date" {...register("startDate")} />
              </div>

            </div>
          </div>

          <div className="border-t pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <ImagePlus className="h-3.5 w-3.5" /> Media
            </p>
            <div className="space-y-2">
              {thumbnailPreview ? (
                <div className="relative group inline-block">
                  <img src={thumbnailPreview} alt="Thumbnail" className="h-40 w-28 object-cover rounded-xl border shadow-sm" />
                  <button
                    type="button"
                    onClick={removeThumbnail}
                    className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <p className="text-xs text-muted-foreground mt-1.5">Click X to remove</p>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 w-28 h-40 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 cursor-pointer hover:border-indigo-400/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all duration-200">
                  <ImagePlus className="h-6 w-6 text-muted-foreground/40 group-hover:text-indigo-500" />
                  <span className="text-xs font-medium text-muted-foreground/70">Upload thumbnail</span>
                  <span className="text-[10px] text-muted-foreground/40">Portrait · Max 2MB</span>
                  <input type="file" accept="image/*" onChange={handleThumbnailChange} className="hidden" />
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : course ? "Update Course" : "Create Course"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
