// src/pages/curriculum/UnifiedChapterFormDialog.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ImagePlus, X } from "lucide-react";
import { _axios } from "@/lib/axios";
import { toast } from "sonner";
import { Config } from "@/lib/config";
import { compressImage } from "@/lib/imageUtils";

const schema = z.object({
    curriculumId: z.string().optional(),
    gradeBookId: z.string().min(1, "Please select a grade book"),
    title: z.string().min(3, "Title must be at least 3 characters"),
    chapterNumber: z.number().min(1, "Chapter number must be at least 1"),
    description: z.string().optional(),
    learningObjectives: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface CurriculumOption {
    id: string;
    name: string;
}

interface GradeBookOption {
    id: string;
    bookTitle: string;
    grade: number | string;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    gradeBookId?: string;
    chapter?: any;
    onSuccess: () => void;
}

export function UnifiedChapterFormDialog({ open, onOpenChange, gradeBookId: providedGradeBookId, chapter, onSuccess }: Props) {
    const [selectedCurriculumId, setSelectedCurriculumId] = useState<string>("");
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
    const thumbnailInputRef = useRef<HTMLInputElement>(null);

    const { data: curriculums = [] } = useQuery({
        queryKey: ["curriculums-list"],
        queryFn: async () => {
            const res = await _axios.get("/admin/curriculum", { params: { limit: 100 } });
            return res.data.data || [];
        },
        enabled: open && !providedGradeBookId,
    });

    const { data: gradeBooks = [] } = useQuery({
        queryKey: ["gradebooks-for-curriculum", selectedCurriculumId],
        queryFn: async () => {
            const res = await _axios.get(`/admin/curriculum/${selectedCurriculumId}/grades`);
            return res.data.data || [];
        },
        enabled: !!selectedCurriculumId && !providedGradeBookId,
    });

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { isSubmitting, errors },
    } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            curriculumId: "",
            gradeBookId: providedGradeBookId || "",
            title: "",
            chapterNumber: 1,
            description: "",
            learningObjectives: "",
        },
    });

    const selectedFormCurriculumId = watch("curriculumId") ?? "";
    const selectedFormGradeBookId = watch("gradeBookId") ?? "";

    const curriculumOptions: CurriculumOption[] = (curriculums as any[])
        .map((c) => ({ id: String(c?.id ?? ""), name: String(c?.name ?? "").trim() }))
        .filter((c) => c.id && c.name);

    const gradeBookOptions: GradeBookOption[] = (gradeBooks as any[])
        .map((b) => ({ id: String(b?.id ?? ""), bookTitle: String(b?.bookTitle ?? "").trim(), grade: b?.grade ?? "" }))
        .filter((b) => b.id && b.bookTitle);

    useEffect(() => {
        if (open) {
            if (chapter) {
                reset({
                    curriculumId: "",
                    gradeBookId: providedGradeBookId || chapter.gradeBookId,
                    title: chapter.title,
                    chapterNumber: chapter.chapterNumber,
                    description: chapter.description || "",
                    learningObjectives: chapter.learningObjectives || "",
                });
            } else {
                reset({
                    curriculumId: "",
                    gradeBookId: providedGradeBookId || "",
                    title: "",
                    chapterNumber: 1,
                    description: "",
                    learningObjectives: "",
                });
            }
            setSelectedCurriculumId("");
            setThumbnailFile(null);
            setThumbnailPreview(chapter?.thumbnail ? Config.proxyUrl + chapter.thumbnail : null);
        }
    }, [chapter, open, reset, providedGradeBookId]);

    const onSubmit = async (data: FormData) => {
        try {
            const formData = new globalThis.FormData();
            formData.append("title", data.title);
            formData.append("chapterNumber", String(data.chapterNumber));
            if (data.description) formData.append("description", data.description);
            if (data.learningObjectives) formData.append("learningObjectives", data.learningObjectives);
            if (thumbnailFile) formData.append("thumbnail", thumbnailFile);

            if (chapter) {
                await _axios.patch(`/admin/curriculum/chapters/${String(chapter?.id ?? "")}`, formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
                toast.success("Chapter updated successfully!");
            } else {
                await _axios.post(`/admin/curriculum/gradebook/${data.gradeBookId}/chapters`, formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl" aria-describedby={undefined}>
                <DialogHeader>
                    <DialogTitle className="text-2xl">
                        {chapter ? "Edit Chapter" : "Create New Chapter"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-2">
                    {/* Curriculum + Grade Book selectors (only when not pre-scoped) */}
                    {!providedGradeBookId && (
                        <>
                            <div className="space-y-2">
                                <Label>Curriculum *</Label>
                                <Select
                                    onValueChange={(v) => {
                                        setValue("curriculumId", v, { shouldValidate: true });
                                        setSelectedCurriculumId(v);
                                        setValue("gradeBookId", "", { shouldValidate: true });
                                    }}
                                    value={selectedFormCurriculumId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a curriculum" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {curriculumOptions.length > 0 ? (
                                            curriculumOptions.map((c) => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))
                                        ) : (
                                            <SelectItem value="__none__" disabled>No curriculum available</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Grade Book *</Label>
                                <Select
                                    onValueChange={(v) => setValue("gradeBookId", v, { shouldValidate: true })}
                                    value={selectedFormGradeBookId}
                                    disabled={!selectedCurriculumId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={selectedCurriculumId ? "Select a grade book" : "Select curriculum first"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {gradeBookOptions.length > 0 ? (
                                            gradeBookOptions.map((b) => (
                                                <SelectItem key={b.id} value={b.id}>
                                                    {b.bookTitle} (Class {b.grade})
                                                </SelectItem>
                                            ))
                                        ) : (
                                            <SelectItem value="__none__" disabled>No grade books available</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                                {errors.gradeBookId && <p className="text-sm text-red-500">{errors.gradeBookId.message}</p>}
                            </div>
                        </>
                    )}

                    {/* Chapter number + title */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Chapter Number *</Label>
                            <Input type="number" min="1" {...register("chapterNumber", { valueAsNumber: true })} placeholder="1" />
                            {errors.chapterNumber && <p className="text-sm text-red-500">{errors.chapterNumber.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Chapter Title *</Label>
                            <Input {...register("title")} placeholder="Introduction to Algebra" />
                            {errors.title && <p className="text-sm text-red-500">{errors.title.message}</p>}
                        </div>
                    </div>

                    {/* Thumbnail */}
                    <div className="space-y-2">
                        <Label>Chapter Thumbnail</Label>
                        <div className="flex items-center gap-4">
                            {thumbnailPreview ? (
                                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-indigo-200 shrink-0">
                                    <img src={thumbnailPreview} alt="Thumbnail" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => { setThumbnailFile(null); setThumbnailPreview(null); }}
                                        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
                                    >
                                        <X className="h-4 w-4 text-white" />
                                    </button>
                                </div>
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-indigo-50 border-2 border-dashed border-indigo-200 flex items-center justify-center shrink-0">
                                    <ImagePlus className="h-6 w-6 text-indigo-300" />
                                </div>
                            )}
                            <div className="flex-1">
                                <input
                                    ref={thumbnailInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const compressed = await compressImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.85 });
                                        setThumbnailFile(compressed);
                                        setThumbnailPreview(URL.createObjectURL(compressed));
                                    }}
                                />
                                <Button type="button" variant="outline" size="sm" onClick={() => thumbnailInputRef.current?.click()}>
                                    {thumbnailPreview ? "Change Image" : "Upload Image"}
                                </Button>
                                <p className="text-xs text-muted-foreground mt-1">Shown as the chapter circle thumbnail</p>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea {...register("description")} rows={3} placeholder="Brief description of this chapter..." />
                    </div>

                    {/* Learning Objectives */}
                    <div className="space-y-2">
                        <Label>Learning Objectives</Label>
                        <Textarea {...register("learningObjectives")} rows={3} placeholder="What students will learn in this chapter..." />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="rounded-xl">
                            {isSubmitting ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{chapter ? "Updating..." : "Creating..."}</>
                            ) : chapter ? "Update Chapter" : "Create Chapter"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
