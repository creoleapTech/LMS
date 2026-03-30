import { useState } from "react";
import { CourseSidebar } from "./CourseSidebar";
import { ContentViewer } from "./ContentViewer";
import { Button } from "@/components/ui/button";
import { ChevronLeft, BookOpen } from "lucide-react";

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
  userEmail?: string;
  onBack: () => void;
}

export function CourseraLayout({
  gradeBookId,
  gradeBookTitle,
  curriculumName,
  userEmail,
  onBack,
}: CourseraLayoutProps) {
  const [activeContent, setActiveContent] = useState<ContentItem | null>(null);
  const [activeChapter, setActiveChapter] = useState<ChapterWithContent | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleContentSelect = (content: ContentItem, chapter: ChapterWithContent) => {
    setActiveContent(content);
    setActiveChapter(chapter);
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
        />

        {/* Content viewer or empty state */}
        {activeContent && activeChapter ? (
          <ContentViewer
            content={activeContent}
            chapterNumber={activeChapter.chapterNumber}
            watermarkText={userEmail}
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
