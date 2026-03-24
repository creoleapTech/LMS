// src/components/curriculum/ChapterFormDialog.tsx
"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {chapter ? "Edit Chapter" : "Create New Chapter"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <Label>Chapter Title *</Label>
              <Input 
                {...register("title")} 
                placeholder="Introduction to Algebra" 
              />
            </div>

            <div className="space-y-2">
              <Label>Chapter Number *</Label>
              <Input 
                type="number"
                min="1"
                {...register("chapterNumber", { valueAsNumber: true })} 
                placeholder="1" 
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                {...register("description")} 
                rows={3} 
                placeholder="Brief description of this chapter..." 
              />
            </div>

            <div className="space-y-2">
              <Label>Learning Objectives</Label>
              <Textarea 
                {...register("learningObjectives")} 
                rows={3} 
                placeholder="What students will learn in this chapter..." 
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : chapter ? (
                "Update Chapter"
              ) : (
                "Create Chapter"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}