import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

interface MultipleChoiceEditorProps {
  options: string[];
  correctAnswer: number;
  onChange: (options: string[], correctAnswer: number) => void;
}

export function MultipleChoiceEditor({
  options,
  correctAnswer,
  onChange,
}: MultipleChoiceEditorProps) {
  const updateOption = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    onChange(updated, correctAnswer);
  };

  const addOption = () => {
    onChange([...options, ""], correctAnswer);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    const updated = options.filter((_, i) => i !== index);
    const newCorrect =
      correctAnswer === index
        ? 0
        : correctAnswer > index
          ? correctAnswer - 1
          : correctAnswer;
    onChange(updated, newCorrect);
  };

  const setCorrect = (index: number) => {
    onChange(options, index);
  };

  return (
    <div className="space-y-3">
      <Label>Options</Label>
      {options.map((option, index) => (
        <div key={index} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCorrect(index)}
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
              correctAnswer === index
                ? "border-primary bg-primary"
                : "border-muted-foreground"
            }`}
            aria-label={`Mark option ${index + 1} as correct`}
          >
            {correctAnswer === index && (
              <div className="h-2 w-2 rounded-full bg-primary-foreground" />
            )}
          </button>
          <Input
            value={option}
            onChange={(e) => updateOption(index, e.target.value)}
            placeholder={`Option ${index + 1}`}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => removeOption(index)}
            disabled={options.length <= 2}
            aria-label={`Remove option ${index + 1}`}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addOption}>
        <Plus className="mr-1 h-3 w-3" />
        Add Option
      </Button>
    </div>
  );
}
