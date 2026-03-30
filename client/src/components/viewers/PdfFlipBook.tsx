import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PdfFlipBookProps {
  fileUrl: string;
  watermarkText?: string;
}

export function PdfFlipBook({ fileUrl, watermarkText }: PdfFlipBookProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return;

    const page = await pdfDocRef.current.getPage(pageNum);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Calculate scale to fit container
    const containerWidth = containerRef.current?.clientWidth || 800;
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min((containerWidth - 40) / viewport.width, 1.5);
    const scaledViewport = page.getViewport({ scale });

    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    await page.render({
      canvasContext: ctx,
      viewport: scaledViewport,
    }).promise;

    // Draw watermark on canvas
    if (watermarkText) {
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.font = "16px sans-serif";
      ctx.fillStyle = "#000";
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-Math.PI / 6);
      for (let y = -canvas.height; y < canvas.height; y += 120) {
        for (let x = -canvas.width; x < canvas.width; x += 250) {
          ctx.fillText(watermarkText, x, y);
        }
      }
      ctx.restore();
    }
  }, [watermarkText]);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        setLoading(true);
        setError(null);

        const pdfjsLib = await import("pdfjs-dist");

        // Set worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const doc = await pdfjsLib.getDocument(fileUrl).promise;
        if (cancelled) return;

        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load PDF");
          setLoading(false);
        }
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [fileUrl]);

  useEffect(() => {
    if (currentPage > 0 && pdfDocRef.current) {
      renderPage(currentPage);
    }
  }, [currentPage, renderPage]);

  const goToPrev = () => {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  };

  const goToNext = () => {
    if (currentPage < totalPages) setCurrentPage((p) => p + 1);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goToPrev();
      if (e.key === "ArrowRight") goToNext();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, totalPages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading PDF...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 text-destructive">
        <p>Failed to load PDF: {error}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-4">
      {/* Canvas with flip animation */}
      <div
        className="relative overflow-hidden rounded-xl shadow-2xl bg-white"
        style={{ perspective: "1200px" }}
      >
        <canvas
          ref={canvasRef}
          className="block transition-transform duration-500 ease-in-out"
          style={{
            transformStyle: "preserve-3d",
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={goToPrev}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        <span className="text-sm text-muted-foreground font-medium">
          Page {currentPage} of {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={goToNext}
          disabled={currentPage >= totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
