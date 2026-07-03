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
import { createQuizSchema, type CreateQuizValues } from "../types";

interface QuizFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuizFormDialog({ open, onOpenChange }: QuizFormDialogProps) {
  const createQuiz = useCreateQuiz();

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
  }, [open, reset]);

  const onSubmit = (data: CreateQuizValues) => {
    createQuiz.mutate(data, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  const retakeAllowed = watch("retakeAllowed");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Quiz</DialogTitle>
          <DialogDescription>
            Set up a new quiz. You can add questions after creating it.
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
              placeholder="Leave empty for no time limit"
              {...register("timeLimitMinutes", { valueAsNumber: true })}
            />
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
              placeholder="0 = no passing score"
              {...register("passingPoints", { valueAsNumber: true })}
            />
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
                {...register("maxRetakes", { valueAsNumber: true })}
              />
            </div>
          )}

          {/* Publish */}
          <div className="flex items-center justify-between border-t pt-4">
            <div className="space-y-0.5">
              <Label>Publish Immediately</Label>
              <p className="text-xs text-muted-foreground">Students can see this quiz</p>
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
            <Button type="submit" disabled={createQuiz.isPending}>
              {createQuiz.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
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
