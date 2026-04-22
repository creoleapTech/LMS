import { useRef, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Config } from "@/lib/config";
import { ContentProtectionWrapper } from "@/components/protection/ContentProtectionWrapper";
import { YouTubePlayer } from "@/components/viewers/YouTubePlayer";
import { PdfFlipBook } from "@/components/viewers/PdfFlipBook";
import { PptViewer } from "@/components/viewers/PptViewer";
import { RichTextViewer } from "@/components/editors/RichTextViewer";
import { QuizViewer } from "@/components/quiz/QuizViewer";
import { useContentAutoSave } from "@/hooks/useContentAutoSave";
import type { ContentProgressEntry } from "@/hooks/useTeachingProgress";
import type { TeachingMode } from "./types";
import {
  Video,
  FileText,
  FileDown,
  Activity,
  HelpCircle,
  Youtube,
  Type,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

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

interface ContentViewerProps {
  content: ContentItem;
  chapterNumber: number;
  watermarkText?: string;
  classId: string;
  gradeBookId: string;
  isCompleted: boolean;
  contentProgress?: ContentProgressEntry;
  onMarkComplete: (contentId: string) => Promise<void>;
  onProgressUpdate: (
    contentId: string,
    data: { videoTimestamp?: number; pdfPage?: number }
  ) => void;
  isCompletingLoading?: boolean;
  isChapterComplete?: boolean;
  hasNextChapter?: boolean;
  onContinueToNextChapter?: () => void;
  onBackToChapters?: () => void;
  mode: TeachingMode;
}

const typeLabels: Record<ContentType, string> = {
  video: "Video Lecture",
  youtube: "YouTube Video",
  ppt: "Presentation",
  pdf: "PDF Document",
  activity: "Activity",
  quiz: "Quiz",
  text: "Reading Material",
};

const typeIcons: Record<ContentType, any> = {
  video: Video,
  youtube: Youtube,
  ppt: FileText,
  pdf: FileDown,
  activity: Activity,
  quiz: HelpCircle,
  text: Type,
};

export function ContentViewer({
  content,
  chapterNumber,
  watermarkText,
  classId,
  gradeBookId,
  isCompleted,
  contentProgress,
  onMarkComplete,
  isCompletingLoading,
  isChapterComplete,
  hasNextChapter,
  onContinueToNextChapter,
  onBackToChapters,
  mode,
}: ContentViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasSetInitialTime = useRef(false);
  const isViewMode = mode === "view";

  const { save: autoSave } = useContentAutoSave(
    isViewMode ? "" : classId,
    isViewMode ? "" : gradeBookId,
    isViewMode ? undefined : content._id
  );

  const fileUrl = content.videoUrl || content.fileUrl
    ? `${Config.imgUrl}${content.videoUrl || content.fileUrl}`
    : "";

  const Icon = typeIcons[content.type] || FileText;
  const displayNum = `${chapterNumber}.${content.order}`;

  // Video: set initial time from progress
  useEffect(() => {
    hasSetInitialTime.current = false;
  }, [content._id]);

  const handleVideoLoadedMetadata = useCallback(() => {
    if (
      !hasSetInitialTime.current &&
      videoRef.current &&
      contentProgress?.videoTimestamp
    ) {
      videoRef.current.currentTime = contentProgress.videoTimestamp;
      hasSetInitialTime.current = true;
    }
  }, [contentProgress?.videoTimestamp]);

  // Video: track time updates
  const handleVideoTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      autoSave({ videoTimestamp: Math.floor(videoRef.current.currentTime) });
    }
  }, [autoSave]);

  // PDF: track page changes
  const handlePdfPageChange = useCallback(
    (page: number) => {
      autoSave({ pdfPage: page });
    },
    [autoSave]
  );

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 lg:p-8 text-white">
        <div className="flex items-center gap-3 mb-3">
          <Icon className="h-5 w-5" />
          <Badge className="bg-white/30 text-white border-0 px-3 py-0.5">
            {typeLabels[content.type] || content.type.toUpperCase()}
          </Badge>
          <Badge className="bg-white/25 text-white border-0 px-2 py-0.5 font-mono text-sm">
            {displayNum}
          </Badge>
          {content.isFree && (
            <Badge className="bg-green-500/80 text-white border-0">Free Preview</Badge>
          )}
        </div>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl lg:text-3xl font-bold">{content.title}</h1>

          {/* Mark as Complete Button */}
          {!isViewMode && (
            <Button
              onClick={() => onMarkComplete(content._id)}
              disabled={isCompletingLoading}
              variant={isCompleted ? "secondary" : "default"}
              size="sm"
              className={`shrink-0 gap-2 ${
                isCompleted
                  ? "bg-green-500/30 text-white hover:bg-green-500/40 border border-green-400/40"
                  : "bg-white/25 text-white hover:bg-white/35 border border-white/30"
              }`}
            >
              {isCompletingLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {isCompleted ? "Completed" : "Mark as Complete"}
            </Button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="p-6 lg:p-8">
        {/* Video — watermark wraps the video element directly */}
        {content.type === "video" && fileUrl && (
          <div className="max-w-5xl mx-auto">
            <ContentProtectionWrapper watermarkText={watermarkText}>
              <video
                ref={videoRef}
                controls
                controlsList="nodownload"
                disablePictureInPicture
                className="w-full rounded-2xl shadow-xl"
                onContextMenu={(e) => e.preventDefault()}
                onLoadedMetadata={handleVideoLoadedMetadata}
                onTimeUpdate={handleVideoTimeUpdate}
                onPause={handleVideoTimeUpdate}
              >
                <source src={fileUrl} type="video/mp4" />
                Your browser does not support video.
              </video>
            </ContentProtectionWrapper>
          </div>
        )}

        {/* YouTube — NO watermark, no protection wrapper needed */}
        {content.type === "youtube" && content.youtubeUrl && (
          <div className="max-w-5xl mx-auto">
            <YouTubePlayer videoUrl={content.youtubeUrl} />
          </div>
        )}

        {/* PDF — watermarked, fillHeight for flipbook */}
        {content.type === "pdf" && fileUrl && (
          <ContentProtectionWrapper watermarkText={watermarkText} fillHeight>
            <PdfFlipBook
              fileUrl={fileUrl}
              initialPage={contentProgress?.pdfPage}
              onPageChange={handlePdfPageChange}
            />
          </ContentProtectionWrapper>
        )}

        {/* PPT — watermark wraps the viewer directly */}
        {content.type === "ppt" && (content.fileUrl || content.videoUrl) && (
          <div className="max-w-5xl mx-auto">
            <ContentProtectionWrapper watermarkText={watermarkText}>
              <PptViewer storageKey={(content.fileUrl || content.videoUrl)!} title={content.title} />
            </ContentProtectionWrapper>
          </div>
        )}

        {/* Rich Text — watermark wraps the card directly */}
        {content.type === "text" && content.textContent && (
          <div className="max-w-4xl mx-auto">
            <ContentProtectionWrapper watermarkText={watermarkText}>
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 lg:p-12">
                <RichTextViewer content={content.textContent} />
              </div>
            </ContentProtectionWrapper>
          </div>
        )}

        {/* Quiz — watermark wraps the card directly */}
        {content.type === "quiz" && content.questions && content.questions.length > 0 && (
          <div className="max-w-4xl mx-auto">
            <ContentProtectionWrapper watermarkText={watermarkText}>
              <QuizViewer questions={content.questions} readOnly={false} />
            </ContentProtectionWrapper>
          </div>
        )}

        {/* Activity — watermarked */}
        {content.type === "activity" && fileUrl && (
          <ContentProtectionWrapper watermarkText={watermarkText}>
            <iframe
              src={`https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`}
              className="w-full h-[75vh] rounded-2xl shadow-xl border-0"
              title={content.title}
            />
          </ContentProtectionWrapper>
        )}

        {/* Fallback */}
        {!fileUrl && !content.youtubeUrl && !content.textContent && !(content.questions?.length) && (
          <div className="flex items-center justify-center h-64 bg-muted rounded-2xl">
            <p className="text-muted-foreground">No content available for this item.</p>
          </div>
        )}

        {/* Chapter completion banner */}
        {!isViewMode && isChapterComplete && (
          <div className="mt-8 max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-2">
                Chapter Complete!
              </h3>
              <p className="text-green-600 dark:text-green-400 mb-6">
                You have completed all items in this chapter.
              </p>
              <div className="flex items-center justify-center gap-3">
                {onBackToChapters && (
                  <Button variant="outline" onClick={onBackToChapters} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Chapters
                  </Button>
                )}
                {hasNextChapter && onContinueToNextChapter && (
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white gap-2"
                    onClick={onContinueToNextChapter}
                  >
                    Continue to Next Chapter
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
