import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import {
  ChevronDown,
  ChevronRight,
  Video,
  FileText,
  FileDown,
  Activity,
  HelpCircle,
  Youtube,
  Type,
  CheckCircle2,
  Play,
  Circle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContentProgressEntry } from "@/hooks/useTeachingProgress";

type ContentType = "video" | "youtube" | "ppt" | "pdf" | "activity" | "quiz" | "text";

interface ContentItem {
  _id: string;
  title: string;
  type: ContentType;
  fileUrl?: string;
  videoUrl?: string;
  youtubeUrl?: string;
  textContent?: string;
  questions?: any[];
  isFree: boolean;
  order: number;
}

interface ChapterWithContent {
  _id: string;
  title: string;
  chapterNumber: number;
  order: number;
  description?: string;
  content: ContentItem[];
}

interface CourseSidebarProps {
  gradeBookId: string;
  activeContentId: string | null;
  onContentSelect: (content: ContentItem, chapter: ChapterWithContent) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  completedContentIds: Set<string>;
  progressByContentId: Map<string, ContentProgressEntry>;
}

const contentTypeIcons: Record<ContentType, any> = {
  video: Video,
  youtube: Youtube,
  ppt: FileText,
  pdf: FileDown,
  activity: Activity,
  quiz: HelpCircle,
  text: Type,
};

export function CourseSidebar({
  gradeBookId,
  activeContentId,
  onContentSelect,
  collapsed = false,
  onToggleCollapse,
  completedContentIds,
  progressByContentId,
}: CourseSidebarProps) {
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  const {
    data: chapters = [],
    isLoading,
  } = useQuery<ChapterWithContent[]>({
    queryKey: ["gradebook-full", gradeBookId],
    queryFn: async () => {
      const res = await _axios.get(`/admin/curriculum-reader/gradebook/${gradeBookId}/full`);
      return res.data.data || [];
    },
    enabled: !!gradeBookId,
  });

  // Auto-expand the chapter containing the active content
  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  };

  // Auto-expand all chapters on first load
  useEffect(() => {
    if (chapters.length > 0 && expandedChapters.size === 0) {
      setExpandedChapters(new Set(chapters.map((ch) => ch._id)));
    }
  }, [chapters]);

  if (collapsed) {
    return (
      <div className="w-12 bg-white dark:bg-slate-900 border-r flex flex-col items-center py-4">
        <Button variant="ghost" size="sm" onClick={onToggleCollapse} className="mb-4">
          <ChevronRight className="h-4 w-4" />
        </Button>
        {chapters.map((chapter) => (
          <div
            key={chapter._id}
            className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-2"
            title={`Chapter ${chapter.chapterNumber}: ${chapter.title}`}
          >
            {chapter.chapterNumber}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-72 lg:w-80 bg-white dark:bg-slate-900 border-r flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between shrink-0">
        <h3 className="font-semibold text-sm">Course Content</h3>
        <Button variant="ghost" size="sm" onClick={onToggleCollapse}>
          <ChevronDown className="h-4 w-4 rotate-90" />
        </Button>
      </div>

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : chapters.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            No chapters available
          </div>
        ) : (
          chapters.map((chapter) => {
            const isExpanded = expandedChapters.has(chapter._id);
            const hasActiveContent = chapter.content.some((c) => c._id === activeContentId);

            // Calculate chapter completion
            const completedInChapter = chapter.content.filter(
              (c) => completedContentIds.has(c._id)
            ).length;
            const totalInChapter = chapter.content.length;
            const allComplete = totalInChapter > 0 && completedInChapter === totalInChapter;

            return (
              <div key={chapter._id} className="border-b last:border-b-0">
                {/* Chapter header */}
                <button
                  onClick={() => toggleChapter(chapter._id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left ${
                    hasActiveContent ? "bg-indigo-50/50 dark:bg-indigo-900/20" : ""
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    allComplete
                      ? "bg-green-100 dark:bg-green-900"
                      : "bg-indigo-100 dark:bg-indigo-900"
                  }`}>
                    {allComplete ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                        {chapter.chapterNumber}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{chapter.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {completedInChapter}/{totalInChapter} completed
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                {/* Content items */}
                {isExpanded && (
                  <div className="pb-1">
                    {chapter.content.map((item) => {
                      const Icon = contentTypeIcons[item.type] || FileText;
                      const isActive = item._id === activeContentId;
                      const displayNum = `${chapter.chapterNumber}.${item.order}`;
                      const isItemCompleted = completedContentIds.has(item._id);
                      const hasPartialProgress = !isItemCompleted && progressByContentId.has(item._id);

                      return (
                        <button
                          key={item._id}
                          onClick={() => onContentSelect(item, chapter)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 pl-8 text-left transition-colors ${
                            isActive
                              ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-l-2 border-indigo-500"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          {/* Completion indicator */}
                          <div className="shrink-0">
                            {isItemCompleted ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : hasPartialProgress ? (
                              <Circle className="h-4 w-4 text-amber-400 fill-amber-400/30" />
                            ) : (
                              <div className={`p-1.5 rounded-lg ${
                                isActive
                                  ? "bg-indigo-200 dark:bg-indigo-800"
                                  : "bg-slate-100 dark:bg-slate-800"
                              }`}>
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground font-mono">{displayNum}</span>
                              <p className={`text-sm truncate ${isItemCompleted ? "text-muted-foreground line-through" : ""}`}>
                                {item.title}
                              </p>
                            </div>
                          </div>
                          {isActive && (
                            <Play className="h-3 w-3 text-indigo-500 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
