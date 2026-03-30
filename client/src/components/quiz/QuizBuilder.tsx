import { useState, useCallback, useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GripVertical, Plus } from "lucide-react";
import type { Question } from "./types";
import { QuestionCard } from "./QuestionCard";

interface QuizBuilderProps {
  questions: Question[];
  onChange: (questions: Question[]) => void;
}

const ANSWER_TYPE_LABELS: Record<Question["answerType"], string> = {
  multiple_choice: "Multiple Choice",
  fill_blank: "Fill in the Blank",
  paragraph: "Paragraph",
  match_following: "Match the Following",
};

function createDefaultQuestion(answerType: Question["answerType"]): Question {
  const base: Question = {
    questionText: "",
    answerType,
    points: 1,
    explanation: "",
  };

  switch (answerType) {
    case "multiple_choice":
      return { ...base, options: ["", ""], correctAnswer: 0 };
    case "fill_blank":
      return { ...base, correctTextAnswer: "" };
    case "paragraph":
      return base;
    case "match_following":
      return {
        ...base,
        matchPairs: [
          { left: "", right: "" },
          { left: "", right: "" },
        ],
      };
  }
}

function SortableQuestion({
  id,
  question,
  index,
  onChangeQuestion,
  onDelete,
}: {
  id: string;
  question: Question;
  index: number;
  onChangeQuestion: (index: number, q: Question) => void;
  onDelete: (index: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div
        className="absolute left-0 top-6 z-10 -ml-3 flex cursor-grab items-center rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </div>
      <div className="ml-4">
        <QuestionCard
          question={question}
          index={index}
          onChange={(q) => onChangeQuestion(index, q)}
          onDelete={() => onDelete(index)}
        />
      </div>
    </div>
  );
}

export function QuizBuilder({ questions, onChange }: QuizBuilderProps) {
  const [addType, setAddType] =
    useState<Question["answerType"]>("multiple_choice");

  // Stable IDs for dnd-kit — we maintain a parallel array of unique keys.
  const idCounterRef = useRef(questions.length);
  const [questionIds, setQuestionIds] = useState<string[]>(() =>
    questions.map((_, i) => `q-${i}`)
  );

  // Sync IDs when the external questions array length changes.
  useEffect(() => {
    if (questionIds.length !== questions.length) {
      const newIds = questions.map(
        (_, i) => questionIds[i] ?? `q-${idCounterRef.current + i}`
      );
      setQuestionIds(newIds);
      if (newIds.length > questionIds.length) {
        idCounterRef.current += newIds.length - questionIds.length;
      }
    }
  }, [questions.length]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  const handleAdd = () => {
    const newQuestion = createDefaultQuestion(addType);
    const newId = `q-${idCounterRef.current}`;
    idCounterRef.current += 1;
    setQuestionIds((ids) => [...ids, newId]);
    onChange([...questions, newQuestion]);
  };

  const handleChangeQuestion = useCallback(
    (index: number, q: Question) => {
      const updated = [...questions];
      updated[index] = q;
      onChange(updated);
    },
    [questions, onChange]
  );

  const handleDelete = useCallback(
    (index: number) => {
      const updated = questions.filter((_, i) => i !== index);
      setQuestionIds((ids) => ids.filter((_, i) => i !== index));
      onChange(updated);
    },
    [questions, onChange]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = questionIds.indexOf(String(active.id));
    const newIndex = questionIds.indexOf(String(over.id));

    const newQuestions = arrayMove(questions, oldIndex, newIndex);
    const newIds = arrayMove(questionIds, oldIndex, newIndex);

    setQuestionIds(newIds);
    onChange(newQuestions);
  };

  return (
    <div className="space-y-4">
      {/* Add question controls */}
      <div className="flex items-center gap-2">
        <Select
          value={addType}
          onValueChange={(v) => setAddType(v as Question["answerType"])}
        >
          <SelectTrigger className="w-48">
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
        <Button type="button" onClick={handleAdd}>
          <Plus className="mr-1 h-4 w-4" />
          Add Question
        </Button>
      </div>

      {/* Sortable question list */}
      {questions.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={questionIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {questions.map((question, index) => (
                <SortableQuestion
                  key={questionIds[index]}
                  id={questionIds[index]}
                  question={question}
                  index={index}
                  onChangeQuestion={handleChangeQuestion}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          <p>No questions yet. Add one to get started.</p>
        </div>
      )}
    </div>
  );
}
