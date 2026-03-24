// src/pages/curriculum/ChapterFormDialogStandalone.tsx
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
import { Loader2 } from "lucide-react";
import { _axios } from "@/lib/axios";
import { toast } from "sonner";

const schema = z.object({
    curriculumId: z.string().min(1, "Please select a curriculum"),
    gradeBookId: z.string().min(1, "Please select a grade book"),
    title: z.string().min(3, "Title must be at least 3 characters"),
    chapterNumber: z.number().min(1, "Chapter number must be at least 1"),
    description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function ChapterFormDialogStandalone({ open, onOpenChange, onSuccess }: Props) {
    const [selectedCurriculumId, setSelectedCurriculumId] = useState<string>("");

    const { data: curriculums = [] } = useQuery({
        queryKey: ["curriculums-list"],
        queryFn: async () => {
            const res = await _axios.get("/admin/curriculum", { params: { limit: 100 } });
            return res.data.data || [];
        },
        enabled: open,
    });

    const { data: gradeBooks = [] } = useQuery({
        queryKey: ["gradebooks-for-curriculum", selectedCurriculumId],
        queryFn: async () => {
            const res = await _axios.get(`/admin/curriculum/${selectedCurriculumId}/grades`);
            return res.data.data || [];
        },
        enabled: !!selectedCurriculumId,
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
            gradeBookId: "",
            title: "",
            chapterNumber: 1,
            description: "",
        },
    });

    useEffect(() => {
        if (open) {
            reset({
                curriculumId: "",
                gradeBookId: "",
                title: "",
                chapterNumber: 1,
                description: "",
            });
            setSelectedCurriculumId("");
        }
    }, [open, reset]);

    const onSubmit = async (data: FormData) => {
        try {
            await _axios.post(`/admin/curriculum/gradebook/${data.gradeBookId}/chapters`, {
                title: data.title,
                chapterNumber: data.chapterNumber,
                description: data.description,
            });

            toast.success("Chapter created successfully!");
            onSuccess();
            onOpenChange(false);
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Something went wrong");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl">Create New Chapter</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                            <Label>Curriculum *</Label>
                            <Select
                                onValueChange={(v) => {
                                    setValue("curriculumId", v);
                                    setSelectedCurriculumId(v);
                                    setValue("gradeBookId", ""); // Reset grade book selection
                                }}
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
                            <Label>Grade Book *</Label>
                            <Select
                                onValueChange={(v) => setValue("gradeBookId", v)}
                                value={watch("gradeBookId")}
                                disabled={!selectedCurriculumId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={selectedCurriculumId ? "Select a grade book" : "Select curriculum first"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {gradeBooks.map((book: any) => (
                                        <SelectItem key={book._id} value={book._id}>
                                            {book.bookTitle} (Class {book.grade})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.gradeBookId && (
                                <p className="text-sm text-red-500">{errors.gradeBookId.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Chapter Number *</Label>
                            <Input
                                type="number"
                                {...register("chapterNumber", { valueAsNumber: true })}
                                placeholder="1"
                                min="1"
                            />
                            {errors.chapterNumber && (
                                <p className="text-sm text-red-500">{errors.chapterNumber.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Chapter Title *</Label>
                            <Input
                                {...register("title")}
                                placeholder="Introduction to Algebra"
                            />
                            {errors.title && (
                                <p className="text-sm text-red-500">{errors.title.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                {...register("description")}
                                rows={3}
                                placeholder="Brief description of this chapter..."
                            />
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                <strong>Note:</strong> After creating the chapter, you can add content (videos, PDFs, PPTs) by navigating to the chapter in the Curriculum tab.
                            </p>
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
                                "Create Chapter"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
