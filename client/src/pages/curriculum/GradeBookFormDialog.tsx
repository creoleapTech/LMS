// src/components/curriculum/GradeBookFormDialog.tsx
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X } from "lucide-react";
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {gradeBook ? "Edit Grade Book" : "Create New Grade Book"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <Label>Grade *</Label>
              <Select
                onValueChange={(v) => setValue("grade", parseInt(v))}
                defaultValue={watch("grade").toString()}
              >
                <SelectTrigger>
                  <SelectValue />
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

            <div className="space-y-2">
              <Label>Book Title *</Label>
              <Input
                {...register("bookTitle")}
                placeholder="Mathematics Grade 1"
              />
            </div>

            <div className="space-y-2">
              <Label>Subtitle</Label>
              <Input
                {...register("subtitle")}
                placeholder="An introduction to mathematics"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                {...register("description")}
                rows={3}
                placeholder="Description of this grade book..."
              />
            </div>

            {/* Cover Image Upload */}
            <div className="space-y-2">
              <Label>Cover Image</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverImageChange}
                  className="flex-1"
                />
                {coverImagePreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeCoverImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {coverImagePreview && (
                <div className="mt-2">
                  <img
                    src={coverImagePreview}
                    alt="Cover preview"
                    className="w-full h-48 object-cover rounded-md border"
                  />
                </div>
              )}
            </div>

            {/* Published Toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register("isPublished")}
                className="h-4 w-4"
              />
              <Label>Publish this grade book</Label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {gradeBook ? "Update" : "Create"} Grade Book
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}