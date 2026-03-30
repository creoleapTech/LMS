import { CheckCircle2, ChevronRight, BookOpen, PlayCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

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

interface ChapterListViewProps {
  chapters: ChapterWithContent[];
  completedContentIds: Set<string>;
  onSelectChapter: (chapterIndex: number) => void;
}

export function ChapterListView({
  chapters,
  completedContentIds,
  onSelectChapter,
}: ChapterListViewProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <BookOpen className="h-6 w-6 text-indigo-600" />
          <h2 className="text-xl font-bold">Chapters</h2>
          <span className="text-sm text-muted-foreground">
            {chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}
          </span>
        </div>

        <div className="space-y-3">
          {chapters.map((chapter, index) => {
            const completedInChapter = chapter.content.filter((c) =>
              completedContentIds.has(c._id)
            ).length;
            const totalInChapter = chapter.content.length;
            const allComplete =
              totalInChapter > 0 && completedInChapter === totalInChapter;
            const progressPercent =
              totalInChapter > 0
                ? Math.round((completedInChapter / totalInChapter) * 100)
                : 0;
            const hasStarted = completedInChapter > 0;

            return (
              <button
                key={chapter._id}
                onClick={() => onSelectChapter(index)}
                className="w-full text-left bg-white dark:bg-slate-900 border-2 border-transparent hover:border-indigo-400 hover:shadow-md rounded-xl p-5 flex items-center gap-4 transition-all group"
              >
                {/* Chapter number circle */}
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                    allComplete
                      ? "bg-green-100 dark:bg-green-900/40"
                      : hasStarted
                        ? "bg-indigo-100 dark:bg-indigo-900/40"
                        : "bg-slate-100 dark:bg-slate-800"
                  }`}
                >
                  {allComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <span
                      className={`text-sm font-bold ${
                        hasStarted
                          ? "text-indigo-700 dark:text-indigo-300"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {chapter.chapterNumber}
                    </span>
                  )}
                </div>

                {/* Chapter info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Chapter {chapter.chapterNumber}
                    </span>
                    {allComplete && (
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                        Completed
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-base truncate mb-1">
                    {chapter.title}
                  </p>
                  {chapter.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {chapter.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3">
                    <Progress value={progressPercent} className="flex-1 h-1.5" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {completedInChapter}/{totalInChapter}
                    </span>
                  </div>
                </div>

                {/* Action icon */}
                <div className="shrink-0">
                  {allComplete ? (
                    <ChevronRight className="h-5 w-5 text-green-500 group-hover:translate-x-0.5 transition-transform" />
                  ) : hasStarted ? (
                    <PlayCircle className="h-5 w-5 text-indigo-500 group-hover:translate-x-0.5 transition-transform" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
