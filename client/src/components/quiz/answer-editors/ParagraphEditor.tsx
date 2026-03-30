import { MessageSquareText } from "lucide-react";

export function ParagraphEditor() {
  return (
    <div className="flex items-start gap-3 rounded-md border border-dashed p-4 text-muted-foreground">
      <MessageSquareText className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="space-y-1 text-sm">
        <p className="font-medium text-foreground">Paragraph Response</p>
        <p>
          Students will type a paragraph response. Manual grading required.
        </p>
      </div>
    </div>
  );
}
