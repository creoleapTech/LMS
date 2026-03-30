// src/pages/staff/StaffCurriculumViewer.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  ChevronRight,
  Home,
  Search,
  Video,
  FileText,
  FileDown,
  Activity,
  HelpCircle,
  Eye,
  Loader2,
} from "lucide-react";
import { Config } from "@/lib/config";

type ContentType = "video" | "ppt" | "pdf" | "activity" | "quiz";

interface CurriculumWithBooks {
  _id: string;
  name: string;
  level: string | string[];
  grades: number[];
  isPublished: boolean;
  gradeBooks: GradeBook[];
}

interface GradeBook {
  _id: string;
  grade: number;
  bookTitle: string;
  subtitle?: string;
  description?: string;
  coverImage?: string;
  isPublished: boolean;
}

interface Chapter {
  _id: string;
  title: string;
  chapterNumber: number;
  order: number;
  description?: string;
}

interface ContentItem {
  _id: string;
  title: string;
  type: ContentType;
  fileUrl?: string;
  videoUrl?: string;
  isFree: boolean;
  order: number;
}

export default function StaffCurriculumViewer() {
  const [selectedCurriculum, setSelectedCurriculum] = useState<CurriculumWithBooks | null>(null);
  const [selectedGradeBook, setSelectedGradeBook] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [viewingContent, setViewingContent] = useState<ContentItem | null>(null);
  const [search, setSearch] = useState("");

  // 1. Fetch accessible curriculums (only enabled books for this institution)
  const {
    data: curriculums = [],
    isLoading: loadingCurriculums,
    isError: curriculumError,
  } = useQuery<CurriculumWithBooks[]>({
    queryKey: ["staff-curriculum-access"],
    queryFn: async () => {
      const res = await _axios.get("/admin/filtered-curriculum");
      return res.data.data || [];
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    staleTime: 20000,
  });

  // Search filter
  const filteredCurriculums = curriculums.filter((c) =>
    search ? c.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  const gradeBooks = selectedCurriculum?.gradeBooks || [];

  // 2. Fetch Chapters for selected grade book
  const {
    data: chapters = [],
    isLoading: loadingChapters,
  } = useQuery<Chapter[]>({
    queryKey: ["chapters", selectedGradeBook],
    queryFn: async () => {
      const res = await _axios.get(`/admin/curriculum/gradebook/${selectedGradeBook}/chapters`);
      return res.data.data || [];
    },
    enabled: !!selectedGradeBook,
  });

  // 3. Fetch Content for selected chapter
  const {
    data: contents = [],
    isLoading: loadingContents,
  } = useQuery<ContentItem[]>({
    queryKey: ["chapter-content", selectedChapter],
    queryFn: async () => {
      const res = await _axios.get(`/admin/curriculum/chapter/${selectedChapter}/content`);
      return res.data.data || [];
    },
    enabled: !!selectedChapter,
  });

  const getContentTypeIcon = (type: ContentType) => {
    const icons: Record<ContentType, any> = {
      video: Video,
      ppt: FileText,
      pdf: FileDown,
      activity: Activity,
      quiz: HelpCircle,
    };
    const Icon = icons[type] || FileText;
    return <Icon className="h-5 w-5" />;
  };

  const getFileUrl = (item: ContentItem) => {
    const path = item.videoUrl || item.fileUrl || "";
    return path ? `${Config.imgUrl}${path}` : "";
  };

  const resetToHome = () => {
    setSelectedCurriculum(null);
    setSelectedGradeBook(null);
    setSelectedChapter(null);
    setViewingContent(null);
    setSearch("");
  };

  const Breadcrumb = () => (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6 overflow-x-auto whitespace-nowrap pb-1">
      <button onClick={resetToHome} className="hover:text-foreground flex items-center gap-1 shrink-0">
        <Home className="h-4 w-4" />
        Home
      </button>
      {selectedCurriculum && (
        <>
          <ChevronRight className="h-4 w-4" />
          <button
            onClick={() => {
              setSelectedGradeBook(null);
              setSelectedChapter(null);
              setViewingContent(null);
            }}
            className="hover:text-foreground"
          >
            {selectedCurriculum.name}
          </button>
        </>
      )}
      {selectedGradeBook && (
        <>
          <ChevronRight className="h-4 w-4" />
          <button
            onClick={() => {
              setSelectedChapter(null);
              setViewingContent(null);
            }}
            className="hover:text-foreground"
          >
            {gradeBooks.find((g) => g._id === selectedGradeBook)?.bookTitle}
          </button>
        </>
      )}
      {selectedChapter && (
        <>
          <ChevronRight className="h-4 w-4" />
          <button onClick={() => setViewingContent(null)} className="hover:text-foreground">
            {chapters.find((ch) => ch._id === selectedChapter)?.title}
          </button>
        </>
      )}
    </div>
  );

  // Content Viewer
  if (viewingContent) {
    const fileUrl = getFileUrl(viewingContent);

    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100/80 p-6">
        <div className="max-w-6xl mx-auto">
          <Breadcrumb />

          <Card className="overflow-hidden shadow-2xl rounded-2xl">
            <div className="bg-linear-to-r from-indigo-600 to-purple-600 p-8 text-white">
              <div className="flex items-center gap-4 mb-4">
                {getContentTypeIcon(viewingContent.type)}
                <Badge className="bg-white/20 text-white border-0 text-lg px-4 py-1">
                  {viewingContent.type.toUpperCase()}
                </Badge>
                {viewingContent.isFree && (
                  <Badge className="bg-green-500 text-white px-3 py-1">Free Preview</Badge>
                )}
              </div>
              <h1 className="text-3xl font-bold">{viewingContent.title}</h1>
            </div>

            <CardContent className="p-8">
              {viewingContent.type === "video" && fileUrl && (
                <video controls className="w-full max-w-5xl mx-auto rounded-2xl shadow-2xl">
                  <source src={fileUrl} type="video/mp4" />
                  Your browser does not support video.
                </video>
              )}

              {(viewingContent.type === "pdf" || viewingContent.type === "ppt" || viewingContent.type === "activity" || viewingContent.type === "quiz") && fileUrl && (
                <iframe
                  src={
                    viewingContent.type === "ppt" || viewingContent.type === "pdf"
                      ? `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`
                      : fileUrl
                  }
                  className="w-full h-[80vh] rounded-2xl shadow-2xl border-0"
                  title={viewingContent.title}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100/80 p-6">
      <div className="max-w-7xl mx-auto">
        <Breadcrumb />

        <div className="mb-10">
          <h1 className="text-4xl font-bold bg-linear-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
            My Teaching Resources
          </h1>
          <p className="text-lg text-muted-foreground">
            Access books, chapters, and materials assigned to your institution
          </p>
        </div>

        {/* Loading State */}
        {loadingCurriculums && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <Skeleton className="h-40 w-full rounded-t-lg" />
                <CardContent className="p-6">
                  <Skeleton className="h-8 w-3/4 mb-3" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Error State */}
        {curriculumError && (
          <Card className="p-12 text-center max-w-2xl mx-auto">
            <p className="text-red-600 text-lg">Failed to load resources. Please try again later.</p>
          </Card>
        )}

        {/* Empty State */}
        {!loadingCurriculums && curriculums.length === 0 && (
          <Card className="p-16 text-center max-w-2xl mx-auto">
            <BookOpen className="h-20 w-20 text-muted-foreground mx-auto mb-6" />
            <h3 className="text-2xl font-semibold mb-3">No Resources Available</h3>
            <p className="text-muted-foreground text-lg">
              Your institution has not been assigned any curriculum yet.
              <br />
              Please contact your administrator.
            </p>
          </Card>
        )}

        {/* Curriculum Grid */}
        {!loadingCurriculums && !selectedCurriculum && curriculums.length > 0 && (
          <>
            <div className="relative mb-8 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search curriculum..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCurriculums.map((curriculum) => (
                <Card
                  key={curriculum._id}
                  className="group hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden border-2 hover:border-indigo-400 rounded-2xl"
                  onClick={() => setSelectedCurriculum(curriculum)}
                >
                  <div className="h-40 bg-linear-to-br from-indigo-500 to-purple-600 relative">
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-all" />
                    <div className="absolute bottom-5 left-5 right-5 text-white">
                      <h3 className="text-2xl font-bold drop-shadow-lg">{curriculum.name}</h3>
                      <p className="text-sm opacity-90 mt-1">
                        {curriculum.gradeBooks.length} Book{curriculum.gradeBooks.length !== 1 ? "s" : ""} Available
                      </p>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <Badge variant="secondary" className="mb-2">
                      {Array.isArray(curriculum.level) ? curriculum.level.join(", ") : curriculum.level}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Grade Books Grid */}
        {selectedCurriculum && !selectedGradeBook && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {gradeBooks.map((book) => (
              <Card
                key={book._id}
                className="group hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden rounded-2xl border-slate-200/80"
                onClick={() => setSelectedGradeBook(book._id)}
              >
                <div className="h-48 bg-linear-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 relative">
                  {book.coverImage ? (
                    <img
                      src={`${Config.imgUrl}${book.coverImage}`}
                      alt={book.bookTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <BookOpen className="h-20 w-20 text-slate-300 dark:text-slate-700" />
                    </div>
                  )}
                  <Badge className="absolute top-3 left-3 bg-white/95 text-gray-900">
                    Class {book.grade}
                  </Badge>
                </div>
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                    {book.bookTitle}
                  </h3>
                  {book.subtitle && (
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                      {book.subtitle}
                    </p>
                  )}
                  {book.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {book.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Chapters List */}
        {selectedGradeBook && !selectedChapter && (
          <div className="space-y-6">
            {loadingChapters ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : chapters.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">No chapters available for this book.</p>
              </Card>
            ) : (
              chapters.map((chapter) => (
                <Card
                  key={chapter._id}
                  className="group hover:shadow-lg transition-all duration-300 cursor-pointer rounded-2xl border-slate-200/80"
                  onClick={() => setSelectedChapter(chapter._id)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-5">
                      <div className="w-14 h-14 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <span className="text-2xl font-bold text-white">{chapter.chapterNumber}</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-2 group-hover:text-blue-600 transition-colors">
                          {chapter.title}
                        </h3>
                        {chapter.description && (
                          <p className="text-muted-foreground line-clamp-2">
                            {chapter.description}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-7 w-7 text-muted-foreground group-hover:text-blue-600 group-hover:translate-x-2 transition-all" />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Content List */}
        {selectedChapter && !viewingContent && (
          <div className="space-y-6">
            {loadingContents ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : contents.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">No content available for this chapter.</p>
              </Card>
            ) : (
              contents.map((item) => (
                <Card
                  key={item._id}
                  className="group hover:shadow-lg transition-all duration-300 cursor-pointer rounded-2xl border-slate-200/80"
                  onClick={() => setViewingContent(item)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-5">
                      <div className="p-4 bg-indigo-100 dark:bg-blue-900 rounded-xl group-hover:scale-110 transition-transform">
                        {getContentTypeIcon(item.type)}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-bold mb-2 group-hover:text-blue-600 transition-colors">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="uppercase">
                            {item.type}
                          </Badge>
                          {item.isFree && (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                              Free Preview
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="gap-2">
                        <Eye className="h-5 w-5" />
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}