// src/components/curriculum/ChapterFormDialog.tsx
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
import { Loader2, FileText, BookOpen, Hash, AlignLeft, ListChecks } from "lucide-react";
import { _axios } from "@/lib/axios";
import { toast } from "sonner";

const schema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  chapterNumber: z.number().min(1, "Chapter number must be at least 1"),
  description: z.string().optional(),
  learningObjectives: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gradeBookId: string;
  chapter?: any;
  onSuccess: () => void;
}

export function ChapterFormDialog({ open, onOpenChange, gradeBookId, chapter, onSuccess }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      chapterNumber: 1,
      description: "",
      learningObjectives: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (chapter) {
        reset({
          title: chapter.title,
          chapterNumber: chapter.chapterNumber,
          description: chapter.description || "",
          learningObjectives: chapter.learningObjectives || "",
        });
      } else {
        reset({
          title: "",
          chapterNumber: 1,
          description: "",
          learningObjectives: "",
        });
      }
    }
  }, [chapter, open, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      if (chapter) {
        await _axios.patch(`/admin/curriculum/chapters/${chapter._id}`, data);
        toast.success("Chapter updated successfully!");
      } else {
        await _axios.post(`/admin/curriculum/gradebook/${gradeBookId}/chapters`, data);
        toast.success("Chapter created successfully!");
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-0">
        <div className="sticky top-0 z-10 bg-[var(--neo-bg)] border-b border-white/30 px-6 pt-6 pb-4 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold leading-tight">
                {chapter ? "Edit Chapter" : "Create New Chapter"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                {chapter ? "Update chapter information and learning objectives." : "Add a new chapter to this grade book."}
              </DialogDescription>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 pt-4 space-y-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chapter Info</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Chapter Title <span className="text-destructive">*</span></Label>
              <div className="relative">
                <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input {...register("title")} className="pl-9" placeholder="Introduction to Algebra" />
              </div>
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Chapter No. <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="1"
                  {...register("chapterNumber", { valueAsNumber: true })}
                  className="pl-9"
                  placeholder="1"
                />
              </div>
              {errors.chapterNumber && <p className="text-xs text-destructive">{errors.chapterNumber.message}</p>}
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-1">Content</p>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <AlignLeft className="h-3.5 w-3.5 text-muted-foreground" /> Description
            </Label>
            <Textarea
              {...register("description")}
              rows={3}
              placeholder="Brief description of this chapter..."
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5 text-muted-foreground" /> Learning Objectives
            </Label>
            <Textarea
              {...register("learningObjectives")}
              rows={4}
              placeholder="What students will learn in this chapter..."
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">Describe the key skills and knowledge students will gain.</p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
              ) : chapter ? "Update Chapter" : "Create Chapter"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}