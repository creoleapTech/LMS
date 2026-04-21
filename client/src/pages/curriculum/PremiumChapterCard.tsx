// src/pages/curriculum/PremiumChapterCard.tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Edit, Trash2, GripVertical, BookOpen, Target, Info } from "lucide-react";

interface Chapter {
    id?: string;
    _id?: string;
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
    const [showDetails, setShowDetails] = useState(false);

    return (
        <>
            <Card
                style={style}
                className="group relative overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer bg-white dark:bg-gray-900 rounded-2xl border-slate-200/80"
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
                        <div className="shrink-0">
                            <div className="w-14 h-14 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all">
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

                            {/* Footer */}
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                                <Badge variant="outline" className="text-xs text-gray-600 dark:text-gray-400">
                                    Chapter {chapter.chapterNumber}
                                </Badge>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    {(chapter.description || chapter.learningObjectives) && (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowDetails(true);
                                            }}
                                            className="text-slate-600 dark:text-slate-300"
                                            title="View Details"
                                        >
                                            <Info className="h-3.5 w-3.5 mr-1.5" />
                                            Details
                                        </Button>
                                    )}

                                    {showActions && (
                                        <>
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
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            <Dialog open={showDetails} onOpenChange={setShowDetails}>
                <DialogContent className="max-w-2xl rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
                    <DialogHeader>
                        <DialogTitle className="text-xl leading-snug">
                            {chapter.title}
                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                                Chapter {chapter.chapterNumber}
                            </span>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 mt-4">
                        {chapter.description && (
                            <div>
                                <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Description</h4>
                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4">
                                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                        {chapter.description}
                                    </p>
                                </div>
                            </div>
                        )}

                        {chapter.learningObjectives && (
                            <div>
                                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    <Target className="h-4 w-4 text-blue-600" />
                                    Learning Objectives
                                </h4>
                                <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-4">
                                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                        {chapter.learningObjectives}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
