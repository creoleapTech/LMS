import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FillBlankEditorProps {
  correctTextAnswer: string;
  onChange: (answer: string) => void;
}

export function FillBlankEditor({
  correctTextAnswer,
  onChange,
}: FillBlankEditorProps) {
  return (
    <div className="space-y-2">
      <Label>Correct Answer</Label>
      <Input
        value={correctTextAnswer}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter the correct answer"
      />
      <p className="text-xs text-muted-foreground">
        The student's response will be compared against this answer.
      </p>
    </div>
  );
}
