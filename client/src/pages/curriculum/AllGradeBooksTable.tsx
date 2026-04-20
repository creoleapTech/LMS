"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Loader2, Plus, ArrowLeft } from "lucide-react";
import { GradeBookFormDialogStandalone } from "./GradeBookFormDialogStandalone";
import { PremiumGradeBookCard } from "./PremiumGradeBookCard";
import { ChapterContentManager } from "./ChapterContentManager";
import { ChapterManager } from "./ChapterManager";

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

interface GradeBook {
    id: string;
    bookTitle: string;
    subtitle?: string;
    description?: string;
    grade: number;
    coverImage?: string;
    curriculumId: string;
    curriculumName?: string;
    isPublished: boolean;
    createdAt: string;
}

export function AllGradeBooksTable() {
    const [search, setSearch] = useState("");
    const [page] = useState(1);
    const [openForm, setOpenForm] = useState(false);
    const [selectedGradeBookId, setSelectedGradeBookId] = useState<string | null>(null);
    const [selectedGradeBook, setSelectedGradeBook] = useState<GradeBook | null>(null);
    const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
    const [selectedChapterNumber, setSelectedChapterNumber] = useState<number>(1);
    const debouncedSearch = useDebounce(search, 500);
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ["all-gradebooks", page, debouncedSearch],
        queryFn: async () => {
            const res = await _axios.get("/admin/curriculum/all-gradebooks", {
                params: { page, search: debouncedSearch, limit: 20 },
            });
            return res.data;
        },
    });

    const handleSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ["all-gradebooks"] });
    };

    const handleViewBook = (book: GradeBook) => {
        setSelectedGradeBook(book);
        setSelectedGradeBookId(book.id);
    };

    const handleBack = () => {
        if (selectedChapterId) {
            setSelectedChapterId(null);
        } else {
            setSelectedGradeBookId(null);
            setSelectedGradeBook(null);
        }
    };

    // If viewing a specific grade book's chapters
    if (selectedGradeBookId && !selectedChapterId) {
        const curriculumName = selectedGradeBook?.curriculumName || '';

        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={handleBack} className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back to All Books
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            {selectedGradeBook?.bookTitle}
                            {curriculumName && (
                                <span className="text-sm font-normal text-gray-500 ml-2">
                                    • {curriculumName}
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ChapterManager
                            gradeBookId={selectedGradeBookId}
                            onChapterSelect={(chapterId, chapterNum) => {
                                setSelectedChapterId(chapterId);
                                setSelectedChapterNumber(chapterNum || 1);
                            }}
                        />
                    </CardContent>
                </Card>
            </div>
        );
    }

    // If viewing a specific chapter's content
    if (selectedChapterId) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={handleBack} className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Chapters
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Chapter Content</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ChapterContentManager
                            chapterId={selectedChapterId}
                            chapterNumber={selectedChapterNumber}
                        />
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Default view - show all books
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search books..."
                        className="pl-8 rounded-xl"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Button onClick={() => setOpenForm(true)} className="rounded-xl">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Grade Book
                </Button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : data?.data?.length === 0 ? (
                <Card className="text-center py-12 rounded-2xl border-slate-200/80">
                    <CardContent>
                        <p className="text-muted-foreground mb-4">No grade books found.</p>
                        <Button onClick={() => setOpenForm(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create First Grade Book
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {data?.data?.map((book: GradeBook) => {
                        const curriculumName = book.curriculumName;

                        return (
                            <PremiumGradeBookCard
                                key={book.id}
                                gradeBook={book}
                                onView={() => handleViewBook(book)}
                                curriculumName={curriculumName}
                                showActions={false}
                            />
                        );
                    })}
                </div>
            )}

            <GradeBookFormDialogStandalone
                open={openForm}
                onOpenChange={setOpenForm}
                onSuccess={handleSuccess}
            />
        </div>
    );
}
