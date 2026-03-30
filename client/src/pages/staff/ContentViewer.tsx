import { useRef, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Config } from "@/lib/config";
import { ContentProtectionWrapper } from "@/components/protection/ContentProtectionWrapper";
import { YouTubePlayer } from "@/components/viewers/YouTubePlayer";
import { PdfFlipBook } from "@/components/viewers/PdfFlipBook";
import { RichTextViewer } from "@/components/editors/RichTextViewer";
import { QuizViewer } from "@/components/quiz/QuizViewer";
import { useContentAutoSave } from "@/hooks/useContentAutoSave";
import type { ContentProgressEntry } from "@/hooks/useTeachingProgress";
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
  onProgressUpdate,
  isCompletingLoading,
}: ContentViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasSetInitialTime = useRef(false);

  const { save: autoSave } = useContentAutoSave(classId, gradeBookId, content._id);

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
          <Badge className="bg-white/20 text-white border-0 px-3 py-0.5">
            {typeLabels[content.type] || content.type.toUpperCase()}
          </Badge>
          <Badge className="bg-white/10 text-white border-0 px-2 py-0.5 font-mono text-xs">
            {displayNum}
          </Badge>
          {content.isFree && (
            <Badge className="bg-green-500/80 text-white border-0">Free Preview</Badge>
          )}
        </div>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl lg:text-3xl font-bold">{content.title}</h1>

          {/* Mark as Complete Button */}
          <Button
            onClick={() => onMarkComplete(content._id)}
            disabled={isCompletingLoading}
            variant={isCompleted ? "secondary" : "default"}
            size="sm"
            className={`shrink-0 gap-2 ${
              isCompleted
                ? "bg-green-500/20 text-green-100 hover:bg-green-500/30 border border-green-400/30"
                : "bg-white/20 text-white hover:bg-white/30 border border-white/20"
            }`}
          >
            {isCompletingLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {isCompleted ? "Completed" : "Mark as Complete"}
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="p-6 lg:p-8">
        <ContentProtectionWrapper watermarkText={watermarkText}>
          {/* Video */}
          {content.type === "video" && fileUrl && (
            <video
              ref={videoRef}
              controls
              controlsList="nodownload"
              disablePictureInPicture
              className="w-full max-w-5xl mx-auto rounded-2xl shadow-xl"
              onContextMenu={(e) => e.preventDefault()}
              onLoadedMetadata={handleVideoLoadedMetadata}
              onTimeUpdate={handleVideoTimeUpdate}
              onPause={handleVideoTimeUpdate}
            >
              <source src={fileUrl} type="video/mp4" />
              Your browser does not support video.
            </video>
          )}

          {/* YouTube */}
          {content.type === "youtube" && content.youtubeUrl && (
            <div className="max-w-5xl mx-auto">
              <YouTubePlayer videoUrl={content.youtubeUrl} />
            </div>
          )}

          {/* PDF — Flip Book */}
          {content.type === "pdf" && fileUrl && (
            <div className="max-w-5xl mx-auto">
              <PdfFlipBook
                fileUrl={fileUrl}
                watermarkText={watermarkText}
                initialPage={contentProgress?.pdfPage}
                onPageChange={handlePdfPageChange}
              />
            </div>
          )}

          {/* PPT — Google Docs Viewer */}
          {content.type === "ppt" && fileUrl && (
            <iframe
              src={`https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`}
              className="w-full h-[75vh] rounded-2xl shadow-xl border-0"
              title={content.title}
            />
          )}

          {/* Rich Text */}
          {content.type === "text" && content.textContent && (
            <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 lg:p-12">
              <RichTextViewer content={content.textContent} />
            </div>
          )}

          {/* Quiz */}
          {content.type === "quiz" && content.questions && content.questions.length > 0 && (
            <div className="max-w-4xl mx-auto">
              <QuizViewer questions={content.questions} readOnly={false} />
            </div>
          )}

          {/* Activity */}
          {content.type === "activity" && fileUrl && (
            <iframe
              src={`https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`}
              className="w-full h-[75vh] rounded-2xl shadow-xl border-0"
              title={content.title}
            />
          )}

          {/* Fallback */}
          {!fileUrl && !content.youtubeUrl && !content.textContent && !(content.questions?.length) && (
            <div className="flex items-center justify-center h-64 bg-muted rounded-2xl">
              <p className="text-muted-foreground">No content available for this item.</p>
            </div>
          )}
        </ContentProtectionWrapper>
      </div>
    </div>
  );
}
