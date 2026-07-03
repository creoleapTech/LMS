import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";

import { useCreateQuiz } from "../hooks/useCreateQuiz";
import { useUpdateQuiz } from "../hooks/useUpdateQuiz";
import { createQuizSchema, type CreateQuizValues, type Quiz } from "../types";

interface QuizFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  institutionId?: string;
  quiz?: Quiz;
}

function toLocalDatetime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function QuizFormDialog({ open, onOpenChange, institutionId, quiz }: QuizFormDialogProps) {
  const isEdit = !!quiz;
  const createQuiz = useCreateQuiz();
  const updateQuiz = useUpdateQuiz();
  const isPending = isEdit ? updateQuiz.isPending : createQuiz.isPending;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateQuizValues>({
    resolver: zodResolver(createQuizSchema),
    defaultValues: {
      title: "",
      description: "",
      retakeAllowed: false,
      maxRetakes: 0,
      passingPoints: 0,
      isPublished: false,
    },
  });

  useEffect(() => {
    if (open) {
      if (isEdit && quiz) {
        reset({
          title: quiz.title,
          description: quiz.description || "",
          startDate: toLocalDatetime(quiz.startDate) || null,
          endDate: toLocalDatetime(quiz.endDate) || null,
          timeLimitMinutes: quiz.timeLimitMinutes ?? null,
          retakeAllowed: quiz.retakeAllowed === 1,
          maxRetakes: quiz.maxRetakes ?? 0,
          passingPoints: quiz.passingPoints ?? 0,
          isPublished: quiz.isPublished === 1,
        });
      } else {
        reset({
          title: "",
          description: "",
          startDate: null,
          endDate: null,
          timeLimitMinutes: null,
          retakeAllowed: false,
          maxRetakes: 0,
          passingPoints: 0,
          isPublished: false,
        });
      }
    }
  }, [open, isEdit, quiz, reset]);

  const onSubmit = (data: CreateQuizValues) => {
    if (isEdit && quiz) {
      updateQuiz.mutate(
        { id: quiz.id, data },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      const payload = institutionId ? { ...data, institutionId } : data;
      createQuiz.mutate(payload, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  const retakeAllowed = watch("retakeAllowed");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Quiz" : "Create Quiz"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update quiz settings. You can manage questions in the Questions tab."
              : "Set up a new quiz. You can add questions after creating it."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" placeholder="e.g. Chapter 5 Assessment" {...register("title")} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description..."
              rows={3}
              {...register("description")}
            />
          </div>

          {/* Time Limit */}
          <div className="space-y-2">
            <Label htmlFor="timeLimitMinutes">Time Limit (minutes)</Label>
            <Input
              id="timeLimitMinutes"
              type="number"
              min={0}
              placeholder="Leave empty for no time limit"
              {...register("timeLimitMinutes", { valueAsNumber: true })}
            />
            {errors.timeLimitMinutes && (
              <p className="text-sm text-destructive">{errors.timeLimitMinutes.message}</p>
            )}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="datetime-local" {...register("startDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="datetime-local" {...register("endDate")} />
            </div>
          </div>

          {/* Passing Score */}
          <div className="space-y-2">
            <Label htmlFor="passingPoints">Passing Score (points)</Label>
            <Input
              id="passingPoints"
              type="number"
              min={0}
              placeholder="0 = no passing score"
              {...register("passingPoints", { valueAsNumber: true })}
            />
            {errors.passingPoints && (
              <p className="text-sm text-destructive">{errors.passingPoints.message}</p>
            )}
          </div>

          {/* Retake */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Allow Retakes</Label>
              <p className="text-xs text-muted-foreground">Students can retake the quiz</p>
            </div>
            <Switch
              checked={retakeAllowed}
              onCheckedChange={(checked) => setValue("retakeAllowed", checked)}
            />
          </div>

          {retakeAllowed && (
            <div className="space-y-2">
              <Label htmlFor="maxRetakes">Max Retakes (0 = unlimited)</Label>
              <Input
                id="maxRetakes"
                type="number"
                min={0}
                {...register("maxRetakes", { valueAsNumber: true })}
              />
              {errors.maxRetakes && (
                <p className="text-sm text-destructive">{errors.maxRetakes.message}</p>
              )}
            </div>
          )}

          {/* Publish */}
          <div className="flex items-center justify-between border-t pt-4">
            <div className="space-y-0.5">
              <Label>{isEdit ? "Published" : "Publish Immediately"}</Label>
              <p className="text-xs text-muted-foreground">
                {isEdit ? "Students can see this quiz" : "Students can see this quiz after creation"}
              </p>
            </div>
            <Switch
              checked={watch("isPublished")}
              onCheckedChange={(checked) => setValue("isPublished", checked)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEdit ? "Saving..." : "Creating..."}
                </>
              ) : isEdit ? (
                "Save Changes"
              ) : (
                "Create Quiz"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
