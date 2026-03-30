"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Plus, ArrowLeft } from "lucide-react";
import { UnifiedChapterFormDialog } from "./UnifiedChapterFormDialog";
import { PremiumChapterCard } from "./PremiumChapterCard";
import { ChapterContentManager } from "./ChapterContentManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

interface Chapter {
    _id: string;
    title: string;
    chapterNumber: number;
    description?: string;
    learningObjectives?: string;
    gradeBookId: {
        _id: string;
        bookTitle: string;
        curriculumId: { _id: string; name: string };
    } | string;
    createdAt: string;
}

export function AllChaptersTable() {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [openForm, setOpenForm] = useState(false);
    const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
    const [selectedChapterNumber, setSelectedChapterNumber] = useState<number>(1);
    const debouncedSearch = useDebounce(search, 500);
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ["all-chapters", page, debouncedSearch],
        queryFn: async () => {
            const res = await _axios.get("/admin/curriculum/all-chapters", {
                params: { page, search: debouncedSearch, limit: 20 },
            });
            return res.data;
        },
    });

    const handleSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ["all-chapters"] });
    };

    // If a chapter is selected, show its content
    if (selectedChapterId) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        onClick={() => setSelectedChapterId(null)}
                        className="gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to All Chapters
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Chapter Content</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ChapterContentManager chapterId={selectedChapterId} chapterNumber={selectedChapterNumber} />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search chapters..."
                        className="pl-8 rounded-xl"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Button onClick={() => setOpenForm(true)} className="rounded-xl">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Chapter
                </Button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : data?.data?.length === 0 ? (
                <Card className="text-center py-12 rounded-2xl border-slate-200/80">
                    <CardContent>
                        <p className="text-muted-foreground mb-4">No chapters found.</p>
                        <Button onClick={() => setOpenForm(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create First Chapter
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {data?.data?.map((chapter: Chapter) => {
                        const book =
                            typeof chapter.gradeBookId === "object"
                                ? chapter.gradeBookId
                                : null;
                        const curriculum =
                            book && typeof book.curriculumId === "object"
                                ? book.curriculumId
                                : null;

                        return (
                            <PremiumChapterCard
                                key={chapter._id}
                                chapter={chapter}
                                onView={() => {
                                    setSelectedChapterId(chapter._id);
                                    setSelectedChapterNumber(chapter.chapterNumber);
                                }}
                                curriculumName={curriculum?.name}
                                bookTitle={book?.bookTitle}
                                showActions={false}
                            />
                        );
                    })}
                </div>
            )}

            <UnifiedChapterFormDialog
                open={openForm}
                onOpenChange={setOpenForm}
                onSuccess={handleSuccess}
            />
        </div>
    );
}
