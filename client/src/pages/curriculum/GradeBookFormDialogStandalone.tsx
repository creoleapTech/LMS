// src/pages/curriculum/GradeBookFormDialogStandalone.tsx
"use client";

import { useEffect, useState } from "react";
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
import { Loader2, X } from "lucide-react";
import { _axios } from "@/lib/axios";
import { toast } from "sonner";

const schema = z.object({
    curriculumId: z.string().min(1, "Please select a curriculum"),
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
    onSuccess: () => void;
}

export function GradeBookFormDialogStandalone({ open, onOpenChange, onSuccess }: Props) {
    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [coverImagePreview, setCoverImagePreview] = useState<string>("");

    const { data: curriculums = [] } = useQuery({
        queryKey: ["curriculums-list"],
        queryFn: async () => {
            const res = await _axios.get("/admin/curriculum", { params: { limit: 100 } });
            return res.data.data || [];
        },
        enabled: open,
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
            grade: 1,
            bookTitle: "",
            subtitle: "",
            description: "",
            isPublished: false,
        },
    });

    useEffect(() => {
        if (open) {
            reset({
                curriculumId: "",
                grade: 1,
                bookTitle: "",
                subtitle: "",
                description: "",
                isPublished: false,
            });
            setCoverImagePreview("");
            setCoverImageFile(null);
        }
    }, [open, reset]);

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

            await _axios.post(`/admin/curriculum/${data.curriculumId}/grades`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            toast.success("Grade book created successfully!");
            onSuccess();
            onOpenChange(false);
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Something went wrong");
        }
    };

    const gradeOptions = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl">Create New Grade Book</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                            <Label>Curriculum *</Label>
                            <Select
                                onValueChange={(v) => setValue("curriculumId", v)}
                                value={watch("curriculumId")}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a curriculum" />
                                </SelectTrigger>
                                <SelectContent>
                                    {curriculums.map((curriculum: any) => (
                                        <SelectItem key={curriculum._id} value={curriculum._id}>
                                            {curriculum.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.curriculumId && (
                                <p className="text-sm text-red-500">{errors.curriculumId.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Grade *</Label>
                            <Select
                                onValueChange={(v) => setValue("grade", parseInt(v))}
                                value={watch("grade").toString()}
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
                            {errors.bookTitle && (
                                <p className="text-sm text-red-500">{errors.bookTitle.message}</p>
                            )}
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
                                        className="h-32 w-auto rounded-lg border object-cover"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="published"
                                className="h-4 w-4"
                                onChange={(e) => setValue("isPublished", e.target.checked)}
                                checked={watch("isPublished")}
                            />
                            <Label htmlFor="published">Publish immediately</Label>
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
                                    Creating...
                                </>
                            ) : (
                                "Create Grade Book"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
