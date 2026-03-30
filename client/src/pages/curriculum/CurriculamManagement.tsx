// app/admin/curriculum/page.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, BookOpen, GraduationCap, FileText, Layers, Book, List } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChapterContentManager } from "./ChapterContentManager";
import { ChapterManager } from "./ChapterManager";
import { CurriculumTable } from "./CurriculumTable";
import { GradeBookManager } from "./GradeBookManager";
import { AllGradeBooksTable } from "./AllGradeBooksTable";
import { AllChaptersTable } from "./AllChaptersTable";

export default function CurriculumManagementPage() {
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<string | null>(null);
  const [selectedGradeBookId, setSelectedGradeBookId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedChapterNumber, setSelectedChapterNumber] = useState<number>(1);

  const handleBack = () => {
    if (selectedChapterId) {
      setSelectedChapterId(null);
    } else if (selectedGradeBookId) {
      setSelectedGradeBookId(null);
    } else if (selectedCurriculumId) {
      setSelectedCurriculumId(null);
    }
  };

  const breadcrumb = () => {
    if (!selectedCurriculumId) return "Curriculum Management";
    if (!selectedGradeBookId) return "Grade Books";
    if (!selectedChapterId) return "Chapters";
    return "Chapter Content";
  };

  // Drill-down view component
  const DrillDownView = () => (
    <div className="space-y-8">
      {/* Header for Drill-down */}
      <div className="flex items-center gap-4 mb-4">
        {(selectedCurriculumId || selectedGradeBookId || selectedChapterId) && (
          <Button onClick={handleBack} variant="ghost" size="sm" className="rounded-xl">
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back
          </Button>
        )}
        <h2 className="text-xl font-bold text-foreground">
          {breadcrumb()}
        </h2>
      </div>

      {/* Step 1: Curriculum List */}
      {!selectedCurriculumId && (
        <Card className="border border-slate-200/80 rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-3">
              <div className="p-1.5 bg-blue-50 rounded-lg">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
              Curriculums
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CurriculumTable onSelectCurriculum={setSelectedCurriculumId} />
          </CardContent>
        </Card>
      )}

      {/* Step 2: Grade Books */}
      {selectedCurriculumId && !selectedGradeBookId && (
        <Card className="border border-slate-200/80 rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-3">
              <div className="p-1.5 bg-blue-50 rounded-lg">
                <GraduationCap className="h-5 w-5 text-blue-600" />
              </div>
              Grade Books
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GradeBookManager
              curriculumId={selectedCurriculumId}
              onGradeSelect={setSelectedGradeBookId}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Chapters */}
      {selectedGradeBookId && !selectedChapterId && (
        <Card className="border border-slate-200/80 rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-3">
              <div className="p-1.5 bg-blue-50 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              Chapters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChapterManager
              gradeBookId={selectedGradeBookId}
              onChapterSelect={(id, chapterNum) => {
                setSelectedChapterId(id);
                if (chapterNum) setSelectedChapterNumber(chapterNum);
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 4: Content Manager */}
      {selectedChapterId && (
        <Card className="border border-slate-200/80 rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Chapter Content Manager</CardTitle>
          </CardHeader>
          <CardContent>
            <ChapterContentManager chapterId={selectedChapterId} chapterNumber={selectedChapterNumber} />
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100/80">
      <div className="py-8 px-5 sm:px-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-1.5 tracking-tight">
            Curriculum Management
          </h1>
          <p className="text-muted-foreground">
            Manage curriculums, books, chapters, and content.
          </p>
        </div>

        <Tabs defaultValue="curriculum" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[420px] h-auto rounded-xl p-1">
            <TabsTrigger value="curriculum" className="flex items-center gap-2 text-xs sm:text-sm rounded-lg">
              <Layers className="h-4 w-4" /> Curriculum
            </TabsTrigger>
            <TabsTrigger value="books" className="flex items-center gap-2 rounded-lg">
              <Book className="h-4 w-4" /> All Books
            </TabsTrigger>
            <TabsTrigger value="chapters" className="flex items-center gap-2 rounded-lg">
              <List className="h-4 w-4" /> All Chapters
            </TabsTrigger>
          </TabsList>

          <TabsContent value="curriculum">
            <DrillDownView />
          </TabsContent>

          <TabsContent value="books">
            <Card>
              <CardHeader>
                <CardTitle>All Grade Books</CardTitle>
              </CardHeader>
              <CardContent>
                <AllGradeBooksTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chapters">
            <Card>
              <CardHeader>
                <CardTitle>All Chapters</CardTitle>
              </CardHeader>
              <CardContent>
                <AllChaptersTable />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}