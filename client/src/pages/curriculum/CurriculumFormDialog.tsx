// src/components/curriculum/CurriculumFormDialog.tsx
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect } from "@/components/ui/multi-select";
import { Loader2, X, BookOpen, ImagePlus, Tag, Layers3, GraduationCap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { _axios } from "@/lib/axios";
import { toast } from "sonner";
import { Config } from "@/lib/config";

const schema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  tags: z.string().optional(),
  level: z.array(z.string()).min(1, "Please select at least one level"),
  grades: z.array(z.number()).min(1, "Please select at least one grade"),
  isPublished: z.preprocess((val) => typeof val === "number" ? val === 1 : Boolean(val), z.boolean()),
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
          isPublished: Boolean(curriculum.isPublished),
        });
        setThumbnailPreview(curriculum.thumbnail ? `${Config.imgUrl}${curriculum.thumbnail}` : "");
        setBannerPreview(curriculum.banner ? `${Config.imgUrl}${curriculum.banner}` : "");
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
      setValue("grades", [], { shouldValidate: true, shouldDirty: true });
    } else {
      setValue("grades", gradeOptions.map(g => g.value), { shouldValidate: true, shouldDirty: true });
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
        await _axios.patch(`/admin/curriculum/${curriculum.id}`, formData, {
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-0">
        <div className="sticky top-0 z-10 bg-[var(--neo-bg)] border-b border-white/30 px-6 pt-6 pb-4 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold leading-tight">
                {curriculum ? "Edit Curriculum" : "Create Curriculum"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                {curriculum ? "Update this curriculum's details, media, and availability." : "Set up a new curriculum with grades, levels, and cover images."}
              </DialogDescription>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit, (validationErrors) => {
          const fields = Object.keys(validationErrors).join(", ");
          toast.error(`Validation failed on: ${fields}`);
          console.error("Form validation errors:", validationErrors);
        })} className="px-6 pb-6 pt-4 space-y-6">
          {/* ── Basic Info ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Curriculum Info</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Curriculum Name <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input {...register("name")} className="pl-9" placeholder="AI Integrated Robotics" />
                </div>
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Levels <span className="text-destructive">*</span></Label>
                <MultiSelect
                  options={levelOptions}
                  selected={selectedLevels}
                  onChange={(values) => setValue("level", values as string[], { shouldValidate: true, shouldDirty: true })}
                  placeholder="Select applicable levels..."
                />
                {errors.level && <p className="text-xs text-destructive">{errors.level.message}</p>}
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Layers3 className="h-3.5 w-3.5 text-muted-foreground" /> Description
                </Label>
                <Textarea {...register("description")} rows={3} placeholder="Brief description of this curriculum..." className="resize-none" />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" /> Tags
                </Label>
                <Input {...register("tags")} placeholder="AI, Robotics, STEM..." />
                <p className="text-xs text-muted-foreground">Separate tags with commas</p>
              </div>
            </div>
          </div>

          {/* ── Media ── */}
          <div className="border-t pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Media</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Thumbnail */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Thumbnail</Label>
                {thumbnailPreview ? (
                  <div className="relative group">
                    <img src={thumbnailPreview} alt="Thumbnail" className="h-36 w-full object-cover rounded-xl border" />
                    <button
                      type="button"
                      onClick={removeThumbnail}
                      aria-label="Remove thumbnail"
                      className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 w-full h-32 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 cursor-pointer hover:border-muted-foreground/40 hover:bg-muted/50 transition-all">
                    <ImagePlus className="h-6 w-6 text-muted-foreground/50" />
                    <span className="text-sm text-muted-foreground">Upload thumbnail</span>
                    <span className="text-xs text-muted-foreground/60">400×400px · Max 5MB</span>
                    <input type="file" accept="image/*" onChange={handleThumbnailChange} className="hidden" />
                  </label>
                )}
              </div>

              {/* Banner */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Banner</Label>
                {bannerPreview ? (
                  <div className="relative group">
                    <img src={bannerPreview} alt="Banner" className="h-36 w-full object-cover rounded-xl border" />
                    <button
                      type="button"
                      onClick={removeBanner}
                      aria-label="Remove banner"
                      className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 w-full h-32 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 cursor-pointer hover:border-muted-foreground/40 hover:bg-muted/50 transition-all">
                    <ImagePlus className="h-6 w-6 text-muted-foreground/50" />
                    <span className="text-sm text-muted-foreground">Upload banner</span>
                    <span className="text-xs text-muted-foreground/60">1200×400px · Max 5MB</span>
                    <input type="file" accept="image/*" onChange={handleBannerChange} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* ── Availability ── */}
          <div className="border-t pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grades</p>
              <button
                type="button"
                onClick={handleSelectAllGrades}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                {selectedGrades.length === gradeOptions.length ? "Deselect All" : "Select All"}
              </button>
            </div>
            <MultiSelect
              options={gradeOptions}
              selected={selectedGrades}
              onChange={(values) => setValue("grades", values.map(Number), { shouldValidate: true, shouldDirty: true })}
              placeholder="Select applicable grades..."
            />
            {errors.grades && <p className="text-xs text-destructive mt-1">{errors.grades.message}</p>}

            <div className="flex items-center justify-between rounded-xl border p-4 mt-4">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" /> Publish immediately
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Make this curriculum visible to students and teachers</p>
              </div>
              <Switch
                checked={watch("isPublished")}
                onCheckedChange={(v) => setValue("isPublished", v, { shouldValidate: true, shouldDirty: true })}
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
              ) : curriculum ? "Update Curriculum" : "Create Curriculum"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}