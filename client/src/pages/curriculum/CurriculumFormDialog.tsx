// src/components/curriculum/CurriculumFormDialog.tsx
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
import { MultiSelect } from "@/components/ui/multi-select";
import { Loader2, X } from "lucide-react";
import { _axios } from "@/lib/axios";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  tags: z.string().optional(),
  level: z.array(z.string()).min(1, "Please select at least one level"),
  grades: z.array(z.number()).min(1, "Please select at least one grade"),
  isPublished: z.boolean().optional().default(false),
});

type CurriculumFormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  curriculum?: any;
  onSuccess: () => void;
}

const gradeOptions = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `Class ${i + 1}`,
}));

const levelOptions = [
  { value: "Beginner", label: "Beginner" },
  { value: "Intermediate", label: "Intermediate" },
  { value: "Advanced", label: "Advanced" },
];

export function CurriculumFormDialog({ open, onOpenChange, curriculum, onSuccess }: Props) {
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string>("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CurriculumFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      level: ["Beginner"],
      grades: [],
      isPublished: false,
      tags: "",
    },
  });

  const selectedGrades = watch("grades") || [];
  const selectedLevels = watch("level") || [];

  useEffect(() => {
    if (open) {
      if (curriculum) {
        // Handle legacy single level string by converting to array
        const levelValue = Array.isArray(curriculum.level)
          ? curriculum.level
          : (curriculum.level ? [curriculum.level] : ["Beginner"]);

        reset({
          name: curriculum.name || "",
          description: curriculum.description || "",
          tags: curriculum.tags?.join(", ") || "",
          level: levelValue,
          grades: curriculum.grades || [],
          isPublished: curriculum.isPublished || false,
        });
        setThumbnailPreview(curriculum.thumbnail || "");
        setBannerPreview(curriculum.banner || "");
        setThumbnailFile(null);
        setBannerFile(null);
      } else {
        reset({
          name: "",
          description: "",
          tags: "",
          level: ["Beginner"],
          grades: [],
          isPublished: false,
        });
        setThumbnailPreview("");
        setBannerPreview("");
        setThumbnailFile(null);
        setBannerFile(null);
      }
    }
  }, [curriculum, open, reset]);

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBannerFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview("");
  };

  const removeBanner = () => {
    setBannerFile(null);
    setBannerPreview("");
  };

  const handleSelectAllGrades = () => {
    if (selectedGrades.length === gradeOptions.length) {
      setValue("grades", []);
    } else {
      setValue("grades", gradeOptions.map(g => g.value));
    }
  };

  const onSubmit = async (data: CurriculumFormData) => {
    try {
      const formData = new FormData();

      // Add text fields
      formData.append("name", data.name);
      if (data.description) formData.append("description", data.description);
      formData.append("isPublished", (data.isPublished || false).toString());

      // Add levels - send each level separately
      data.level.forEach(l => {
        formData.append("level", l);
      });

      // Add grades - send each grade separately
      data.grades.forEach(grade => {
        formData.append("grades", grade.toString());
      });

      // Add tags - send each tag separately
      const tags = data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
      tags.forEach(tag => {
        formData.append("tags", tag);
      });

      // Add files if selected
      if (thumbnailFile) {
        formData.append("thumbnail", thumbnailFile);
      }
      if (bannerFile) {
        formData.append("banner", bannerFile);
      }

      if (curriculum) {
        await _axios.patch(`/admin/curriculum/${curriculum._id}`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        toast.success("Curriculum updated successfully!");
      } else {
        await _axios.post("/admin/curriculum", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        toast.success("Curriculum created successfully!");
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {curriculum ? "Edit Curriculum" : "Create New Curriculum"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Name */}
            <div className="space-y-2">
              <Label>Curriculum Name *</Label>
              <Input {...register("name")} placeholder="AI Integrated Robotics" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            {/* Level */}
            <div className="space-y-2">
              <Label>Levels *</Label>
              <MultiSelect
                options={levelOptions}
                selected={selectedLevels}
                onChange={(values) => setValue("level", values as string[])}
                placeholder="Select applicable levels..."
              />
              {errors.level && <p className="text-sm text-destructive">{errors.level.message}</p>}
            </div>

            {/* Description */}
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea {...register("description")} rows={3} placeholder="Brief description..." />
            </div>

            {/* Thumbnail Upload */}
            <div className="space-y-2">
              <Label>Thumbnail Image</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailChange}
                  className="flex-1"
                />
                {thumbnailPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeThumbnail}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {thumbnailPreview && (
                <div className="mt-2">
                  <img
                    src={thumbnailPreview}
                    alt="Thumbnail preview"
                    className="h-32 w-auto rounded-lg border object-cover"
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">Recommended: 400x400px, Max 5MB</p>
            </div>

            {/* Banner Upload */}
            <div className="space-y-2">
              <Label>Banner Image</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleBannerChange}
                  className="flex-1"
                />
                {bannerPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeBanner}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {bannerPreview && (
                <div className="mt-2">
                  <img
                    src={bannerPreview}
                    alt="Banner preview"
                    className="h-32 w-full rounded-lg border object-cover"
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">Recommended: 1200x400px, Max 5MB</p>
            </div>

            {/* Grades */}
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Grades *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllGrades}
                  className="h-6 text-xs text-primary hover:text-primary/80"
                >
                  {selectedGrades.length === gradeOptions.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <MultiSelect
                options={gradeOptions}
                selected={selectedGrades}
                onChange={(values) => setValue("grades", values.map(Number))}
                placeholder="Select applicable grades..."
              />
              {errors.grades && <p className="text-sm text-destructive">{errors.grades.message}</p>}
            </div>

            {/* Tags */}
            <div className="space-y-2 md:col-span-2">
              <Label>Tags (optional)</Label>
              <Input {...register("tags")} placeholder="AI, Robotics, STEM..." />
              <p className="text-xs text-muted-foreground">Comma separated</p>
            </div>

            {/* Publish */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="published"
                aria-label="Publish immediately"
                className="h-4 w-4 rounded border-gray-300"
                onChange={(e) => setValue("isPublished", e.target.checked)}
                defaultChecked={watch("isPublished")}
              />
              <Label htmlFor="published" className="cursor-pointer">Publish immediately</Label>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-4 pt-6 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : curriculum ? (
                "Update Curriculum"
              ) : (
                "Create Curriculum"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}