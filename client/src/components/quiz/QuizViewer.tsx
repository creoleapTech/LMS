import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, XCircle, Send } from "lucide-react";
import type { Question } from "./types";

type Answer =
  | { type: "multiple_choice"; selected: number | null }
  | { type: "fill_blank"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "match_following"; matches: Record<number, string> };

interface QuizViewerProps {
  questions: Question[];
  onSubmit?: (answers: Answer[]) => void;
  readOnly?: boolean;
}

function createEmptyAnswer(q: Question): Answer {
  switch (q.answerType) {
    case "multiple_choice":
      return { type: "multiple_choice", selected: null };
    case "fill_blank":
      return { type: "fill_blank", text: "" };
    case "paragraph":
      return { type: "paragraph", text: "" };
    case "match_following":
      return { type: "match_following", matches: {} };
  }
}

function gradeQuestion(q: Question, answer: Answer): boolean | null {
  switch (q.answerType) {
    case "multiple_choice":
      if (answer.type !== "multiple_choice" || answer.selected === null)
        return false;
      return answer.selected === q.correctAnswer;

    case "fill_blank":
      if (answer.type !== "fill_blank" || !answer.text.trim()) return false;
      return (
        answer.text.trim().toLowerCase() ===
        (q.correctTextAnswer ?? "").trim().toLowerCase()
      );

    case "paragraph":
      // Paragraph answers require manual grading
      return null;

    case "match_following":
      if (answer.type !== "match_following" || !q.matchPairs) return false;
      return q.matchPairs.every(
        (pair, i) => answer.matches[i] === pair.right
      );
  }
}

export function QuizViewer({
  questions: rawQuestions,
  onSubmit,
  readOnly = false,
}: QuizViewerProps) {
  // Handle stringified questions from API
  const questions: Question[] = useMemo(
    () =>
      typeof rawQuestions === "string"
        ? JSON.parse(rawQuestions)
        : rawQuestions,
    [rawQuestions]
  );

  const [answers, setAnswers] = useState<Answer[]>(() =>
    questions.map(createEmptyAnswer)
  );
  const [submitted, setSubmitted] = useState(false);

  if (!questions || questions.length === 0) {
    return (
      <p className="py-4 text-center text-muted-foreground">
        No questions available.
      </p>
    );
  }

  const updateAnswer = (index: number, answer: Answer) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = answer;
      return next;
    });
  };

  const handleSubmit = () => {
    setSubmitted(true);
    onSubmit?.(answers);
  };

  // Compute score after submission
  const results = submitted
    ? questions.map((q, i) => gradeQuestion(q, answers[i]))
    : null;

  const totalPoints = questions.reduce((sum, q) => sum + (q.points ?? 1), 0);
  const earnedPoints = results
    ? questions.reduce(
        (sum, q, i) => sum + (results[i] === true ? (q.points ?? 1) : 0),
        0
      )
    : 0;
  const gradableCount = results
    ? results.filter((r) => r !== null).length
    : 0;

  return (
    <div className="space-y-4">
      {/* Score summary */}
      {submitted && (
        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold">
                Score: {earnedPoints} / {totalPoints}
              </p>
              {gradableCount < questions.length && (
                <p className="text-sm text-muted-foreground">
                  {questions.length - gradableCount} question
                  {questions.length - gradableCount !== 1 ? "s" : ""} require
                  manual grading.
                </p>
              )}
            </div>
            <Badge
              variant={
                earnedPoints >= totalPoints * 0.7 ? "default" : "destructive"
              }
              className="text-sm"
            >
              {totalPoints > 0
                ? Math.round((earnedPoints / totalPoints) * 100)
                : 0}
              %
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Questions */}
      {questions.map((q, index) => {
        const answer = answers[index];
        const result = results ? results[index] : undefined;

        return (
          <Card
            key={index}
            className={
              submitted && result !== undefined
                ? result === true
                  ? "border-green-300 dark:border-green-800"
                  : result === false
                    ? "border-red-300 dark:border-red-800"
                    : ""
                : ""
            }
          >
            <CardContent className="space-y-3">
              {/* Question header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Badge variant="secondary" className="mt-0.5 shrink-0">
                    Q{index + 1}
                  </Badge>
                  <p className="font-medium">{q.questionText}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {q.answerType.replace(/_/g, " ")}
                  </Badge>
                  {q.points != null && (
                    <Badge variant="secondary" className="text-xs">
                      {q.points} pt{q.points !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {submitted && result === true && (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  )}
                  {submitted && result === false && (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </div>

              {/* Media */}
              {q.questionMedia && q.questionMedia.url && (
                <div className="overflow-hidden rounded-md">
                  {q.questionMedia.type === "image" ? (
                    <img
                      src={q.questionMedia.url}
                      alt="Question media"
                      className="max-h-64 w-auto rounded-md object-contain"
                    />
                  ) : (
                    <video
                      src={q.questionMedia.url}
                      controls
                      className="max-h-64 w-full rounded-md"
                    />
                  )}
                </div>
              )}

              {/* Multiple choice */}
              {q.answerType === "multiple_choice" && q.options && (
                <div className="space-y-2">
                  {q.options.map((opt, oi) => {
                    const isSelected =
                      answer.type === "multiple_choice" &&
                      answer.selected === oi;
                    const isCorrect = q.correctAnswer === oi;
                    const showCorrect = submitted || readOnly;

                    return (
                      <label
                        key={oi}
                        className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors ${
                          readOnly && !submitted
                            ? "cursor-default"
                            : submitted
                              ? "cursor-default"
                              : "hover:bg-accent"
                        } ${
                          isSelected && !showCorrect
                            ? "border-primary bg-primary/5"
                            : ""
                        } ${
                          showCorrect && isCorrect
                            ? "border-green-400 bg-green-50 dark:border-green-700 dark:bg-green-950"
                            : ""
                        } ${
                          showCorrect && isSelected && !isCorrect
                            ? "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950"
                            : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${index}`}
                          checked={isSelected}
                          onChange={() => {
                            if (!submitted && !readOnly) {
                              updateAnswer(index, {
                                type: "multiple_choice",
                                selected: oi,
                              });
                            }
                          }}
                          disabled={submitted || readOnly}
                          className="accent-primary"
                        />
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium">
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span className="flex-1">{opt}</span>
                        {showCorrect && isCorrect && (
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          >
                            Correct
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Fill in the blank */}
              {q.answerType === "fill_blank" && (
                <div className="space-y-2">
                  {!readOnly && (
                    <Input
                      value={
                        answer.type === "fill_blank" ? answer.text : ""
                      }
                      onChange={(e) =>
                        !submitted &&
                        updateAnswer(index, {
                          type: "fill_blank",
                          text: e.target.value,
                        })
                      }
                      placeholder="Type your answer..."
                      disabled={submitted}
                    />
                  )}
                  {(submitted || readOnly) && q.correctTextAnswer && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">
                        Correct answer:{" "}
                      </span>
                      <span className="font-medium text-green-700 dark:text-green-400">
                        {q.correctTextAnswer}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {/* Paragraph */}
              {q.answerType === "paragraph" && (
                <div className="space-y-2">
                  {!readOnly && (
                    <Textarea
                      value={
                        answer.type === "paragraph" ? answer.text : ""
                      }
                      onChange={(e) =>
                        !submitted &&
                        updateAnswer(index, {
                          type: "paragraph",
                          text: e.target.value,
                        })
                      }
                      placeholder="Write your response..."
                      rows={4}
                      disabled={submitted}
                    />
                  )}
                  {submitted && (
                    <p className="text-xs text-muted-foreground italic">
                      This response requires manual grading.
                    </p>
                  )}
                </div>
              )}

              {/* Match the following */}
              {q.answerType === "match_following" && q.matchPairs && (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span>Item</span>
                    <span />
                    <span>Match</span>
                  </div>
                  {q.matchPairs.map((pair, pi) => {
                    const selectedValue =
                      answer.type === "match_following"
                        ? answer.matches[pi] ?? ""
                        : "";
                    const isCorrectMatch =
                      submitted && selectedValue === pair.right;
                    const isWrongMatch =
                      submitted && selectedValue !== pair.right;

                    // Collect all right-side values for the dropdown
                    const rightOptions = q.matchPairs!.map((p) => p.right);

                    return (
                      <div
                        key={pi}
                        className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"
                      >
                        <span className="rounded-md border p-2 text-sm">
                          {pair.left}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        {readOnly ? (
                          <span
                            className={`rounded-md border p-2 text-sm font-medium ${
                              "text-green-700 dark:text-green-400"
                            }`}
                          >
                            {pair.right}
                          </span>
                        ) : submitted ? (
                          <span
                            className={`rounded-md border p-2 text-sm ${
                              isCorrectMatch
                                ? "border-green-400 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400"
                                : "border-red-400 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-400"
                            }`}
                          >
                            {selectedValue || "—"}
                            {isWrongMatch && (
                              <span className="ml-2 text-xs text-green-600">
                                (Correct: {pair.right})
                              </span>
                            )}
                          </span>
                        ) : (
                          <Select
                            value={selectedValue}
                            onValueChange={(v) => {
                              if (answer.type === "match_following") {
                                updateAnswer(index, {
                                  type: "match_following",
                                  matches: { ...answer.matches, [pi]: v },
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select match..." />
                            </SelectTrigger>
                            <SelectContent>
                              {rightOptions.map((opt, oi) => (
                                <SelectItem key={oi} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Explanation */}
              {(submitted || readOnly) && q.explanation && (
                <div className="rounded-md border border-dashed p-3">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Explanation:{" "}
                    </span>
                    {q.explanation}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Submit button */}
      {!readOnly && !submitted && (
        <Button onClick={handleSubmit} className="w-full">
          <Send className="mr-2 h-4 w-4" />
          Submit Quiz
        </Button>
      )}
    </div>
  );
}
