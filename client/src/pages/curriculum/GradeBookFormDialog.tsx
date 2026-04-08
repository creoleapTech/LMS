// src/components/curriculum/GradeBookFormDialog.tsx
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
import { Loader2, X, BookMarked, ImagePlus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { _axios } from "@/lib/axios";
import { toast } from "sonner";
import { Config } from "@/lib/config";

const schema = z.object({
  grade: z.number().min(1).max(12),
  bookTitle: z.string().min(3, "Book title must be at least 3 characters"),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  isPublished: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  curriculumId: string;
  gradeBook?: any;
  onSuccess: () => void;
}

export function GradeBookFormDialog({ open, onOpenChange, curriculumId, gradeBook, onSuccess }: Props) {
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string>("");

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
      grade: 1,
      bookTitle: "",
      subtitle: "",
      description: "",
      isPublished: false,
    },
  });

  useEffect(() => {
    if (open) {
      if (gradeBook) {
        reset({
          grade: gradeBook.grade,
          bookTitle: gradeBook.bookTitle,
          subtitle: gradeBook.subtitle || "",
          description: gradeBook.description || "",
          isPublished: gradeBook.isPublished || false,
        });
        // Use Config.imgUrl for existing cover images
        if (gradeBook.coverImage) {
          setCoverImagePreview(`${Config.imgUrl}${gradeBook.coverImage}`);
        } else {
          setCoverImagePreview("");
        }
        setCoverImageFile(null);
      } else {
        reset({
          grade: 1,
          bookTitle: "",
          subtitle: "",
          description: "",
          isPublished: false,
        });
        setCoverImagePreview("");
        setCoverImageFile(null);
      }
    }
  }, [gradeBook, open, reset]);

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeCoverImage = () => {
    setCoverImageFile(null);
    setCoverImagePreview("");
  };

  const onSubmit = async (data: FormData) => {
    try {
      const formData = new FormData();
      formData.append("grade", data.grade.toString());
      formData.append("bookTitle", data.bookTitle);
      if (data.subtitle) formData.append("subtitle", data.subtitle);
      if (data.description) formData.append("description", data.description);
      formData.append("isPublished", data.isPublished ? "true" : "false");

      if (coverImageFile) {
        formData.append("coverImage", coverImageFile);
      }

      if (gradeBook) {
        // Update existing grade book
        await _axios.patch(`/admin/curriculum/gradebook/${gradeBook._id}`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        toast.success("Grade book updated successfully!");
      } else {
        // Create new grade book
        await _axios.post(`/admin/curriculum/${curriculumId}/grades`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        toast.success("Grade book created successfully!");
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Something went wrong");
    }
  };

  const gradeOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-0">
        <div className="sticky top-0 z-10 bg-[var(--neo-bg)] border-b border-white/30 px-6 pt-6 pb-4 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 shrink-0">
              <BookMarked className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold leading-tight">
                {gradeBook ? "Edit Grade Book" : "Create Grade Book"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                {gradeBook ? "Update this grade book's details and cover image." : "Add a new grade-level book to this curriculum."}
              </DialogDescription>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 pt-4 space-y-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Book Details</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Grade <span className="text-destructive">*</span></Label>
              <Select
                onValueChange={(v) => setValue("grade", parseInt(v))}
                value={watch("grade").toString()}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  {gradeOptions.map((grade) => (
                    <SelectItem key={grade} value={grade.toString()}>
                      Class {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Book Title <span className="text-destructive">*</span></Label>
              <Input {...register("bookTitle")} placeholder="Mathematics Grade 1" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Subtitle</Label>
            <Input {...register("subtitle")} placeholder="An introduction to mathematics" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Description</Label>
            <Textarea {...register("description")} rows={3} placeholder="What this grade book covers..." className="resize-none" />
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Cover Image</p>
            {coverImagePreview ? (
              <div className="relative group">
                <img src={coverImagePreview} alt="Cover preview" className="w-full h-48 object-cover rounded-xl border" />
                <button
                  type="button"
                  onClick={removeCoverImage}
                  aria-label="Remove cover image"
                  className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 w-full h-36 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 cursor-pointer hover:border-muted-foreground/40 hover:bg-muted/50 transition-all">
                <ImagePlus className="h-7 w-7 text-muted-foreground/50" />
                <span className="text-sm text-muted-foreground">Click to upload a cover image</span>
                <span className="text-xs text-muted-foreground/60">PNG, JPG up to 5MB · Recommended: 400×600px</span>
                <input type="file" accept="image/*" onChange={handleCoverImageChange} className="hidden" />
              </label>
            )}
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Visibility</p>
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <p className="text-sm font-medium">Publish this grade book</p>
                <p className="text-xs text-muted-foreground mt-0.5">Make it visible to assigned students and teachers</p>
              </div>
              <Switch
                checked={watch("isPublished") ?? false}
                onCheckedChange={(v) => setValue("isPublished", v)}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
              ) : gradeBook ? "Update Grade Book" : "Create Grade Book"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}