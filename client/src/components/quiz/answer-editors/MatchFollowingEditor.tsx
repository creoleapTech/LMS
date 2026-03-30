import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

interface MatchFollowingEditorProps {
  matchPairs: { left: string; right: string }[];
  onChange: (pairs: { left: string; right: string }[]) => void;
}

export function MatchFollowingEditor({
  matchPairs,
  onChange,
}: MatchFollowingEditorProps) {
  const updatePair = (
    index: number,
    side: "left" | "right",
    value: string
  ) => {
    const updated = [...matchPairs];
    updated[index] = { ...updated[index], [side]: value };
    onChange(updated);
  };

  const addPair = () => {
    onChange([...matchPairs, { left: "", right: "" }]);
  };

  const removePair = (index: number) => {
    if (matchPairs.length <= 2) return;
    onChange(matchPairs.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <Label>Match Pairs</Label>
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_1fr_2rem] gap-2 text-xs font-medium text-muted-foreground">
          <span>Left</span>
          <span>Right</span>
          <span />
        </div>
        {matchPairs.map((pair, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_2rem] gap-2">
            <Input
              value={pair.left}
              onChange={(e) => updatePair(index, "left", e.target.value)}
              placeholder={`Item ${index + 1}`}
            />
            <Input
              value={pair.right}
              onChange={(e) => updatePair(index, "right", e.target.value)}
              placeholder={`Match ${index + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => removePair(index)}
              disabled={matchPairs.length <= 2}
              aria-label={`Remove pair ${index + 1}`}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addPair}>
        <Plus className="mr-1 h-3 w-3" />
        Add Pair
      </Button>
    </div>
  );
}
