// src/pages/curriculum/PremiumChapterCard.tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, GripVertical, BookOpen, Target, ChevronDown, ChevronUp, LayoutList } from "lucide-react";
import { Config } from "@/lib/config";

interface Chapter {
    id?: string;
    _id?: string;
    title: string;
    chapterNumber: number;
    description?: string;
    learningObjectives?: string;
    thumbnail?: string | null;
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
    const [expanded, setExpanded] = useState(false);
    const thumbnailUrl = chapter.thumbnail ? Config.proxyUrl + chapter.thumbnail : null;
    const hasDetails = !!(chapter.description || chapter.learningObjectives);

    const handleCardClick = () => {
        if (hasDetails) {
            setExpanded((prev) => !prev);
        }
    };

    return (
        <Card
            style={style}
            className="group relative overflow-hidden transition-all duration-300 bg-white dark:bg-gray-900 rounded-2xl border-slate-200/80 hover:shadow-lg"
        >
            {/* Main row */}
            <div
                className={`p-5 flex items-start gap-4 ${hasDetails ? "cursor-pointer" : ""}`}
                onClick={handleCardClick}
            >
                {/* Drag Handle */}
                {draggable && dragHandleProps && (
                    <div
                        {...dragHandleProps}
                        className="cursor-grab active:cursor-grabbing pt-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <GripVertical className="h-5 w-5 text-gray-400" />
                    </div>
                )}

                {/* Thumbnail / Number circle */}
                <div className="shrink-0">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md transition-all group-hover:scale-105">
                        {thumbnailUrl ? (
                            <img
                                src={thumbnailUrl}
                                alt={`Chapter ${chapter.chapterNumber}`}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span className="text-2xl font-bold text-white">{chapter.chapterNumber}</span>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <Badge variant="outline" className="text-xs font-bold text-indigo-600 border-indigo-200 mb-1.5">
                        Chapter {chapter.chapterNumber}
                    </Badge>

                    {(curriculumName || bookTitle) && (
                        <div className="flex items-center gap-2 mb-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <BookOpen className="h-3 w-3" />
                            {curriculumName && <span>{curriculumName}</span>}
                            {curriculumName && bookTitle && <span>•</span>}
                            {bookTitle && <span>{bookTitle}</span>}
                        </div>
                    )}

                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                        {chapter.title}
                    </h3>
                </div>

                {/* Right side: actions + expand toggle */}
                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {showActions && (
                        <>
                            <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); onView(); }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm gap-1.5"
                            >
                                <LayoutList className="h-3.5 w-3.5" />
                                Content
                            </Button>

                            {onEdit && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                                    className="border-gray-300 dark:border-gray-700"
                                >
                                    <Edit className="h-3.5 w-3.5" />
                                </Button>
                            )}

                            {onDelete && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                    className="border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </>
                    )}

                    {hasDetails && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setExpanded((p) => !p); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
                        >
                            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                    )}
                </div>
            </div>

            {/* Expandable details */}
            {expanded && hasDetails && (
                <div className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-gray-800 pt-4">
                    {chapter.description && (
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Description</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                {chapter.description}
                            </p>
                        </div>
                    )}
                    {chapter.learningObjectives && (
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1.5">
                                <Target className="h-3.5 w-3.5 text-indigo-500" /> Learning Objectives
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                {chapter.learningObjectives}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}
