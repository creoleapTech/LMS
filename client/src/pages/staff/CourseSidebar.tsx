import {
  ChevronLeft,
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
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  chapter: ChapterWithContent;
  chapterIndex: number;
  totalChapters: number;
  activeContentId: string | null;
  onContentSelect: (content: ContentItem) => void;
  onBackToChapters: () => void;
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
  chapter,
  chapterIndex,
  totalChapters,
  activeContentId,
  onContentSelect,
  onBackToChapters,
  collapsed = false,
  onToggleCollapse,
  completedContentIds,
  progressByContentId,
}: CourseSidebarProps) {
  const completedInChapter = chapter.content.filter((c) =>
    completedContentIds.has(c._id)
  ).length;
  const totalInChapter = chapter.content.length;
  const progressPercent =
    totalInChapter > 0
      ? Math.round((completedInChapter / totalInChapter) * 100)
      : 0;

  if (collapsed) {
    return (
      <div className="w-12 bg-white dark:bg-slate-900 border-r flex flex-col items-center py-4">
        <Button variant="ghost" size="sm" onClick={onToggleCollapse} className="mb-4">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div
          className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300"
          title={`Chapter ${chapter.chapterNumber}: ${chapter.title}`}
        >
          {chapter.chapterNumber}
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 lg:w-80 bg-white dark:bg-slate-900 border-r flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b shrink-0">
        <div className="flex items-center justify-between px-3 pt-3 pb-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToChapters}
            className="gap-1 text-xs text-muted-foreground hover:text-foreground -ml-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            All Chapters
          </Button>
          <Button variant="ghost" size="sm" onClick={onToggleCollapse}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground mb-0.5">
            Chapter {chapterIndex + 1} of {totalChapters}
          </p>
          <p className="font-semibold text-sm truncate">{chapter.title}</p>
          <div className="flex items-center gap-2 mt-2">
            <Progress value={progressPercent} className="flex-1 h-1.5" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {completedInChapter}/{totalInChapter}
            </span>
          </div>
        </div>
      </div>

      {/* Content items */}
      <div className="flex-1 overflow-y-auto">
        {chapter.content.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            No content in this chapter
          </div>
        ) : (
          <div className="py-1">
            {chapter.content.map((item) => {
              const Icon = contentTypeIcons[item.type] || FileText;
              const isActive = item._id === activeContentId;
              const displayNum = `${chapter.chapterNumber}.${item.order}`;
              const isItemCompleted = completedContentIds.has(item._id);
              const hasPartialProgress =
                !isItemCompleted && progressByContentId.has(item._id);

              return (
                <button
                  key={item._id}
                  onClick={() => onContentSelect(item)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
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
                      <div
                        className={`p-1.5 rounded-lg ${
                          isActive
                            ? "bg-indigo-200 dark:bg-indigo-800"
                            : "bg-slate-100 dark:bg-slate-800"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono">
                        {displayNum}
                      </span>
                      <p
                        className={`text-sm truncate ${
                          isItemCompleted
                            ? "text-muted-foreground line-through"
                            : ""
                        }`}
                      >
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
    </div>
  );
}
