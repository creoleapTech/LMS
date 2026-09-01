import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { _axios } from "@/lib/axios";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { createQuestionSchema, type CreateQuestionValues } from "../types";
import { TEXT_LIMITS } from "@/lib/validation/textLimits";

const BLOOM_TAXONOMY_OPTIONS = [
  "Remember",
  "Understand",
  "Apply",
  "Analyze",
  "Evaluate",
  "Create",
];

interface AddQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizId: string;
  institutionId?: string;
}

export function AddQuestionDialog({ open, onOpenChange, quizId, institutionId }: AddQuestionDialogProps) {
  const queryClient = useQueryClient();
  const [options, setOptions] = useState<{ text: string }[]>([
    { text: "" },
    { text: "" },
  ]);
  const [questionImage, setQuestionImage] = useState<File | null>(null);
  const [optionImages, setOptionImages] = useState<(File | null)[]>([null, null]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");
  const [selectedBloom, setSelectedBloom] = useState<string>("");

  // Fetch chapters for this institution
  const { data: chaptersData } = useQuery<any[]>({
    queryKey: ["quiz-chapters", institutionId],
    queryFn: async () => {
      const res = await _axios.get(`/admin/quizzes/chapters`, {
        params: institutionId ? { institutionId } : {},
      });
      return res.data.data;
    },
    enabled: open,
  });

  const chapters = chaptersData || [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateQuestionValues>({
    resolver: zodResolver(createQuestionSchema),
    defaultValues: {
      questionText: "",
      answerType: "multiple_choice",
      correctAnswer: "",
      explanation: "",
      points: 1,
    },
  });

  const answerType = watch("answerType");

  useEffect(() => {
    if (open) {
      reset({
        questionText: "",
        answerType: "multiple_choice",
        correctAnswer: "",
        explanation: "",
        points: 1,
      });
      setOptions([{ text: "" }, { text: "" }]);
      setQuestionImage(null);
      setOptionImages([null, null]);
      setSelectedChapterId("");
      setSelectedBloom("");
    }
  }, [open, reset]);

  const addOption = () => {
    setOptions((prev) => [...prev, { text: "" }]);
    setOptionImages((prev) => [...prev, null]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
    setOptionImages((prev) => prev.filter((_, i) => i !== index));
  };

  const updateOptionText = (index: number, text: string) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? { text } : o)));
  };

  const onSubmit = async (data: CreateQuestionValues) => {
    const filteredOptions = options.filter((o) => o.text.trim());
    console.log("[AddQuestion] onSubmit triggered", { data, options, filteredOptions, quizId, questionImage, optionImages });

    if (filteredOptions.length < 2) {
      toast.error("At least 2 options are required");
      return;
    }

    if (!data.correctAnswer) {
      toast.error("Select the correct answer");
      return;
    }

    setSubmitting(true);
    try {
      console.log("[AddQuestion] filteredOptions", filteredOptions);

      const formData = new FormData();
      formData.append("questionText", data.questionText);
      formData.append("answerType", data.answerType);
      formData.append("correctAnswer", data.correctAnswer);
      if (data.explanation) formData.append("explanation", data.explanation);
      formData.append("points", String(data.points));
      formData.append("options", JSON.stringify(filteredOptions));
      if (selectedChapterId) formData.append("chapterId", selectedChapterId);
      if (selectedBloom) formData.append("bloomTaxonomy", selectedBloom);

      if (questionImage) {
        formData.append("questionMedia", questionImage);
      }

      for (let i = 0; i < optionImages.length; i++) {
        if (optionImages[i]) {
          formData.append(`optionMedia_${i}`, optionImages[i]!);
        }
      }

      console.log("[AddQuestion] POSTing to", `/admin/quizzes/${quizId}/questions`);
      const res = await _axios.post(`/admin/quizzes/${quizId}/questions`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log("[AddQuestion] Success", res.data);

      queryClient.invalidateQueries({ queryKey: ["quiz", quizId] });
      toast.success("Question added successfully");
      onOpenChange(false);
    } catch (err: any) {
      console.error("[AddQuestion] Error", err?.response?.data || err);
      toast.error("Failed to add question");
    } finally {
      setSubmitting(false);
    }
  };

  // When answer type changes to true_false, set default options
  useEffect(() => {
    if (answerType === "true_false") {
      setOptions([{ text: "True" }, { text: "False" }]);
      setOptionImages([null, null]);
    }
  }, [answerType]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Question</DialogTitle>
          <DialogDescription>
            Add a multiple choice question with optional images.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Question Text */}
          <div className="space-y-2">
            <Label htmlFor="questionText">Question *</Label>
            <Textarea
              id="questionText"
              maxLength={TEXT_LIMITS.quizQuestion}
              placeholder="Enter your question..."
              rows={3}
              {...register("questionText")}
            />
            {errors.questionText && (
              <p className="text-sm text-destructive">{errors.questionText.message}</p>
            )}
          </div>

          {/* Question Image */}
          <div className="space-y-2">
            <Label>Question Image (optional)</Label>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer hover:bg-slate-50">
                <Upload className="h-4 w-4" />
                {questionImage ? questionImage.name : "Upload image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setQuestionImage(e.target.files?.[0] || null)}
                />
              </label>
              {questionImage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuestionImage(null)}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>

          {/* Answer Type + Points */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Answer Type</Label>
              <Select
                value={answerType}
                onValueChange={(val) => setValue("answerType", val as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                  <SelectItem value="true_false">True / False</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="points">Points</Label>
              <Input
                id="points"
                type="number"
                min={0}
                max={100}
                {...register("points", { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* Chapter + Bloom's Taxonomy */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Chapter (optional)</Label>
              <Select
                value={selectedChapterId || "__none__"}
                onValueChange={(val) => setSelectedChapterId(val === "__none__" ? "" : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select chapter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {chapters.map((ch: any) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      {ch.chapterNumber ? `${ch.chapterNumber}. ` : ""}{ch.title || "Untitled"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bloom's Taxonomy (optional)</Label>
              <Select
                value={selectedBloom || "__none__"}
                onValueChange={(val) => setSelectedBloom(val === "__none__" ? "" : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {BLOOM_TAXONOMY_OPTIONS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Options */}
          {answerType !== "true_false" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Options *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOption}
                  className="gap-1 h-7"
                >
                  <Plus className="h-3 w-3" />
                  Add Option
                </Button>
              </div>

              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-sm font-bold text-muted-foreground w-6">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  <Input
                    placeholder={`Option ${idx + 1}`}
                    maxLength={TEXT_LIMITS.optionText}
                    value={opt.text}
                    onChange={(e) => updateOptionText(idx, e.target.value)}
                  />
                  <label className="shrink-0">
                    <span className="sr-only">Option image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setOptionImages((prev) => {
                          const next = [...prev];
                          next[idx] = file;
                          return next;
                        });
                      }}
                    />
                    <span className="inline-flex items-center justify-center h-9 w-9 border rounded-md cursor-pointer hover:bg-slate-50">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                    </span>
                  </label>
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-destructive"
                      onClick={() => removeOption(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Correct Answer */}
          <div className="space-y-2">
            <Label>Correct Answer *</Label>
            {answerType === "true_false" ? (
              <Select
                value={watch("correctAnswer")}
                onValueChange={(val) => setValue("correctAnswer", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select correct answer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="True">True</SelectItem>
                  <SelectItem value="False">False</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={watch("correctAnswer")}
                onValueChange={(val) => setValue("correctAnswer", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select correct option" />
                </SelectTrigger>
                <SelectContent>
                  {options
                    .filter((o) => o.text.trim())
                    .map((opt, idx) => (
                      <SelectItem key={idx} value={opt.text}>
                        {String.fromCharCode(65 + idx)}. {opt.text}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            {errors.correctAnswer && (
              <p className="text-sm text-destructive">{errors.correctAnswer.message}</p>
            )}
          </div>

          {/* Explanation */}
          <div className="space-y-2">
            <Label htmlFor="explanation">Explanation (optional)</Label>
            <Textarea
              id="explanation"
              maxLength={TEXT_LIMITS.quizExplanation}
              placeholder="Explain why this is the correct answer..."
              rows={2}
              {...register("explanation")}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Question"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
