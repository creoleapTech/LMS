import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Image, Video } from "lucide-react";
import type { Question } from "./types";
import { MultipleChoiceEditor } from "./answer-editors/MultipleChoiceEditor";
import { FillBlankEditor } from "./answer-editors/FillBlankEditor";
import { ParagraphEditor } from "./answer-editors/ParagraphEditor";
import { MatchFollowingEditor } from "./answer-editors/MatchFollowingEditor";

interface QuestionCardProps {
  question: Question;
  index: number;
  onChange: (q: Question) => void;
  onDelete: () => void;
}

const ANSWER_TYPE_LABELS: Record<Question["answerType"], string> = {
  multiple_choice: "Multiple Choice",
  fill_blank: "Fill in the Blank",
  paragraph: "Paragraph",
  match_following: "Match the Following",
};

export function QuestionCard({
  question,
  index,
  onChange,
  onDelete,
}: QuestionCardProps) {
  const update = (partial: Partial<Question>) => {
    onChange({ ...question, ...partial });
  };

  const handleAnswerTypeChange = (answerType: Question["answerType"]) => {
    const base: Partial<Question> = { answerType };

    // Reset answer-type-specific fields and set sensible defaults
    if (answerType === "multiple_choice") {
      base.options = question.options?.length ? question.options : ["", ""];
      base.correctAnswer = question.correctAnswer ?? 0;
      base.correctTextAnswer = undefined;
      base.matchPairs = undefined;
    } else if (answerType === "fill_blank") {
      base.correctTextAnswer = question.correctTextAnswer ?? "";
      base.options = undefined;
      base.correctAnswer = undefined;
      base.matchPairs = undefined;
    } else if (answerType === "paragraph") {
      base.options = undefined;
      base.correctAnswer = undefined;
      base.correctTextAnswer = undefined;
      base.matchPairs = undefined;
    } else if (answerType === "match_following") {
      base.matchPairs = question.matchPairs?.length
        ? question.matchPairs
        : [
            { left: "", right: "" },
            { left: "", right: "" },
          ];
      base.options = undefined;
      base.correctAnswer = undefined;
      base.correctTextAnswer = undefined;
    }

    update(base);
  };

  const handleMediaTypeChange = (type: string) => {
    if (type === "none") {
      update({ questionMedia: undefined });
    } else {
      update({
        questionMedia: {
          type: type as "image" | "video",
          url: question.questionMedia?.url ?? "",
        },
      });
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <Badge variant="secondary">Q{index + 1}</Badge>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            aria-label={`Delete question ${index + 1}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>

        {/* Question text */}
        <div className="space-y-2">
          <Label>Question</Label>
          <Textarea
            value={question.questionText}
            onChange={(e) => update({ questionText: e.target.value })}
            placeholder="Enter your question..."
            rows={2}
          />
        </div>

        {/* Media */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Media (optional)</Label>
            <Select
              value={question.questionMedia?.type ?? "none"}
              onValueChange={handleMediaTypeChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No media</SelectItem>
                <SelectItem value="image">
                  <Image className="mr-1 inline h-3 w-3" /> Image
                </SelectItem>
                <SelectItem value="video">
                  <Video className="mr-1 inline h-3 w-3" /> Video
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {question.questionMedia && (
            <div className="space-y-2">
              <Label>Media URL</Label>
              <Input
                value={question.questionMedia.url}
                onChange={(e) =>
                  update({
                    questionMedia: {
                      ...question.questionMedia!,
                      url: e.target.value,
                    },
                  })
                }
                placeholder="https://..."
              />
            </div>
          )}
        </div>

        {/* Answer type selector */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Answer Type</Label>
            <Select
              value={question.answerType}
              onValueChange={(v) =>
                handleAnswerTypeChange(v as Question["answerType"])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ANSWER_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Points</Label>
            <Input
              type="number"
              min={0}
              value={question.points ?? 1}
              onChange={(e) =>
                update({ points: Math.max(0, Number(e.target.value)) })
              }
            />
          </div>
        </div>

        {/* Answer editor */}
        <div>
          {question.answerType === "multiple_choice" && (
            <MultipleChoiceEditor
              options={question.options ?? ["", ""]}
              correctAnswer={question.correctAnswer ?? 0}
              onChange={(options, correctAnswer) =>
                update({ options, correctAnswer })
              }
            />
          )}
          {question.answerType === "fill_blank" && (
            <FillBlankEditor
              correctTextAnswer={question.correctTextAnswer ?? ""}
              onChange={(correctTextAnswer) => update({ correctTextAnswer })}
            />
          )}
          {question.answerType === "paragraph" && <ParagraphEditor />}
          {question.answerType === "match_following" && (
            <MatchFollowingEditor
              matchPairs={
                question.matchPairs ?? [
                  { left: "", right: "" },
                  { left: "", right: "" },
                ]
              }
              onChange={(matchPairs) => update({ matchPairs })}
            />
          )}
        </div>

        {/* Explanation */}
        <div className="space-y-2">
          <Label>Explanation (optional)</Label>
          <Textarea
            value={question.explanation ?? ""}
            onChange={(e) => update({ explanation: e.target.value })}
            placeholder="Explain the correct answer..."
            rows={2}
          />
        </div>
      </CardContent>
    </Card>
  );
}
