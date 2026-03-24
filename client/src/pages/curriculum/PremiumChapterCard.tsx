// src/pages/curriculum/PremiumChapterCard.tsx
"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Edit, Trash2, GripVertical, BookOpen, Target } from "lucide-react";

interface Chapter {
    _id: string;
    title: string;
    chapterNumber: number;
    description?: string;
    learningObjectives?: string;
    order?: number;
}

interface Props {
    chapter: Chapter;
    onView: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    showActions?: boolean;
    draggable?: boolean;
    dragHandleProps?: any;
    style?: React.CSSProperties;
    curriculumName?: string;
    bookTitle?: string;
}

export function PremiumChapterCard({
    chapter,
    onView,
    onEdit,
    onDelete,
    showActions = true,
    draggable = false,
    dragHandleProps,
    style,
    curriculumName,
    bookTitle,
}: Props) {
    return (
        <Card
            style={style}
            className="group relative overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer bg-white dark:bg-gray-900"
            onClick={onView}
        >
            <div className="p-5">
                <div className="flex items-start gap-4">
                    {/* Drag Handle */}
                    {draggable && dragHandleProps && (
                        <div
                            {...dragHandleProps}
                            className="cursor-grab active:cursor-grabbing pt-1"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <GripVertical className="h-5 w-5 text-gray-400" />
                        </div>
                    )}

                    {/* Chapter Number - Clean Circle */}
                    <div className="flex-shrink-0">
                        <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-white">{chapter.chapterNumber}</div>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        {/* Breadcrumb - Minimal */}
                        {(curriculumName || bookTitle) && (
                            <div className="flex items-center gap-2 mb-2 text-xs text-gray-500 dark:text-gray-400">
                                <BookOpen className="h-3 w-3" />
                                {curriculumName && <span>{curriculumName}</span>}
                                {curriculumName && bookTitle && <span>•</span>}
                                {bookTitle && <span>{bookTitle}</span>}
                            </div>
                        )}

                        {/* Title - Bold */}
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                            {chapter.title}
                        </h3>

                        {/* Description */}
                        {chapter.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                                {chapter.description}
                            </p>
                        )}

                        {/* Learning Objectives - Subtle */}
                        {chapter.learningObjectives && (
                            <div className="flex items-start gap-2 mb-3 p-2.5 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-100 dark:border-blue-900">
                                <Target className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-900 dark:text-blue-100 line-clamp-2">
                                    {chapter.learningObjectives}
                                </p>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                            <Badge variant="outline" className="text-xs text-gray-600 dark:text-gray-400">
                                Chapter {chapter.chapterNumber}
                            </Badge>

                            {/* Action Buttons */}
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
                </div>
            </div>
        </Card>
    );
}
