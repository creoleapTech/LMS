import { useEffect, useState } from "react";
import { File, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { detectLeapMode, getLeapLabUrl, type LeapMode } from "@/lib/leaplab";

interface LeapLabOpenButtonProps {
  /** Public URL of the `.leap` project file. */
  fileUrl: string;
  /** Display title for the project. */
  title: string;
}

/**
 * Renders a card that opens a `.leap` project in LeapLab.
 *
 * The component attempts to read the project mode so the button label can
 * reflect whether it will open in LeapLab Ignite (junior) or LeapLab Embed
 * (intermediate). If detection fails, a generic "Open in LeapLab" label is
 * shown and LeapLab itself will route to the correct editor.
 */
export function LeapLabOpenButton({ fileUrl, title }: LeapLabOpenButtonProps) {
  const [mode, setMode] = useState<LeapMode | null>(null);
  const [detecting, setDetecting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setDetecting(true);
    detectLeapMode(fileUrl)
      .then((detected) => {
        if (!cancelled) {
          setMode(detected);
          setDetecting(false);
        }
      })
      .catch(() => {
        if (!cancelled) setDetecting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  const leapUrl = getLeapLabUrl(fileUrl);

  const buttonLabel = detecting
    ? "Detecting mode…"
    : mode === "junior"
      ? "Open in LeapLab Ignite"
      : mode === "intermediate"
        ? "Open in LeapLab Embed"
        : "Open in LeapLab";

  const description = detecting
    ? "Reading LeapLab project mode…"
    : mode === "junior"
      ? "Junior block-coding workspace"
      : mode === "intermediate"
        ? "Intermediate embedded programming workspace"
        : "Open in LeapLab to view and edit";

  return (
    <a
      href={leapUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 p-6 border-2 border-dashed border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl hover:border-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-colors group"
    >
      <div className="p-3 bg-indigo-100 dark:bg-indigo-900 rounded-xl group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800 transition-colors">
        <File className="h-8 w-8 text-indigo-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button variant="default" size="sm" className="shrink-0 gap-2" disabled={detecting}>
        {detecting && <Loader2 className="h-4 w-4 animate-spin" />}
        {buttonLabel}
      </Button>
    </a>
  );
}
