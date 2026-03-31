import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, ChevronLeft, ChevronRight, BookOpen, Maximize, Minimize } from "lucide-react";

interface PdfFlipBookProps {
  fileUrl: string;
  initialPage?: number;
  onPageChange?: (page: number) => void;
}

export function PdfFlipBook({ fileUrl, initialPage, onPageChange }: PdfFlipBookProps) {
  // For two-page spread: currentSpread is the left page number (1, 3, 5, ...)
  // Spread 0 shows pages 1-2, spread 1 shows pages 3-4, etc.
  const [currentSpread, setCurrentSpread] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<"next" | "prev" | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);
  const flipCanvasRef = useRef<HTMLCanvasElement>(null);
  const flipBackCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bookWrapperRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);

  // Get page numbers for current spread
  const getSpreadPages = useCallback((spread: number) => {
    const leftPage = spread * 2 + 1;
    const rightPage = spread * 2 + 2;
    return { leftPage, rightPage };
  }, []);

  const renderPageToCanvas = useCallback(async (pageNum: number, canvas: HTMLCanvasElement | null) => {
    if (!pdfDocRef.current || !canvas || pageNum < 1 || pageNum > totalPages) {
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      return;
    }

    const page = await pdfDocRef.current.getPage(pageNum);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const containerWidth = containerRef.current?.clientWidth || 900;
    const containerHeight = containerRef.current?.clientHeight || 700;
    const viewport = page.getViewport({ scale: 1 });

    // Calculate scale based on available space
    let pageWidth: number;
    let pageHeight: number;

    if (isFullscreen) {
      // In fullscreen, use more of the available space
      const maxPageWidth = (containerWidth - 150) / 2;
      const maxPageHeight = containerHeight - 120;
      const scaleByWidth = maxPageWidth / viewport.width;
      const scaleByHeight = maxPageHeight / viewport.height;
      const scale = Math.min(scaleByWidth, scaleByHeight, 2.5);
      const scaledViewport = page.getViewport({ scale });
      pageWidth = scaledViewport.width;
      pageHeight = scaledViewport.height;
      canvas.width = pageWidth;
      canvas.height = pageHeight;
      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
    } else {
      pageWidth = Math.min((containerWidth - 100) / 2, 400);
      const scale = pageWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
    }
  }, [totalPages, isFullscreen]);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        setLoading(true);
        setError(null);

        const pdfjsLib = await import("pdfjs-dist");

        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const doc = await pdfjsLib.getDocument(fileUrl).promise;
        if (cancelled) return;

        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);

        // Calculate initial spread based on initialPage
        if (initialPage && initialPage >= 1 && initialPage <= doc.numPages) {
          setCurrentSpread(Math.floor((initialPage - 1) / 2));
        } else {
          setCurrentSpread(0);
        }
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

  // Render current spread pages
  useEffect(() => {
    if (!pdfDocRef.current || loading) return;

    const { leftPage, rightPage } = getSpreadPages(currentSpread);
    renderPageToCanvas(leftPage, leftCanvasRef.current);
    renderPageToCanvas(rightPage, rightCanvasRef.current);
  }, [currentSpread, loading, getSpreadPages, renderPageToCanvas, isFullscreen]);

  // Re-render on fullscreen change
  useEffect(() => {
    if (!pdfDocRef.current || loading) return;
    // Small delay to allow container to resize
    const timer = setTimeout(() => {
      const { leftPage, rightPage } = getSpreadPages(currentSpread);
      renderPageToCanvas(leftPage, leftCanvasRef.current);
      renderPageToCanvas(rightPage, rightCanvasRef.current);
    }, 100);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  useEffect(() => {
    if (!loading && onPageChange) {
      const { leftPage } = getSpreadPages(currentSpread);
      onPageChange(leftPage);
    }
  }, [currentSpread, loading, onPageChange, getSpreadPages]);

  const totalSpreads = Math.ceil(totalPages / 2);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      bookWrapperRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen change (user might press ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const goToPrev = async () => {
    if (currentSpread > 0 && !isFlipping) {
      setFlipDirection("prev");
      setIsFlipping(true);

      // Render the page that will flip (current left page back, and previous right page front)
      const prevSpread = currentSpread - 1;
      const { rightPage: prevRight } = getSpreadPages(prevSpread);
      const { leftPage: currLeft } = getSpreadPages(currentSpread);

      await renderPageToCanvas(currLeft, flipCanvasRef.current);
      await renderPageToCanvas(prevRight, flipBackCanvasRef.current);

      setTimeout(() => {
        setCurrentSpread(prevSpread);
        setTimeout(() => {
          setIsFlipping(false);
          setFlipDirection(null);
        }, 100);
      }, 800);
    }
  };

  const goToNext = async () => {
    if (currentSpread < totalSpreads - 1 && !isFlipping) {
      setFlipDirection("next");
      setIsFlipping(true);

      // Render the page that will flip (current right page, and next left page on back)
      const nextSpread = currentSpread + 1;
      const { rightPage: currRight } = getSpreadPages(currentSpread);
      const { leftPage: nextLeft } = getSpreadPages(nextSpread);

      await renderPageToCanvas(currRight, flipCanvasRef.current);
      await renderPageToCanvas(nextLeft, flipBackCanvasRef.current);

      setTimeout(() => {
        setCurrentSpread(nextSpread);
        setTimeout(() => {
          setIsFlipping(false);
          setFlipDirection(null);
        }, 100);
      }, 800);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goToPrev();
      if (e.key === "ArrowRight") goToNext();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentSpread, totalSpreads, isFlipping]);

  // Block print & screenshots
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        e.preventDefault();
        navigator.clipboard.writeText("").catch(() => {});
      }
      if (e.ctrlKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
      }
    };

    const handleBeforePrint = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("beforeprint", handleBeforePrint);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("beforeprint", handleBeforePrint);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-amber-700" />
        <span className="text-muted-foreground font-medium">Opening book...</span>
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

  const { leftPage, rightPage } = getSpreadPages(currentSpread);

  return (
    <div
      ref={bookWrapperRef}
      className={`pdf-book-viewer select-none ${
        isFullscreen
          ? "fixed inset-0 z-50 bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 flex items-center justify-center"
          : ""
      }`}
    >
      <div
        ref={containerRef}
        className={`flex flex-col items-center gap-0 ${isFullscreen ? "w-full h-full p-4" : ""}`}
      >
        {/* Print protection CSS */}
        <style>{`
          @media print {
            .pdf-book-viewer { display: none !important; visibility: hidden !important; }
          }
        `}</style>

        {/* Fullscreen toggle button */}
        <div className={`flex justify-end w-full ${isFullscreen ? "absolute top-4 right-4 z-20" : "mb-2"}`}>
          <button
            onClick={toggleFullscreen}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg
                       transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md
                       ${isFullscreen
                         ? "bg-white/15 hover:bg-white/25 text-white"
                         : "bg-amber-900/10 hover:bg-amber-900/20 dark:bg-amber-100/10 dark:hover:bg-amber-100/20 text-amber-900 dark:text-amber-100"
                       }`}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <>
                <Minimize className="h-4 w-4" />
                <span className="hidden sm:inline">Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize className="h-4 w-4" />
                <span className="hidden sm:inline">Fullscreen</span>
              </>
            )}
          </button>
        </div>

        {/* Book wrapper with side arrows */}
        <div className={`relative flex items-center gap-0 w-full justify-center ${isFullscreen ? "flex-1" : ""}`}>
          {/* Left arrow */}
          <button
            onClick={goToPrev}
            disabled={currentSpread <= 0 || isFlipping}
            className={`group relative z-10 flex items-center justify-center rounded-full
                       transition-all duration-200
                       disabled:opacity-20 disabled:cursor-not-allowed
                       shadow-md hover:shadow-lg shrink-0
                       ${isFullscreen
                         ? "w-16 h-16 -mr-4 bg-white/15 hover:bg-white/25 text-white disabled:hover:bg-white/15"
                         : "w-12 h-12 md:w-14 md:h-14 -mr-2 md:-mr-4 bg-amber-900/10 hover:bg-amber-900/20 dark:bg-amber-100/10 dark:hover:bg-amber-100/20 text-amber-900 dark:text-amber-100 disabled:hover:bg-amber-900/10"
                       }`}
            aria-label="Previous page"
          >
            <ChevronLeft className={`group-hover:-translate-x-0.5 transition-transform ${isFullscreen ? "h-8 w-8" : "h-6 w-6 md:h-7 md:w-7"}`} />
          </button>

          {/* Book */}
          <div
            className="relative"
            style={{ perspective: "2000px" }}
          >
            {/* Book cover shadow & spine effect */}
            <div className={`relative bg-gradient-to-b from-amber-50 to-amber-100/80 dark:from-stone-800 dark:to-stone-900
                            rounded-sm shadow-[0_0_25px_rgba(0,0,0,0.2),_0_10px_40px_rgba(0,0,0,0.15)]
                            border border-amber-200/60 dark:border-stone-600/60
                            ${isFullscreen ? "p-4 md:p-8" : "p-3 sm:p-4 md:p-6"}`}>

              {/* Two-page spread container */}
              <div className="flex items-stretch" style={{ transformStyle: "preserve-3d" }}>
                {/* Left Page */}
                <div className="relative bg-white dark:bg-stone-100 rounded-l-sm overflow-hidden
                                shadow-[inset_-2px_0_8px_rgba(0,0,0,0.08)]">
                  {/* Page edge effect */}
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-r from-amber-200/60 to-transparent dark:from-stone-300/40" />

                  <canvas
                    ref={leftCanvasRef}
                    className="block"
                    style={{ maxWidth: "100%", height: "auto", minHeight: isFullscreen ? "400px" : "300px", minWidth: isFullscreen ? "280px" : "200px" }}
                    onContextMenu={(e) => e.preventDefault()}
                  />

                  {/* Page number */}
                  {leftPage <= totalPages && (
                    <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 text-stone-400 font-medium ${isFullscreen ? "text-sm" : "text-xs"}`}>
                      {leftPage}
                    </div>
                  )}
                </div>

                {/* Center spine */}
                <div className={`relative bg-gradient-to-r from-amber-200 via-amber-300 to-amber-200
                                dark:from-stone-500 dark:via-stone-400 dark:to-stone-500
                                shadow-[inset_0_0_8px_rgba(0,0,0,0.2)] ${isFullscreen ? "w-[12px]" : "w-[8px]"}`}>
                  {/* Spine highlight */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-white/10" />
                </div>

                {/* Right Page */}
                <div className="relative bg-white dark:bg-stone-100 rounded-r-sm overflow-hidden
                                shadow-[inset_2px_0_8px_rgba(0,0,0,0.08)]">
                  {/* Page edge effect */}
                  <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-gradient-to-l from-amber-200/60 to-transparent dark:from-stone-300/40" />

                  <canvas
                    ref={rightCanvasRef}
                    className="block"
                    style={{ maxWidth: "100%", height: "auto", minHeight: isFullscreen ? "400px" : "300px", minWidth: isFullscreen ? "280px" : "200px" }}
                    onContextMenu={(e) => e.preventDefault()}
                  />

                  {/* Page number */}
                  {rightPage <= totalPages && (
                    <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 text-stone-400 font-medium ${isFullscreen ? "text-sm" : "text-xs"}`}>
                      {rightPage}
                    </div>
                  )}

                  {/* Subtle page curl shadow in corner */}
                  <div className="absolute bottom-0 right-0 w-16 h-16 bg-gradient-to-tl from-black/[0.04] to-transparent
                                  dark:from-black/[0.08] rounded-tl-3xl pointer-events-none" />
                </div>
              </div>

            {/* Flipping page overlay - for "next" animation */}
            {isFlipping && flipDirection === "next" && (
              <div className="absolute top-3 sm:top-4 md:top-6 right-3 sm:right-4 md:right-6 bottom-3 sm:bottom-4 md:bottom-6 flip-page-container"
                   style={{
                     width: `calc(50% - 4px)`,
                     transformStyle: "preserve-3d",
                     transformOrigin: "left center",
                     animation: "flipPageNext 0.8s cubic-bezier(0.4, 0.0, 0.2, 1) forwards",
                     zIndex: 10,
                   }}>
                {/* Front of flipping page (current right page) */}
                <div className="absolute inset-0 backface-hidden bg-white dark:bg-stone-100 rounded-r-sm overflow-hidden">
                  <canvas
                    ref={flipCanvasRef}
                    className="block"
                    style={{ maxWidth: "100%", height: "auto" }}
                  />
                  {/* Page curl shadow */}
                  <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/10 to-transparent pointer-events-none" />
                </div>
                {/* Back of flipping page (next left page) */}
                <div className="absolute inset-0 backface-hidden bg-white dark:bg-stone-100 rounded-l-sm overflow-hidden"
                     style={{ transform: "rotateY(180deg)" }}>
                  <canvas
                    ref={flipBackCanvasRef}
                    className="block"
                    style={{ maxWidth: "100%", height: "auto" }}
                  />
                  {/* Page curl shadow */}
                  <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/10 to-transparent pointer-events-none" />
                </div>
              </div>
            )}

            {/* Flipping page overlay - for "prev" animation */}
            {isFlipping && flipDirection === "prev" && (
              <div className="absolute top-3 sm:top-4 md:top-6 left-3 sm:left-4 md:left-6 bottom-3 sm:bottom-4 md:bottom-6 flip-page-container"
                   style={{
                     width: `calc(50% - 4px)`,
                     transformStyle: "preserve-3d",
                     transformOrigin: "right center",
                     animation: "flipPagePrev 0.8s cubic-bezier(0.4, 0.0, 0.2, 1) forwards",
                     zIndex: 10,
                   }}>
                {/* Front of flipping page (current left page) */}
                <div className="absolute inset-0 backface-hidden bg-white dark:bg-stone-100 rounded-l-sm overflow-hidden">
                  <canvas
                    ref={flipCanvasRef}
                    className="block"
                    style={{ maxWidth: "100%", height: "auto" }}
                  />
                  {/* Page curl shadow */}
                  <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/10 to-transparent pointer-events-none" />
                </div>
                {/* Back of flipping page (previous right page) */}
                <div className="absolute inset-0 backface-hidden bg-white dark:bg-stone-100 rounded-r-sm overflow-hidden"
                     style={{ transform: "rotateY(-180deg)" }}>
                  <canvas
                    ref={flipBackCanvasRef}
                    className="block"
                    style={{ maxWidth: "100%", height: "auto" }}
                  />
                  {/* Page curl shadow */}
                  <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/10 to-transparent pointer-events-none" />
                </div>
              </div>
            )}

            {/* Page stack effect (bottom) */}
            <div className="absolute bottom-[1px] left-6 right-6 h-[4px]
                            bg-gradient-to-t from-amber-200/60 to-transparent
                            dark:from-stone-600/60" />
          </div>
        </div>

        {/* Right arrow */}
        <button
          onClick={goToNext}
          disabled={currentSpread >= totalSpreads - 1 || isFlipping}
          className={`group relative z-10 flex items-center justify-center rounded-full
                     transition-all duration-200
                     disabled:opacity-20 disabled:cursor-not-allowed
                     shadow-md hover:shadow-lg shrink-0
                     ${isFullscreen
                       ? "w-16 h-16 -ml-4 bg-white/15 hover:bg-white/25 text-white disabled:hover:bg-white/15"
                       : "w-12 h-12 md:w-14 md:h-14 -ml-2 md:-ml-4 bg-amber-900/10 hover:bg-amber-900/20 dark:bg-amber-100/10 dark:hover:bg-amber-100/20 text-amber-900 dark:text-amber-100 disabled:hover:bg-amber-900/10"
                     }`}
          aria-label="Next page"
        >
          <ChevronRight className={`group-hover:translate-x-0.5 transition-transform ${isFullscreen ? "h-8 w-8" : "h-6 w-6 md:h-7 md:w-7"}`} />
        </button>
      </div>

      {/* Page info bar */}
      <div className={`flex items-center justify-center gap-3 mt-4 px-6 py-2.5 rounded-full
                      ${isFullscreen
                        ? "bg-white/10 border border-white/20"
                        : "bg-amber-900/5 dark:bg-amber-100/5 border border-amber-200/40 dark:border-stone-600/40"
                      }`}>
        <BookOpen className={`h-4 w-4 ${isFullscreen ? "text-white/70" : "text-amber-800/60 dark:text-amber-200/60"}`} />
        <span className={`text-sm font-medium tracking-wide ${isFullscreen ? "text-white/80" : "text-amber-900/70 dark:text-amber-100/70"}`}>
          Pages {leftPage}{rightPage <= totalPages ? `-${rightPage}` : ""} of {totalPages}
        </span>
      </div>

      {/* Flip animation keyframes */}
      <style>{`
        @keyframes flipPageNext {
          0% {
            transform: perspective(2000px) rotateY(0deg) scale(1);
            box-shadow: 0 0 0 rgba(0,0,0,0);
          }
          25% {
            transform: perspective(2000px) rotateY(-45deg) scale(1.02);
            box-shadow: -10px 0 30px rgba(0,0,0,0.2);
          }
          50% {
            transform: perspective(2000px) rotateY(-90deg) scale(1.04);
            box-shadow: -20px 0 50px rgba(0,0,0,0.3);
          }
          75% {
            transform: perspective(2000px) rotateY(-135deg) scale(1.02);
            box-shadow: -10px 0 30px rgba(0,0,0,0.2);
          }
          100% {
            transform: perspective(2000px) rotateY(-180deg) scale(1);
            box-shadow: 0 0 0 rgba(0,0,0,0);
          }
        }
        @keyframes flipPagePrev {
          0% {
            transform: perspective(2000px) rotateY(0deg) scale(1);
            box-shadow: 0 0 0 rgba(0,0,0,0);
          }
          25% {
            transform: perspective(2000px) rotateY(45deg) scale(1.02);
            box-shadow: 10px 0 30px rgba(0,0,0,0.2);
          }
          50% {
            transform: perspective(2000px) rotateY(90deg) scale(1.04);
            box-shadow: 20px 0 50px rgba(0,0,0,0.3);
          }
          75% {
            transform: perspective(2000px) rotateY(135deg) scale(1.02);
            box-shadow: 10px 0 30px rgba(0,0,0,0.2);
          }
          100% {
            transform: perspective(2000px) rotateY(180deg) scale(1);
            box-shadow: 0 0 0 rgba(0,0,0,0);
          }
        }
        .backface-hidden {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .flip-page-container {
          transform-style: preserve-3d;
        }
        .flip-page-container::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to right, rgba(0,0,0,0.15) 0%, transparent 10%, transparent 90%, rgba(0,0,0,0.1) 100%);
          pointer-events: none;
          z-index: 5;
        }
      `}</style>
      </div>
    </div>
  );
}
