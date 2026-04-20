// src/pages/curriculum/PremiumGradeBookCard.tsx
"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, BookOpen } from "lucide-react";
import { Config } from "@/lib/config";

interface GradeBook {
    id: string;
    bookTitle: string;
    subtitle?: string;
    grade: number;
    description?: string;
    coverImage?: string;
    isPublished: boolean;
    curriculumId?: string;
    curriculumName?: string;
}

interface Props {
    gradeBook: GradeBook;
    onView: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    showActions?: boolean;
    curriculumName?: string;
}

export function PremiumGradeBookCard({
    gradeBook,
    onView,
    onEdit,
    onDelete,
    showActions = true,
    curriculumName,
}: Props) {
    void curriculumName;
    const coverUrl = gradeBook.coverImage ? `${Config.imgUrl}${gradeBook.coverImage}` : "";

    return (
        <Card
            className="group relative w-full max-w-[220px] overflow-hidden rounded-2xl border-slate-200/80 bg-white transition-all duration-300 cursor-pointer hover:shadow-xl dark:bg-gray-900"
            onClick={onView}
            role="button"
            aria-label={`Open ${gradeBook.bookTitle}`}
        >
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-linear-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                {gradeBook.coverImage ? (
                    <img
                        src={coverUrl}
                        alt={gradeBook.bookTitle}
                        width={900}
                        height={1200}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain object-center"
                    />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <BookOpen className="h-16 w-16 text-slate-300 dark:text-slate-700" />
                    </div>
                )}

                {showActions && (onEdit || onDelete) && (
                    <div
                        className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-linear-to-t from-black/65 to-transparent p-2 opacity-100 transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {onEdit && (
                            <Button
                                size="icon"
                                variant="secondary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit();
                                }}
                                aria-label="Edit book"
                                className="h-8 w-8 bg-white/90 text-slate-900 hover:bg-white"
                            >
                                <Edit className="h-4 w-4" />
                            </Button>
                        )}

                        {onDelete && (
                            <Button
                                size="icon"
                                variant="outline"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                aria-label="Delete book"
                                className="h-8 w-8 border-red-200 bg-white/90 text-red-600 hover:bg-red-50"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
}
