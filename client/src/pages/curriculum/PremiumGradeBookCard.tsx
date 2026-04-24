// src/pages/curriculum/PremiumGradeBookCard.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Edit, Eye, Trash2, BookOpen } from "lucide-react";
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
    updatedAt?: string;
}

interface Props {
    gradeBook: GradeBook;
    onView: () => void;
    onViewDetails?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    showActions?: boolean;
    curriculumName?: string;
}

export function PremiumGradeBookCard({
    gradeBook,
    onView,
    onViewDetails,
    onEdit,
    onDelete,
    showActions = true,
    curriculumName,
}: Props) {
    void curriculumName;
    const coverUrl = gradeBook.coverImage
        ? `${Config.imgUrl}${gradeBook.coverImage}`
        : "";

    return (
        /* Use a plain div — no Card wrapper so there's zero internal padding/border gap */
        <div
            className="group relative w-full max-w-[220px] overflow-hidden rounded-2xl shadow-md border border-slate-200/60 dark:border-slate-700/60 cursor-pointer hover:shadow-xl transition-all duration-300 bg-slate-100 dark:bg-slate-900 flex flex-col"
            onClick={onView}
            role="button"
            aria-label={`Open ${gradeBook.bookTitle}`}
        >
            {/* Image — fills top, 3:4 ratio */}
            <div className="relative w-full" style={{ aspectRatio: "3/4" }}>
                {gradeBook.coverImage ? (
                    <img
                        src={coverUrl}
                        alt={gradeBook.bookTitle}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover object-center"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                        <BookOpen className="h-16 w-16 text-slate-300 dark:text-slate-700" />
                    </div>
                )}

                {/* Action overlay — shown on hover */}
                {showActions && (onViewDetails || onEdit || onDelete) && (
                    <div
                        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-100 transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/30 bg-black/50 p-2 backdrop-blur-sm shadow-lg">
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={(e) => { e.stopPropagation(); onView(); }}
                                aria-label="View book"
                                className="h-8 w-full justify-center bg-white/90 text-slate-900 hover:bg-white"
                            >
                                <Eye className="mr-1.5 h-3.5 w-3.5" />
                                View
                            </Button>

                            {onViewDetails && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
                                    aria-label="View details"
                                    className="h-8 w-full justify-center bg-white/90 text-slate-900 hover:bg-white"
                                >
                                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                                    Details
                                </Button>
                            )}

                            {onEdit && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                                    aria-label="Edit book"
                                    className="h-8 w-full justify-center bg-white/90 text-slate-900 hover:bg-white"
                                >
                                    <Edit className="mr-1.5 h-3.5 w-3.5" />
                                    Edit
                                </Button>
                            )}

                            {onDelete && (
                                <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                    aria-label="Delete book"
                                    className="h-8 w-8 rounded-full border-red-200 bg-white/90 text-red-600 hover:bg-red-50"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Grade label — separate dark strip below the image */}
            <div className="bg-slate-900 dark:bg-slate-950 px-3 py-2.5">
                <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-[0.15em] leading-none">
                    Grade {gradeBook.grade}
                </p>
                <p className="text-[12px] font-semibold text-white leading-snug mt-0.5 line-clamp-1">
                    {gradeBook.bookTitle}
                </p>
            </div>
        </div>
    );
}
