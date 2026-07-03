import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Save,
  Loader2,
  Image,
  Eye,
  EyeOff,
  Clock,
  Calendar,
  ArrowUpDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

import { _axios } from "@/lib/axios";
import { useQuiz } from "./hooks/useQuiz";
import { useUpdateQuiz } from "./hooks/useUpdateQuiz";
import { AddQuestionDialog } from "./components/AddQuestionDialog";
import type { QuizQuestion } from "./types";

export default function QuizDetailPage() {
  const { id } = useParams({ from: "/quizzes/$id" });
  const { data: quiz, isLoading } = useQuiz(id);
  const updateQuiz = useUpdateQuiz();

  const [editMode, setEditMode] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [addQuestionOpen, setAddQuestionOpen] = useState(false);
  const [deleteQuestion, setDeleteQuestion] = useState<QuizQuestion | null>(null);
  const [publishState, setPublishState] = useState(false);

  // Sync edit state when quiz loads
  const startEdit = () => {
    if (quiz) {
      setTitle(quiz.title);
      setDescription(quiz.description || "");
      setPublishState(quiz.isPublished === 1);
    }
    setEditMode(true);
  };

  const saveEdits = () => {
    updateQuiz.mutate(
      {
        id,
        data: {
          title,
          description: description || null,
          isPublished: publishState,
        },
      },
      { onSuccess: () => setEditMode(false) },
    );
  };

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      await _axios.delete(`/admin/quizzes/${id}/questions/${questionId}`);
      setDeleteQuestion(null);
    } catch {}
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">Loading quiz...</div>
    );
  }

  if (!quiz) {
    return <div className="p-8 text-center text-destructive">Quiz not found</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Quizzes
      </button>

      {/* Quiz Header */}
      <div className="border rounded-xl p-6 bg-white space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {editMode ? (
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xl font-bold"
              />
            ) : (
              <h1 className="text-2xl font-bold">{quiz.title}</h1>
            )}
            {editMode ? (
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-2"
                rows={2}
                placeholder="Description..."
              />
            ) : (
              quiz.description && (
                <p className="text-muted-foreground mt-1">{quiz.description}</p>
              )
            )}
          </div>
          <div className="flex items-center gap-2">
            {editMode ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={saveEdits} disabled={updateQuiz.isPending}>
                  {updateQuiz.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={startEdit}>
                  Edit Details
                </Button>
                <Button
                  variant={quiz.isPublished ? "outline" : "default"}
                  size="sm"
                  onClick={() =>
                    updateQuiz.mutate({
                      id,
                      data: { isPublished: quiz.isPublished === 1 ? false : true },
                    })
                  }
                >
                  {quiz.isPublished ? (
                    <>
                      <EyeOff className="h-4 w-4 mr-1" />
                      Unpublish
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-1" />
                      Publish
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Quiz Meta */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>{quiz.totalPoints} total points</span>
          {quiz.timeLimitMinutes && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {quiz.timeLimitMinutes} min
            </span>
          )}
          {quiz.startDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(quiz.startDate).toLocaleDateString()} -{" "}
              {quiz.endDate ? new Date(quiz.endDate).toLocaleDateString() : "No end"}
            </span>
          )}
          {quiz.retakeAllowed === 1 && (
            <span className="text-blue-600">
              Retake allowed{quiz.maxRetakes ? ` (${quiz.maxRetakes}x)` : " (unlimited)"}
            </span>
          )}
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Questions ({quiz.questions?.length ?? 0})
          </h2>
          <Button size="sm" className="gap-2" onClick={() => setAddQuestionOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Question
          </Button>
        </div>

        {(!quiz.questions || quiz.questions.length === 0) ? (
          <div className="text-center py-12 border rounded-xl bg-white">
            <p className="text-muted-foreground mb-4">No questions yet</p>
            <Button onClick={() => setAddQuestionOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add your first question
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {quiz.questions.map((q, idx) => (
              <div
                key={q.id}
                className="border rounded-xl p-5 bg-white hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 text-muted-foreground pt-1">
                    <GripVertical className="h-4 w-4" />
                    <span className="text-sm font-medium">{idx + 1}.</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium">{q.questionText}</p>
                        {q.questionMediaUrl && (
                          <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground bg-slate-50 px-2 py-1 rounded">
                            <Image className="h-3 w-3" />
                            Has image
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground bg-slate-100 px-2 py-1 rounded">
                          {q.points} pt{q.points !== 1 ? "s" : ""}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteQuestion(q)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Options */}
                    <div className="mt-3 space-y-1.5">
                      {q.options?.map((opt, optIdx) => (
                        <div
                          key={opt.id}
                          className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg ${
                            q.correctAnswer === opt.text
                              ? "bg-green-50 text-green-800 font-medium border border-green-200"
                              : "bg-slate-50 text-slate-700"
                          }`}
                        >
                          <span className="text-xs font-bold w-5">
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="flex-1">{opt.text}</span>
                          {opt.mediaUrl && (
                            <Image className="h-3 w-3 text-muted-foreground" />
                          )}
                          {q.correctAnswer === opt.text && (
                            <span className="text-xs font-medium text-green-600">Correct</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {q.explanation && (
                      <p className="mt-2 text-xs text-muted-foreground italic">
                        Explanation: {q.explanation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Question Dialog */}
      <AddQuestionDialog
        open={addQuestionOpen}
        onOpenChange={setAddQuestionOpen}
        quizId={id}
      />

      {/* Delete Question Dialog */}
      <AlertDialog open={!!deleteQuestion} onOpenChange={() => setDeleteQuestion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => {
                if (deleteQuestion) handleDeleteQuestion(deleteQuestion.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
