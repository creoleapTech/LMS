// src/pages/curriculum/UnifiedChapterFormDialog.tsx
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
import { Loader2, Upload, X, Plus, Trash2 } from "lucide-react";
import { _axios } from "@/lib/axios";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const schema = z.object({
    curriculumId: z.string().optional(),
    gradeBookId: z.string().min(1, "Please select a grade book"),
    title: z.string().min(3, "Title must be at least 3 characters"),
    chapterNumber: z.number().min(1, "Chapter number must be at least 1"),
    description: z.string().optional(),
    learningObjectives: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ContentFile {
    id: string;
    type: "video" | "ppt" | "pdf" | "activity" | "quiz";
    file: File;
    title: string;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    gradeBookId?: string; // If provided, skip curriculum/book selection
    chapter?: any;
    onSuccess: () => void;
}

export function UnifiedChapterFormDialog({ open, onOpenChange, gradeBookId: providedGradeBookId, chapter, onSuccess }: Props) {
    const [selectedCurriculumId, setSelectedCurriculumId] = useState<string>("");
    const [contentFiles, setContentFiles] = useState<ContentFile[]>([]);
    const [currentContentType, setCurrentContentType] = useState<"video" | "ppt" | "pdf" | "activity" | "quiz">("video");

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
            setContentFiles([]);
            setSelectedCurriculumId("");
        }
    }, [chapter, open, reset, providedGradeBookId]);

    const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSize) {
            toast.error("File size must be less than 100MB");
            return;
        }

        const newContent: ContentFile = {
            id: Math.random().toString(36).substr(2, 9),
            type: currentContentType,
            file: file,
            title: file.name,
        };

        setContentFiles([...contentFiles, newContent]);
        toast.success(`${file.name} added`);
        e.target.value = ""; // Reset input
    };

    const removeContent = (id: string) => {
        setContentFiles(contentFiles.filter(c => c.id !== id));
    };

    const onSubmit = async (data: FormData) => {
        try {
            // Step 1: Create the chapter
            const chapterData = {
                title: data.title,
                chapterNumber: data.chapterNumber,
                description: data.description,
                learningObjectives: data.learningObjectives,
            };

            let chapterId: string;

            if (chapter) {
                // Update existing chapter
                await _axios.patch(`/admin/curriculum/chapters/${chapter._id}`, chapterData);
                chapterId = chapter._id;
                toast.success("Chapter updated successfully!");
            } else {
                // Create new chapter
                const response = await _axios.post(
                    `/admin/curriculum/gradebook/${data.gradeBookId}/chapters`,
                    chapterData
                );
                chapterId = response.data.data._id;
                toast.success("Chapter created successfully!");
            }

            // Step 2: Upload content files if any
            if (contentFiles.length > 0 && !chapter) {
                toast.info(`Uploading ${contentFiles.length} content file(s)...`);

                for (const content of contentFiles) {
                    const formData = new FormData();
                    formData.append("file", content.file);
                    formData.append("type", content.type);
                    formData.append("title", content.title);
                    formData.append("isFree", "false");

                    try {
                        await _axios.post(
                            `/admin/curriculum/chapter/${chapterId}/content`,
                            formData,
                            {
                                headers: { "Content-Type": "multipart/form-data" },
                            }
                        );
                    } catch (err) {
                        console.error(`Failed to upload ${content.title}`, err);
                        toast.error(`Failed to upload ${content.title}`);
                    }
                }

                toast.success("All content uploaded successfully!");
            }

            onSuccess();
            onOpenChange(false);
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Something went wrong");
        }
    };

    const getContentIcon = (type: string) => {
        switch (type) {
            case "video": return "🎥";
            case "ppt": return "📊";
            case "pdf": return "📄";
            case "activity": return "🧩";
            case "quiz": return "❓";
            default: return "📁";
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl">
                        {chapter ? "Edit Chapter" : "Create New Chapter"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <Tabs defaultValue="details" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="details">Chapter Details</TabsTrigger>
                            <TabsTrigger value="content" disabled={!!chapter}>
                                Content Files {contentFiles.length > 0 && `(${contentFiles.length})`}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="details" className="space-y-6 mt-6">
                            {!providedGradeBookId && (
                                <>
                                    <div className="space-y-2">
                                        <Label>Curriculum *</Label>
                                        <Select
                                            onValueChange={(v) => {
                                                setValue("curriculumId", v);
                                                setSelectedCurriculumId(v);
                                                setValue("gradeBookId", "");
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
                                </>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Chapter Number *</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        {...register("chapterNumber", { valueAsNumber: true })}
                                        placeholder="1"
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
                        </TabsContent>

                        <TabsContent value="content" className="space-y-6 mt-6">
                            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                                <p className="text-sm text-blue-800 dark:text-blue-200">
                                    <strong>Add Content Files:</strong> Upload videos, PDFs, PPTs, and other materials for this chapter. They will be uploaded after the chapter is created.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <Select
                                        value={currentContentType}
                                        onValueChange={(v: any) => setCurrentContentType(v)}
                                    >
                                        <SelectTrigger className="w-full sm:w-[200px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="video">🎥 Video Lecture</SelectItem>
                                            <SelectItem value="ppt">📊 PPT Slides</SelectItem>
                                            <SelectItem value="pdf">📄 PDF Notes</SelectItem>
                                            <SelectItem value="activity">🧩 Activity</SelectItem>
                                            <SelectItem value="quiz">❓ Quiz</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <div className="flex-1">
                                        <Input
                                            type="file"
                                            onChange={handleFileAdd}
                                            accept=".mp4,.pdf,.ppt,.pptx,.doc,.docx,.zip"
                                            className="cursor-pointer"
                                        />
                                    </div>
                                </div>

                                {contentFiles.length > 0 && (
                                    <div className="space-y-2">
                                        <Label>Files to Upload ({contentFiles.length})</Label>
                                        <div className="border rounded-lg divide-y">
                                            {contentFiles.map((content) => (
                                                <div key={content.id} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-2xl">{getContentIcon(content.type)}</span>
                                                        <div>
                                                            <p className="font-medium text-sm">{content.title}</p>
                                                            <p className="text-xs text-muted-foreground uppercase">{content.type}</p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeContent(content.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="flex justify-end gap-4 pt-6 border-t">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {chapter ? "Updating..." : contentFiles.length > 0 ? "Creating & Uploading..." : "Creating..."}
                                </>
                            ) : chapter ? (
                                "Update Chapter"
                            ) : (
                                `Create Chapter${contentFiles.length > 0 ? ` & Upload ${contentFiles.length} File(s)` : ""}`
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
