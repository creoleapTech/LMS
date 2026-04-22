// src/pages/curriculum/PremiumChapterCard.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, GripVertical, BookOpen, Target, ChevronDown, ChevronUp, LayoutList } from "lucide-react";
import { Config } from "@/lib/config";
import { _axios } from "@/lib/axios";

interface Chapter {
    id?: string;
    _id?: string;
    title: string;
    chapterNumber: number;
    description?: string;
    learningObjectives?: string;
    thumbnail?: string | null;
    order?: number;
    updatedAt?: string;
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

interface ChapterContentHeading {
    id?: string;
    _id?: string;
    title?: string;
    order?: number;
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
    const chapterId = chapter.id ?? chapter._id ?? null;
    const thumbnailUrl = chapter.thumbnail
        ? `${Config.proxyUrl}${chapter.thumbnail}`
        : null;
    const hasDetails = !!(chapter.description || chapter.learningObjectives);
    const canExpand = hasDetails || !!chapterId;

    const {
        data: contentHeadings = [],
        isLoading: isHeadingsLoading,
        isError: isHeadingsError,
    } = useQuery<ChapterContentHeading[]>({
        queryKey: ["chapter-content-headings", chapterId],
        queryFn: async () => {
            const res = await _axios.get(`/admin/curriculum/chapter/${chapterId}/content`);
            const rows = (res?.data?.data || []) as ChapterContentHeading[];
            return [...rows].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        },
        enabled: expanded && !!chapterId,
        staleTime: 60 * 1000,
    });

    const handleCardClick = () => {
        if (canExpand) {
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
                className={`p-5 flex items-center gap-4 ${canExpand ? "cursor-pointer" : ""}`}
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
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md transition-all group-hover:scale-105">
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
                <div className="flex-1 items-center justify-center min-w-0">
                  <div className="flex items-center gap-5">
                      <Badge variant="outline" className="text-2xl p-2 px-5 font-bold text-indigo-600 border-indigo-200 mb-1.5">
                        Chapter {chapter.chapterNumber}
                    </Badge>
                     <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                        {chapter.title}
                    </h3>
                  </div>

                    {(curriculumName || bookTitle) && (
                        <div className="flex items-center gap-2 mb-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <BookOpen className="h-3 w-3" />
                            {curriculumName && <span>{curriculumName}</span>}
                            {curriculumName && bookTitle && <span>•</span>}
                            {bookTitle && <span>{bookTitle}</span>}
                        </div>
                    )}

                   
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

                    {canExpand && (
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
            {expanded && canExpand && (
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

                    {chapterId && (
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1.5">
                                <LayoutList className="h-3.5 w-3.5 text-indigo-500" /> Content Headings
                            </p>

                            {isHeadingsLoading && (
                                <p className="text-sm text-gray-600 dark:text-gray-300">Loading headings...</p>
                            )}

                            {!isHeadingsLoading && isHeadingsError && (
                                <p className="text-sm text-red-600">Could not load content headings.</p>
                            )}

                            {!isHeadingsLoading && !isHeadingsError && contentHeadings.length === 0 && (
                                <p className="text-sm text-gray-600 dark:text-gray-300">No content headings yet.</p>
                            )}

                            {!isHeadingsLoading && !isHeadingsError && contentHeadings.length > 0 && (
                                <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-200">
                                    {contentHeadings.map((heading, index) => (
                                        <li key={heading.id || heading._id || `${heading.title || "heading"}-${index}`} className="truncate">
                                            {(heading.order ?? index + 1)}. {heading.title || "Untitled content"}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}
