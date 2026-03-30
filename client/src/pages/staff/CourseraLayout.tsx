import { useState, useEffect } from "react";
import { CourseSidebar } from "./CourseSidebar";
import { ContentViewer } from "./ContentViewer";
import { Button } from "@/components/ui/button";
import { ChevronLeft, BookOpen } from "lucide-react";
import { useTeachingProgress } from "@/hooks/useTeachingProgress";
import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";

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

interface CourseraLayoutProps {
  gradeBookId: string;
  gradeBookTitle: string;
  curriculumName: string;
  classId: string;
  classLabel: string;
  userEmail?: string;
  onBack: () => void;
}

export function CourseraLayout({
  gradeBookId,
  gradeBookTitle,
  curriculumName,
  classId,
  classLabel,
  userEmail,
  onBack,
}: CourseraLayoutProps) {
  const [activeContent, setActiveContent] = useState<ContentItem | null>(null);
  const [activeChapter, setActiveChapter] = useState<ChapterWithContent | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  const {
    completedContentIds,
    progressByContentId,
    lastAccessedContentId,
    completeMutation,
    updateMutation,
  } = useTeachingProgress(classId, gradeBookId);

  // Fetch full chapters to enable auto-select
  const { data: chapters = [] } = useQuery<ChapterWithContent[]>({
    queryKey: ["gradebook-full", gradeBookId],
    queryFn: async () => {
      const res = await _axios.get(`/admin/curriculum-reader/gradebook/${gradeBookId}/full`);
      return res.data.data || [];
    },
    enabled: !!gradeBookId,
  });

  // Auto-select last accessed content on mount
  useEffect(() => {
    if (hasAutoSelected || !lastAccessedContentId || chapters.length === 0) return;

    for (const chapter of chapters) {
      const content = chapter.content.find((c) => c._id === lastAccessedContentId);
      if (content) {
        setActiveContent(content);
        setActiveChapter(chapter);
        setHasAutoSelected(true);
        break;
      }
    }
  }, [lastAccessedContentId, chapters, hasAutoSelected]);

  const handleContentSelect = (content: ContentItem, chapter: ChapterWithContent) => {
    setActiveContent(content);
    setActiveChapter(chapter);
  };

  const handleMarkComplete = async (contentId: string) => {
    await completeMutation.mutateAsync(contentId);
  };

  const handleProgressUpdate = async (
    contentId: string,
    data: { videoTimestamp?: number; pdfPage?: number }
  ) => {
    updateMutation.mutate({ contentId, data });
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <div className="h-14 bg-white dark:bg-slate-900 border-b flex items-center px-4 gap-3 shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="w-px h-6 bg-border" />
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground truncate">{curriculumName}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium truncate">{gradeBookTitle}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-semibold text-indigo-600 truncate">{classLabel}</span>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <CourseSidebar
          gradeBookId={gradeBookId}
          activeContentId={activeContent?._id || null}
          onContentSelect={handleContentSelect}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          completedContentIds={completedContentIds}
          progressByContentId={progressByContentId}
        />

        {/* Content viewer or empty state */}
        {activeContent && activeChapter ? (
          <ContentViewer
            content={activeContent}
            chapterNumber={activeChapter.chapterNumber}
            watermarkText={userEmail}
            classId={classId}
            gradeBookId={gradeBookId}
            isCompleted={completedContentIds.has(activeContent._id)}
            contentProgress={progressByContentId.get(activeContent._id)}
            onMarkComplete={handleMarkComplete}
            onProgressUpdate={handleProgressUpdate}
            isCompletingLoading={completeMutation.isPending}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <BookOpen className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-muted-foreground mb-2">
                Select a lesson to get started
              </h3>
              <p className="text-sm text-muted-foreground">
                Choose a chapter and content item from the sidebar
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
