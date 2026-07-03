import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Search,
  Plus,
  Trash2,
  ClipboardList,
  Clock,
  Calendar,
  Eye,
  EyeOff,
  Download,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useAuthStore } from "@/store/userAuthStore";
import { _axios } from "@/lib/axios";
import { useQuizzes } from "./hooks/useQuizzes";
import { useDeleteQuiz } from "./hooks/useDeleteQuiz";
import { QuizFormDialog } from "./components/QuizFormDialog";
import type { Quiz } from "./types";

export default function QuizzesPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin";

  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Quiz | null>(null);
  const [importTarget, setImportTarget] = useState<Quiz | null>(null);

  const adminInstitutionId = isAdmin
    ? typeof user?.institutionId === "object"
      ? (user?.institutionId as { _id: string })?._id
      : user?.institutionId ?? ""
    : "";

  const effectiveInstitutionId = isSuperAdmin ? selectedInstitutionId : adminInstitutionId;

  const { data, isLoading } = useQuizzes({
    page,
    limit: 20,
    search: search || undefined,
    institutionId: effectiveInstitutionId || undefined,
  });

  const deleteQuiz = useDeleteQuiz();

  const quizzes = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 20 };

  const handleExportCSV = async (quiz: Quiz) => {
    try {
      const res = await _axios.get(`/admin/quizzes/${quiz.id}/export-csv`);
      const csv = res.data.data;
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.data.filename || `${quiz.title}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const handleImportCSV = async (quiz: Quiz, file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      await _axios.post(`/admin/quizzes/${quiz.id}/import-csv`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportTarget(null);
    } catch {}
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quizzes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage quizzes for your institution
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Quiz
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {isSuperAdmin && (
          <Input
            placeholder="Filter by institution ID..."
            value={selectedInstitutionId}
            onChange={(e) => {
              setSelectedInstitutionId(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
        )}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search quizzes..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
      </div>

      {/* Quiz Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading quizzes...</div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No quizzes found</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Create your first quiz
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="group relative border rounded-xl p-5 hover:shadow-md transition-all cursor-pointer bg-white"
              onClick={() => navigate({ to: `/quizzes/${quiz.id}` })}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate">{quiz.title}</h3>
                  {quiz.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {quiz.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  {quiz.isPublished ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                      <Eye className="h-3 w-3" /> Published
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                      <EyeOff className="h-3 w-3" /> Draft
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-4">
                <span className="flex items-center gap-1">
                  <ClipboardList className="h-3 w-3" />
                  {quiz.questionCount ?? 0} questions
                </span>
                <span>{quiz.totalPoints} pts</span>
                {quiz.timeLimitMinutes && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {quiz.timeLimitMinutes}m
                  </span>
                )}
                {quiz.startDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(quiz.startDate).toLocaleDateString()}
                  </span>
                )}
                {quiz.retakeAllowed === 1 && (
                  <span className="text-blue-600">Retake allowed</span>
                )}
              </div>

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handleExportCSV(quiz)}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setImportTarget(quiz)}
                >
                  <Upload className="h-3 w-3 mr-1" />
                  Import
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(quiz)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta.total > meta.limit && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {meta.page} of {Math.ceil(meta.total / meta.limit)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(meta.total / meta.limit)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Create Dialog */}
      <QuizFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quiz</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteQuiz.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import CSV Dialog */}
      <AlertDialog open={!!importTarget} onOpenChange={() => setImportTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import Questions from CSV</AlertDialogTitle>
            <AlertDialogDescription>
              Upload a CSV file to import questions into "{importTarget?.title}".
              Columns: questionText, answerType, correctAnswer, explanation, points, option1-option6
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <label className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 cursor-pointer">
              Choose CSV File
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && importTarget) {
                    handleImportCSV(importTarget, file);
                  }
                }}
              />
            </label>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
