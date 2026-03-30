// src/pages/staff/StaffCurriculumViewer.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, ChevronRight, Home, Search } from "lucide-react";
import { Config } from "@/lib/config";
import { CourseraLayout } from "./CourseraLayout";
import { useAuthStore } from "@/store/userAuthStore";

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

export default function StaffCurriculumViewer() {
  const [selectedCurriculum, setSelectedCurriculum] = useState<CurriculumWithBooks | null>(null);
  const [selectedGradeBook, setSelectedGradeBook] = useState<GradeBook | null>(null);
  const [search, setSearch] = useState("");
  const { user } = useAuthStore();

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

  const filteredCurriculums = curriculums.filter((c) =>
    search ? c.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  const gradeBooks = selectedCurriculum?.gradeBooks || [];

  // Once a grade book is selected, switch to Coursera layout
  if (selectedGradeBook && selectedCurriculum) {
    return (
      <CourseraLayout
        gradeBookId={selectedGradeBook._id}
        gradeBookTitle={selectedGradeBook.bookTitle}
        curriculumName={selectedCurriculum.name}
        userEmail={user?.email}
        onBack={() => setSelectedGradeBook(null)}
      />
    );
  }

  const Breadcrumb = () => (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6 overflow-x-auto whitespace-nowrap pb-1">
      <button
        onClick={() => {
          setSelectedCurriculum(null);
          setSelectedGradeBook(null);
          setSearch("");
        }}
        className="hover:text-foreground flex items-center gap-1 shrink-0"
      >
        <Home className="h-4 w-4" />
        Home
      </button>
      {selectedCurriculum && (
        <>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">{selectedCurriculum.name}</span>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100/80 p-6">
      <div className="max-w-7xl mx-auto">
        <Breadcrumb />

        <div className="mb-10">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
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
                  <div className="h-40 bg-gradient-to-br from-indigo-500 to-purple-600 relative">
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
                onClick={() => setSelectedGradeBook(book)}
              >
                <div className="h-48 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 relative">
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
      </div>
    </div>
  );
}
