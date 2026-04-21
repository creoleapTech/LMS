import { useState } from "react";
import { CheckCircle2, ChevronRight, BookOpen, PlayCircle, Info, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { TeachingMode } from "./types";

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
  learningObjectives?: string;
  content: ContentItem[];
}

interface ChapterListViewProps {
  chapters: ChapterWithContent[];
  completedContentIds: Set<string>;
  onSelectChapter: (chapterIndex: number) => void;
  mode: TeachingMode;
}

export function ChapterListView({
  chapters,
  completedContentIds,
  onSelectChapter,
  mode: _mode,
}: ChapterListViewProps) {
  const [detailsChapter, setDetailsChapter] = useState<ChapterWithContent | null>(null);

  return (
    <>
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
                            : "text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {chapter.chapterNumber}
                      </span>
                    )}
                  </div>

                  {/* Chapter info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        Chapter {chapter.chapterNumber}
                      </span>
                      {allComplete && (
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                          Completed
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-base truncate mb-2">
                      {chapter.title}
                    </p>
                    <div className="flex items-center gap-3">
                      <Progress value={progressPercent} className="flex-1 h-2" />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {completedInChapter}/{totalInChapter}
                      </span>
                    </div>
                  </div>

                  {/* Action icons */}
                  <div className="shrink-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {(chapter.description || chapter.learningObjectives) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailsChapter(chapter);
                        }}
                        className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                        title="View Details"
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    )}
                    
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

      <Dialog open={!!detailsChapter} onOpenChange={(open) => !open && setDetailsChapter(null)}>
        <DialogContent className="max-w-2xl rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-xl leading-snug">
              {detailsChapter?.title}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                Chapter {detailsChapter?.chapterNumber}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {detailsChapter?.description && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Description</h4>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4">
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {detailsChapter.description}
                  </p>
                </div>
              </div>
            )}

            {detailsChapter?.learningObjectives && (
              <div>
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <Target className="h-4 w-4 text-blue-600" />
                  Learning Objectives
                </h4>
                <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-4">
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {detailsChapter.learningObjectives}
                  </p>
                </div>
              </div>
            )}
            
            {(!detailsChapter?.description && !detailsChapter?.learningObjectives) && (
                <p className="text-sm text-muted-foreground">No description or learning objectives available for this chapter.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
