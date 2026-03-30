// src/pages/curriculum/PremiumGradeBookCard.tsx
"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Edit, Trash2, BookOpen, GraduationCap } from "lucide-react";
import { Config } from "@/lib/config";

interface GradeBook {
    _id: string;
    bookTitle: string;
    subtitle?: string;
    grade: number;
    description?: string;
    coverImage?: string;
    isPublished: boolean;
    curriculumId?: { _id: string; name: string } | string;
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
    const curriculum = curriculumName ||
        (typeof gradeBook.curriculumId === 'object' ? gradeBook.curriculumId.name : undefined);

    return (
        <Card
            className="group relative overflow-hidden hover:shadow-2xl transition-all duration-300 cursor-pointer bg-white dark:bg-gray-900 rounded-2xl border-slate-200/80"
            onClick={onView}
        >
            {/* Large Cover Image Section */}
            <div className="relative h-64 overflow-hidden bg-linear-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                {gradeBook.coverImage ? (
                    <>
                        <img
                            src={`${Config.imgUrl}${gradeBook.coverImage}`}
                            alt={gradeBook.bookTitle}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        {/* Subtle gradient overlay only at bottom */}
                        <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />
                    </>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <BookOpen className="h-24 w-24 text-slate-300 dark:text-slate-700 mb-4" />
                        <div className="text-7xl font-bold text-slate-200 dark:text-slate-800">
                            {gradeBook.grade}
                        </div>
                    </div>
                )}

                {/* Clean badges in corners */}
                <div className="absolute top-3 left-3">
                    <Badge className="bg-white/95 dark:bg-gray-900/95 text-gray-900 dark:text-gray-100 border-0 shadow-lg font-semibold">
                        <GraduationCap className="h-3.5 w-3.5 mr-1.5" />
                        Class {gradeBook.grade}
                    </Badge>
                </div>

                {gradeBook.isPublished && (
                    <div className="absolute top-3 right-3">
                        <Badge className="bg-emerald-500 text-white border-0 shadow-lg">
                            Published
                        </Badge>
                    </div>
                )}
            </div>

            {/* Content Section - Clean and Minimal */}
            <div className="p-5">
                {/* Curriculum Name - Subtle */}
                {curriculum && (
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
                        {curriculum}
                    </p>
                )}

                {/* Title - Bold and Clear */}
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1.5 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {gradeBook.bookTitle}
                </h3>

                {/* Subtitle - Medium weight */}
                {gradeBook.subtitle && (
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3 line-clamp-1">
                        {gradeBook.subtitle}
                    </p>
                )}

                {/* Description - Light */}
                {gradeBook.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-500 mb-4 line-clamp-2">
                        {gradeBook.description}
                    </p>
                )}

                {/* Simple divider */}
                <div className="h-px bg-gray-200 dark:bg-gray-800 my-4" />

                {/* Footer - Minimal */}
                <div className="flex items-center justify-between">
                    {!gradeBook.isPublished && (
                        <Badge variant="outline" className="text-xs text-gray-600 dark:text-gray-400">
                            Draft
                        </Badge>
                    )}
                    {gradeBook.isPublished && <div />}

                    {/* Action Buttons - Clean */}
                    {showActions && (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onView();
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                            >
                                <Eye className="h-3.5 w-3.5 mr-1.5" />
                                View
                            </Button>

                            {onEdit && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEdit();
                                    }}
                                    className="border-gray-300 dark:border-gray-700"
                                >
                                    <Edit className="h-3.5 w-3.5" />
                                </Button>
                            )}

                            {onDelete && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete();
                                    }}
                                    className="border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}
