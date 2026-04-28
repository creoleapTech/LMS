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
  Eye,
} from "lucide-react";
import { CourseraLayout } from "./CourseraLayout";
import { useAuthStore } from "@/store/userAuthStore";
import { Config } from "@/lib/config";
import type { TeachingMode } from "./types";

interface CurriculumWithBooks {
  _id: string;
  name: string;
  level: string | string[];
  grades: number[];
  isPublished: boolean;
  thumbnail?: string;
  banner?: string;
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
  coverImage?: string;
  sections: SectionInfo[];
}

interface SelectedClassSection {
  classId: string;
  section: string;
  gradeBookId: string;
  gradeBookTitle: string;
  grade: string;
}

interface StaffCurriculumViewerProps {
  resumeGradeBookId?: string;
  resumeClassId?: string;
  resumeBookTitle?: string;
}

export default function StaffCurriculumViewer({ resumeGradeBookId, resumeClassId, resumeBookTitle }: StaffCurriculumViewerProps) {
  const [selectedCurriculum, setSelectedCurriculum] =
    useState<CurriculumWithBooks | null>(null);
  const [selectedClassSection, setSelectedClassSection] =
    useState<SelectedClassSection | null>(() => {
      if (resumeGradeBookId && resumeClassId) {
        return {
          classId: resumeClassId,
          gradeBookId: resumeGradeBookId,
          gradeBookTitle: resumeBookTitle || '',
          section: '',
          grade: '',
        };
      }
      return null;
    });
  const [search, setSearch] = useState("");
  const [teachingMode, setTeachingMode] = useState<TeachingMode>("teach");
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
  if (selectedClassSection && (selectedCurriculum || resumeGradeBookId)) {
    return (
      <CourseraLayout
        gradeBookId={selectedClassSection.gradeBookId}
        gradeBookTitle={selectedClassSection.gradeBookTitle}
        curriculumName={selectedCurriculum?.name || ''}
        classId={selectedClassSection.classId}
        classLabel={selectedClassSection.grade && selectedClassSection.section ? `Class ${selectedClassSection.grade} - Section ${selectedClassSection.section}` : ''}
        userEmail={user?.email}
        mode={teachingMode}
        onBack={() => setSelectedClassSection(null)}
        onBackToCurriculumList={() => {
          setSelectedClassSection(null);
          setSelectedCurriculum(null);
        }}
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
    <div className="min-h-screen p-6">
      <div className="max-w-screen-2xl mx-auto">
        <Breadcrumb />

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

              <div className="flex flex-wrap  gap-8">
                {filteredCurriculums.map((curriculum) => (
                  <Card
                    key={curriculum._id}
                    className="group w-64 p-0 m-0 relative neo-card-hover transition-all duration-300 cursor-pointer overflow-hidden border-2 hover:border-indigo-400 rounded-2xl"
                    onClick={() => setSelectedCurriculum(curriculum)}
                  >
                    <Badge variant="secondary" className="right-0 absolute mb-2">
                      {Array.isArray(curriculum.level)
                        ? curriculum.level.join(", ")
                        : curriculum.level}
                    </Badge>
                    {/* Image Section */}
                    <div className="h-full relative overflow-hidden">

                      {/* Book Cover Image */}
                      {curriculum.banner || curriculum.thumbnail ? (
                        <img
                          src={`${Config.imgUrl}${curriculum.banner || curriculum.thumbnail}`}
                          alt="Curriculum Cover"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                          <BookOpen className="h-16 w-16 text-white/80" />
                        </div>
                      )}

                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

                      {/* Text */}
                      <div className="absolute bottom-4 left-4 right-4 text-white">
                        <h3 className="text-xl font-bold drop-shadow-lg">
                          {curriculum.name}
                        </h3>
                        <p className="text-sm font-medium mt-1">
                          {curriculum.gradeBooks.length} Book
                          {curriculum.gradeBooks.length !== 1 ? "s" : ""} Available
                        </p>
                      </div>
                    </div>


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
                    <div className="flex flex-wrap gap-4">
                      {group.sections.map((section) => (
                        <Card
                          key={section.classId}
                          className="group relative w-64 gap-0 p-0 m-0 overflow-hidden rounded-2xl border-2 hover:border-indigo-400 transition-all duration-300 hover:-translate-y-1 neo-card-hover"
                        >
                          {/* Book Cover Image */}
                          <div className="h-full w-full overflow-hidden">
                            {group.coverImage ? (
                              <img
                                src={`${Config.imgUrl}${group.coverImage}`}
                                alt="Book Cover"
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                                <BookOpen className="h-12 w-12 text-white/80" />
                              </div>
                            )}
                          </div>

                          {/* Hover overlay with View / Teach buttons */}
                          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-4 z-10">
                            <button
                              onClick={() => {
                                setTeachingMode("view");
                                setSelectedClassSection({
                                  classId: section.classId,
                                  section: section.section,
                                  gradeBookId: group.gradeBookId,
                                  gradeBookTitle: group.gradeBookTitle,
                                  grade: group.grade,
                                });
                              }}
                              className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl bg-white/90 hover:bg-white text-slate-700 hover:text-blue-700 transition-all shadow-lg hover:shadow-xl hover:scale-105"
                              title="View Only (no progress tracking)"
                            >
                              <Eye className="h-5 w-5" />
                              <span className="text-sm font-semibold">View</span>
                            </button>
                            <button
                              onClick={() => {
                                setTeachingMode("teach");
                                setSelectedClassSection({
                                  classId: section.classId,
                                  section: section.section,
                                  gradeBookId: group.gradeBookId,
                                  gradeBookTitle: group.gradeBookTitle,
                                  grade: group.grade,
                                });
                              }}
                              className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-lg hover:shadow-xl hover:scale-105"
                              title="Teach (progress will be tracked)"
                            >
                              <GraduationCap className="h-5 w-5" />
                              <span className="text-sm font-semibold">Teach</span>
                            </button>
                          </div>

                          {/* Details Section */}
                          <CardContent className="text-center py-2">
                            <h3 className="font-semibold text-sm text-foreground mb-1">
                              Section {section.section}
                            </h3>

                            <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground mb-3">
                              <Users className="h-4 w-4" />
                              <span>
                                {section.studentCount} Student
                                {section.studentCount !== 1 ? "s" : ""}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <Progress
                                value={section.progressPercentage}
                                className="h-2"
                              />
                              <p className="text-sm text-muted-foreground">
                                {section.progressPercentage}% complete
                              </p>
                            </div>
                          </CardContent>
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
