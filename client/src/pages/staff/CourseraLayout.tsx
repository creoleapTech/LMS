import { useState, useEffect, useRef } from "react";
import { ChapterListView } from "./ChapterListView";
import { CourseSidebar } from "./CourseSidebar";
import { ContentViewer } from "./ContentViewer";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, BookOpen, Loader2, Eye, GraduationCap } from "lucide-react";
import { useTeachingProgress } from "@/hooks/useTeachingProgress";
import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
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
  thumbnail?: string | null;
  content: ContentItem[];
}

interface CourseraLayoutProps {
  gradeBookId: string;
  gradeBookTitle: string;
  curriculumName: string;
  classId: string;
  classLabel: string;
  userEmail?: string;
  mode: TeachingMode;
  onBack: () => void;
  onBackToCurriculumList: () => void;
}

export function CourseraLayout({
  gradeBookId,
  gradeBookTitle,
  curriculumName,
  classId,
  classLabel,
  mode,
  onBack,
  onBackToCurriculumList,
}: CourseraLayoutProps) {
  const [currentView, setCurrentView] = useState<"chapter-list" | "chapter-detail">("chapter-list");
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number | null>(null);
  const [activeContent, setActiveContent] = useState<ContentItem | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  const {
    completedContentIds,
    progressByContentId,
    lastAccessedContentId,
    completeMutation,
    updateMutation,
  } = useTeachingProgress(classId, gradeBookId);

  // Auto session tracking — start on mount in teach mode, end on unmount
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== "teach") return;

    let ended = false;

    const startSession = async () => {
      try {
        const res = await _axios.post("/admin/class-session/start", { classId });
        sessionIdRef.current = res.data?.data?.id || null;
      } catch {
        // Non-critical — don't block teaching if session tracking fails
      }
    };

    const endSession = async () => {
      if (!sessionIdRef.current || ended) return;
      ended = true;
      try {
        await _axios.patch(`/admin/class-session/${sessionIdRef.current}/end`, {
          remarks: "",
          topicsCovered: [],
        });
      } catch {
        // Non-critical
      }
    };

    startSession();

    return () => {
      endSession();
    };
  }, [classId, mode]);

  const { data: chapters = [], isLoading } = useQuery<ChapterWithContent[]>({
    queryKey: ["gradebook-full", gradeBookId],
    queryFn: async () => {
      const res = await _axios.get(`/admin/curriculum-reader/gradebook/${gradeBookId}/full`);
      return res.data.data || [];
    },
    enabled: !!gradeBookId,
  });

  // Derived state
  const selectedChapter = selectedChapterIndex !== null ? chapters[selectedChapterIndex] : null;
  const isChapterComplete = selectedChapter
    ? selectedChapter.content.length > 0 &&
      selectedChapter.content.every((c) => completedContentIds.has(c._id))
    : false;
  const hasNextChapter = selectedChapterIndex !== null && selectedChapterIndex < chapters.length - 1;
  const isViewMode = mode === "view";

  // Auto-select last accessed content on mount (teach mode only)
  useEffect(() => {
    if (isViewMode || hasAutoSelected || !lastAccessedContentId || chapters.length === 0) return;

    for (let i = 0; i < chapters.length; i++) {
      const content = chapters[i].content.find((c) => c._id === lastAccessedContentId);
      if (content) {
        setSelectedChapterIndex(i);
        setActiveContent(content);
        setCurrentView("chapter-detail");
        setHasAutoSelected(true);
        break;
      }
    }
  }, [lastAccessedContentId, chapters, hasAutoSelected, isViewMode]);

  const handleSelectChapter = (chapterIndex: number) => {
    setSelectedChapterIndex(chapterIndex);
    setActiveContent(null);
    setCurrentView("chapter-detail");
  };

  const handleBackToChapters = () => {
    setCurrentView("chapter-list");
    setSelectedChapterIndex(null);
    setActiveContent(null);
  };

  const handleContinueToNextChapter = () => {
    if (hasNextChapter && selectedChapterIndex !== null) {
      setSelectedChapterIndex(selectedChapterIndex + 1);
      setActiveContent(null);
    }
  };

  const handleContentSelect = (content: ContentItem) => {
    setActiveContent(content);
  };

  const handleMarkComplete = async (contentId: string) => {
    if (isViewMode) return;
    await completeMutation.mutateAsync(contentId);
  };

  const handleProgressUpdate = (
    contentId: string,
    data: { videoTimestamp?: number; pdfPage?: number }
  ) => {
    if (isViewMode) return;
    updateMutation.mutate({ contentId, data });
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <div className="h-14 neo-glass border-b-0 flex items-center px-4 gap-3 shrink-0">
        <button
          onClick={currentView === "chapter-list" ? onBack : handleBackToChapters}
          className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all shrink-0"
          title="Go back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="w-px h-6 bg-border" />
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
          <button
            onClick={onBackToCurriculumList}
            className="text-sm text-muted-foreground truncate hover:text-foreground hover:underline transition-colors"
          >
            {curriculumName}
          </button>
          <span className="text-muted-foreground">/</span>
          <button
            onClick={onBack}
            className="text-sm font-medium truncate hover:text-indigo-600 hover:underline transition-colors"
          >
            {gradeBookTitle}
          </button>
          <span className="text-muted-foreground">/</span>
          {currentView === "chapter-detail" && selectedChapter ? (
            <>
              <button
                onClick={handleBackToChapters}
                className="text-sm font-semibold text-indigo-600 truncate hover:text-indigo-800 hover:underline transition-colors"
              >
                {classLabel}
              </button>
              <Badge className={isViewMode
                ? "bg-blue-100 text-blue-700 border-blue-200 gap-1.5"
                : "bg-green-100 text-green-700 border-green-200 gap-1.5"
              }>
                {isViewMode ? (
                  <><Eye className="h-4 w-4" /> View Only</>
                ) : (
                  <><GraduationCap className="h-4 w-4" /> Teaching</>
                )}
              </Badge>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium text-purple-600 truncate">
                Ch. {selectedChapter.chapterNumber}: {selectedChapter.title}
              </span>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold text-indigo-600 truncate">{classLabel}</span>
              <Badge className={isViewMode
                ? "bg-blue-100 text-blue-700 border-blue-200 gap-1.5"
                : "bg-green-100 text-green-700 border-green-200 gap-1.5"
              }>
                {isViewMode ? (
                  <><Eye className="h-4 w-4" /> View Only</>
                ) : (
                  <><GraduationCap className="h-4 w-4" /> Teaching</>
                )}
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* Main area */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : currentView === "chapter-list" ? (
        <ChapterListView
          chapters={chapters}
          completedContentIds={completedContentIds}
          onSelectChapter={handleSelectChapter}
          mode={mode}
        />
      ) : selectedChapter && selectedChapterIndex !== null ? (
        <div className="flex-1 flex overflow-hidden">
          <CourseSidebar
            chapter={selectedChapter}
            chapterIndex={selectedChapterIndex}
            totalChapters={chapters.length}
            activeContentId={activeContent?._id || null}
            onContentSelect={handleContentSelect}
            onBackToChapters={handleBackToChapters}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            completedContentIds={completedContentIds}
            progressByContentId={progressByContentId}
            mode={mode}
          />

          {activeContent ? (
            <ContentViewer
              content={activeContent}
              chapterNumber={selectedChapter.chapterNumber}
              watermarkText={"www.creoleap.com"}
              classId={classId}
              gradeBookId={gradeBookId}
              isCompleted={completedContentIds.has(activeContent._id)}
              contentProgress={progressByContentId.get(activeContent._id)}
              onMarkComplete={handleMarkComplete}
              onProgressUpdate={handleProgressUpdate}
              isCompletingLoading={completeMutation.isPending}
              isChapterComplete={isChapterComplete}
              hasNextChapter={hasNextChapter}
              onContinueToNextChapter={handleContinueToNextChapter}
              onBackToChapters={handleBackToChapters}
              mode={mode}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-muted-foreground mb-2">
                  Select a lesson to get started
                </h3>
                <p className="text-sm text-muted-foreground">
                  Choose a content item from the sidebar
                </p>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
