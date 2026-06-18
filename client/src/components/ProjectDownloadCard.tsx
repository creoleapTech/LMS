import { File, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProjectDownloadCardProps {
  /** Public URL of the project file. */
  fileUrl: string;
  /** Display title for the project. */
  title: string;
  /** File extension label shown on the button, e.g. ".sb3" or ".leap". */
  extension?: string;
}

/**
 * Renders a download card for a project file (.sb3, .leap, etc.).
 */
export function ProjectDownloadCard({ fileUrl, title, extension = ".sb3" }: ProjectDownloadCardProps) {
  return (
    <a
      href={fileUrl}
      download
      className="flex items-center gap-4 p-6 border-2 border-dashed border-muted-foreground/25 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors group"
    >
      <div className="p-3 bg-indigo-100 dark:bg-indigo-900 rounded-xl group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800 transition-colors">
        <File className="h-8 w-8 text-indigo-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{title}</p>
        <p className="text-sm text-muted-foreground">Click to download this {extension} project</p>
      </div>
      <Button variant="outline" size="sm" className="shrink-0 gap-2">
        <Download className="h-4 w-4" />
        Download {extension}
      </Button>
    </a>
  );
}
