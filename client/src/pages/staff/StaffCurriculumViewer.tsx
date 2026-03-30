// src/pages/staff/StaffCurriculumViewer.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  ChevronRight,
  Home,
  Search,
  Users,
  GraduationCap,
} from "lucide-react";
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

interface SectionInfo {
  classId: string;
  section: string;
  studentCount: number;
  progressPercentage: number;
}

interface GradeGroup {
  grade: string;
  gradeBookId: string;
  gradeBookTitle: string;
  sections: SectionInfo[];
}

interface SelectedClassSection {
  classId: string;
  section: string;
  gradeBookId: string;
  gradeBookTitle: string;
  grade: string;
}

export default function StaffCurriculumViewer() {
  const [selectedCurriculum, setSelectedCurriculum] =
    useState<CurriculumWithBooks | null>(null);
  const [selectedClassSection, setSelectedClassSection] =
    useState<SelectedClassSection | null>(null);
  const [search, setSearch] = useState("");
  const { user } = useAuthStore();

  // Fetch curricula
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

  // Fetch classes/sections when a curriculum is selected
  const {
    data: gradeGroups = [],
    isLoading: loadingClasses,
    isError: classesError,
  } = useQuery<GradeGroup[]>({
    queryKey: ["teaching-classes", selectedCurriculum?._id],
    queryFn: async () => {
      const res = await _axios.get(
        `/admin/teaching-progress/classes/${selectedCurriculum!._id}`
      );
      return res.data.data || [];
    },
    enabled: !!selectedCurriculum,
    staleTime: 20000,
  });

  const filteredCurriculums = curriculums.filter((c) =>
    search ? c.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  // Once a class section is selected, switch to Coursera layout
  if (selectedClassSection && selectedCurriculum) {
    return (
      <CourseraLayout
        gradeBookId={selectedClassSection.gradeBookId}
        gradeBookTitle={selectedClassSection.gradeBookTitle}
        curriculumName={selectedCurriculum.name}
        classId={selectedClassSection.classId}
        classLabel={`Class ${selectedClassSection.grade} - Section ${selectedClassSection.section}`}
        userEmail={user?.email}
        onBack={() => setSelectedClassSection(null)}
      />
    );
  }

  const Breadcrumb = () => (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6 overflow-x-auto whitespace-nowrap pb-1">
      <button
        onClick={() => {
          setSelectedCurriculum(null);
          setSelectedClassSection(null);
          setSearch("");
        }}
        className="hover:text-foreground flex items-center gap-1 shrink-0"
      >
        <Home className="h-4 w-4" />
        Home
      </button>
      {selectedCurriculum && (
        <>
          <ChevronRight className="h-4 w-4 shrink-0" />
          <button
            onClick={() => setSelectedClassSection(null)}
            className="hover:text-foreground font-medium text-foreground shrink-0"
          >
            {selectedCurriculum.name}
          </button>
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
            {selectedCurriculum
              ? "Select a class and section to start teaching"
              : "Access books, chapters, and materials assigned to your institution"}
          </p>
        </div>

        {/* Loading State */}
        {(loadingCurriculums || (selectedCurriculum && loadingClasses)) && (
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
        {(curriculumError || classesError) && (
          <Card className="p-12 text-center max-w-2xl mx-auto">
            <p className="text-red-600 text-lg">
              Failed to load resources. Please try again later.
            </p>
          </Card>
        )}

        {/* Empty State - No Curricula */}
        {!loadingCurriculums &&
          !selectedCurriculum &&
          curriculums.length === 0 && (
            <Card className="p-16 text-center max-w-2xl mx-auto">
              <BookOpen className="h-20 w-20 text-muted-foreground mx-auto mb-6" />
              <h3 className="text-2xl font-semibold mb-3">
                No Resources Available
              </h3>
              <p className="text-muted-foreground text-lg">
                Your institution has not been assigned any curriculum yet.
                <br />
                Please contact your administrator.
              </p>
            </Card>
          )}

        {/* Curriculum Grid */}
        {!loadingCurriculums &&
          !selectedCurriculum &&
          curriculums.length > 0 && (
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
                        <h3 className="text-2xl font-bold drop-shadow-lg">
                          {curriculum.name}
                        </h3>
                        <p className="text-sm opacity-90 mt-1">
                          {curriculum.gradeBooks.length} Book
                          {curriculum.gradeBooks.length !== 1 ? "s" : ""}{" "}
                          Available
                        </p>
                      </div>
                    </div>
                    <CardContent className="p-6">
                      <Badge variant="secondary" className="mb-2">
                        {Array.isArray(curriculum.level)
                          ? curriculum.level.join(", ")
                          : curriculum.level}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

        {/* Classes & Sections Grid */}
        {selectedCurriculum && !loadingClasses && !classesError && (
          <>
            {gradeGroups.length === 0 ? (
              <Card className="p-16 text-center max-w-2xl mx-auto">
                <GraduationCap className="h-20 w-20 text-muted-foreground mx-auto mb-6" />
                <h3 className="text-2xl font-semibold mb-3">
                  No Classes Available
                </h3>
                <p className="text-muted-foreground text-lg">
                  No classes have been set up for this curriculum yet.
                  <br />
                  Please contact your administrator.
                </p>
              </Card>
            ) : (
              <div className="space-y-8">
                {gradeGroups.map((group) => (
                  <div key={group.grade}>
                    {/* Grade Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                        <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                          {group.grade}
                        </span>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">
                          Class {group.grade}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {group.gradeBookTitle} &middot;{" "}
                          {group.sections.length} Section
                          {group.sections.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    {/* Section Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {group.sections.map((section) => (
                        <Card
                          key={section.classId}
                          className="group hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden rounded-xl border-2 hover:border-indigo-400"
                          onClick={() =>
                            setSelectedClassSection({
                              classId: section.classId,
                              section: section.section,
                              gradeBookId: group.gradeBookId,
                              gradeBookTitle: group.gradeBookTitle,
                              grade: group.grade,
                            })
                          }
                        >
                          <div className="p-4 text-center">
                            {/* Section Letter */}
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                              <span className="text-2xl font-bold text-white">
                                {section.section}
                              </span>
                            </div>

                            <h3 className="font-semibold text-sm mb-1">
                              Section {section.section}
                            </h3>

                            {/* Student count */}
                            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-3">
                              <Users className="h-3 w-3" />
                              <span>
                                {section.studentCount} Student
                                {section.studentCount !== 1 ? "s" : ""}
                              </span>
                            </div>

                            {/* Progress bar */}
                            <div className="space-y-1">
                              <Progress
                                value={section.progressPercentage}
                                className="h-1.5"
                              />
                              <p className="text-xs text-muted-foreground">
                                {section.progressPercentage}% complete
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
