import { useState, useEffect, useRef, useCallback, forwardRef } from "react";
import HTMLFlipBook from "react-pageflip";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Maximize,
  Minimize,
} from "lucide-react";

interface PdfFlipBookProps {
  fileUrl: string;
  initialPage?: number;
  onPageChange?: (page: number) => void;
}

/* ─── Single page wrapper (react-pageflip requires forwardRef children) ─── */
const Page = forwardRef<HTMLDivElement, { src: string; pageNum: number; totalPages: number }>(
  ({ src, pageNum, totalPages }, ref) => (
    <div ref={ref} className="page-item" data-density="soft">
      <div className="relative w-full h-full bg-white overflow-hidden">
        <img
          src={src}
          alt={`Page ${pageNum}`}
          draggable={false}
          className="w-full h-full object-contain select-none"
          onContextMenu={(e) => e.preventDefault()}
        />
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] text-stone-400 font-medium bg-white/70 px-2 py-0.5 rounded-full">
          {pageNum} / {totalPages}
        </div>
      </div>
    </div>
  )
);
Page.displayName = "Page";

/* ─── Main Component ─── */
export function PdfFlipBook({ fileUrl, initialPage, onPageChange }: PdfFlipBookProps) {
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [renderProgress, setRenderProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 550, height: 750 });
  const [aspectRatio, setAspectRatio] = useState(1.414);
  const [usePortrait, setUsePortrait] = useState(false);

  const flipBookRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* ─── Calculate dimensions to fill available space without clipping ─── */
  const calcDimensions = useCallback((ar: number, fs: boolean) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw < 768;

    const portrait = isMobile;
    setUsePortrait(portrait);

    const navBtnWidth = isMobile ? 48 : 64;

    if (fs) {
      // Fullscreen layout budget:
      //   wrapper padding: 24px top + 24px bottom = 48px
      //   page info bar + gap: ~60px
      //   nav buttons beside book: ~64px each side + gaps
      const verticalPad = 48 + 60; // wrapper padding + page info
      const horizontalPad = navBtnWidth * 2 + 48; // nav buttons + their margins

      const availH = vh - verticalPad;
      const availW = vw - horizontalPad;

      if (portrait) {
        let h = availH;
        let w = h / ar;
        if (w > availW) { w = availW; h = w * ar; }
        setDimensions({ width: Math.round(w), height: Math.round(h) });
      } else {
        // Two-page spread: width is for one page, book doubles it
        let h = availH;
        let w = h / ar;
        if (w * 2 > availW) { w = availW / 2; h = w * ar; }
        setDimensions({ width: Math.round(w), height: Math.round(h) });
      }
    } else {
      // Normal (embedded) mode
      const uiPadX = navBtnWidth * 2 + (isMobile ? 16 : 32);
      const uiPadY = 48 + 52 + 24;
      const parentChrome = 120 + 48 + 32;
      const cardPad = isMobile ? 16 : 32;

      const availW = Math.min(vw - uiPadX - cardPad, 1400);
      const availH = vh - parentChrome - uiPadY - cardPad;

      if (portrait) {
        let h = Math.max(availH, 300);
        let w = h / ar;
        if (w > availW) { w = availW; h = w * ar; }
        setDimensions({ width: Math.round(w), height: Math.round(h) });
      } else {
        let h = Math.max(availH, 300);
        let w = h / ar;
        if (w * 2 > availW) { w = availW / 2; h = w * ar; }
        setDimensions({ width: Math.round(w), height: Math.round(h) });
      }
    }
  }, []);

  /* ─── Load PDF & render all pages to images ─── */
  useEffect(() => {
    let cancelled = false;

    async function loadAndRender() {
      try {
        setLoading(true);
        setError(null);
        setRenderProgress(0);

        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const doc = await pdfjsLib.getDocument(fileUrl).promise;
        if (cancelled) return;

        const numPages = doc.numPages;
        setTotalPages(numPages);

        // Determine page dimensions from first page
        const firstPage = await doc.getPage(1);
        const baseViewport = firstPage.getViewport({ scale: 1 });
        const ar = baseViewport.height / baseViewport.width;
        setAspectRatio(ar);

        // Higher render resolution for quality
        const renderWidth = 1200;
        const renderScale = renderWidth / baseViewport.width;

        // Calculate initial display dimensions
        calcDimensions(ar, false);

        // Render pages sequentially
        const images: string[] = [];
        for (let i = 1; i <= numPages; i++) {
          if (cancelled) return;
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: renderScale });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;

          await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
          images.push(canvas.toDataURL("image/jpeg", 0.92));

          setRenderProgress(Math.round((i / numPages) * 100));
          page.cleanup();
        }

        if (!cancelled) {
          setPageImages(images);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load PDF");
          setLoading(false);
        }
      }
    }

    loadAndRender();
    return () => { cancelled = true; };
  }, [fileUrl, calcDimensions]);

  /* ─── Navigate to initial page after flipbook is ready ─── */
  useEffect(() => {
    if (!loading && pageImages.length > 0 && initialPage && initialPage > 1) {
      const timer = setTimeout(() => {
        flipBookRef.current?.pageFlip()?.turnToPage(initialPage - 1);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, pageImages.length, initialPage]);

  /* ─── Page flip handler ─── */
  const handleFlip = useCallback(
    (e: any) => {
      const page = e.data + 1;
      setCurrentPage(e.data);
      onPageChange?.(page);
    },
    [onPageChange]
  );

  /* ─── Navigation ─── */
  const goToPrev = useCallback(() => {
    flipBookRef.current?.pageFlip()?.flipPrev();
  }, []);

  const goToNext = useCallback(() => {
    flipBookRef.current?.pageFlip()?.flipNext();
  }, []);

  /* ─── Keyboard nav ─── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goToPrev();
      if (e.key === "ArrowRight") goToNext();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goToPrev, goToNext]);

  /* ─── Fullscreen ─── */
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      wrapperRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  /* ─── Recalculate dimensions on fullscreen / resize ─── */
  useEffect(() => {
    if (!totalPages || !pageImages.length) return;

    const timer = setTimeout(() => {
      calcDimensions(aspectRatio, isFullscreen);
    }, 100);
    return () => clearTimeout(timer);
  }, [isFullscreen, totalPages, pageImages.length, aspectRatio, calcDimensions]);

  /* ─── Resize listener ─── */
  useEffect(() => {
    if (!totalPages || !pageImages.length) return;

    const handleResize = () => calcDimensions(aspectRatio, isFullscreen);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [totalPages, pageImages.length, aspectRatio, isFullscreen, calcDimensions]);

  /* ─── Content protection ─── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        e.preventDefault();
        navigator.clipboard.writeText("").catch(() => {});
      }
      if (e.ctrlKey && (e.key === "p" || e.key === "P")) e.preventDefault();
    };
    const handleBeforePrint = (e: Event) => e.preventDefault();

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("beforeprint", handleBeforePrint);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("beforeprint", handleBeforePrint);
    };
  }, []);

  /* ─── Loading state ─── */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
        <span className="text-muted-foreground font-medium">Opening book...</span>
        {renderProgress > 0 && (
          <div className="w-48">
            <div className="h-2 rounded-full neo-inset-sm overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
                style={{ width: `${renderProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center mt-1.5">
              Rendering page {Math.round((renderProgress / 100) * totalPages)} of {totalPages}
            </p>
          </div>
        )}
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

  const displayPage = currentPage + 1;

  // In fullscreen: book area is explicitly sized, centered in viewport
  // with guaranteed gaps on all sides
  const bookSpreadWidth = usePortrait ? dimensions.width : dimensions.width * 2;

  return (
    <div
      ref={wrapperRef}
      className={`pdf-book-viewer select-none ${
        isFullscreen
          ? "fixed inset-0 z-50 bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900"
          : "w-full"
      }`}
    >
      <style>{`
        @media print { .pdf-book-viewer { display: none !important; visibility: hidden !important; } }
        .stf__wrapper { box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 1px rgba(0,0,0,0.1) !important; }
      `}</style>

      <div
        ref={containerRef}
        className={`flex flex-col items-center ${
          isFullscreen
            ? "w-full h-full justify-center py-6 px-4"
            : "w-full"
        }`}
      >
        {/* Toolbar top — absolutely positioned in fullscreen */}
        <div className={`flex items-center justify-end w-full ${isFullscreen ? "absolute top-4 right-4 z-20" : "mb-3"}`}>
          <button
            onClick={toggleFullscreen}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all
                       ${isFullscreen
                         ? "bg-white/15 hover:bg-white/25 text-white shadow-lg"
                         : "neo-btn"
                       }`}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            <span className="hidden sm:inline">{isFullscreen ? "Exit" : "Fullscreen"}</span>
          </button>
        </div>

        {/* Book with navigation */}
        <div className="relative flex items-center justify-center shrink-0">
          {/* Prev button */}
          <button
            onClick={goToPrev}
            disabled={currentPage <= 0}
            className={`group relative z-10 flex items-center justify-center rounded-full
                       transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed shrink-0
                       ${isFullscreen
                         ? "w-12 h-12 md:w-14 md:h-14 -mr-2 md:-mr-4 bg-white/15 hover:bg-white/25 text-white"
                         : "w-10 h-10 md:w-12 md:h-12 -mr-1 md:-mr-3 neo-btn"
                       }`}
          >
            <ChevronLeft className={`group-hover:-translate-x-0.5 transition-transform ${isFullscreen ? "h-6 w-6 md:h-7 md:w-7" : "h-5 w-5 md:h-6 md:w-6"}`} />
          </button>

          {/* The flipbook — explicit dimensions in fullscreen */}
          <div
            className={`relative ${isFullscreen ? "" : "flex-1 neo-card p-2 md:p-4"}`}
            style={isFullscreen ? {
              width: bookSpreadWidth,
              height: dimensions.height,
            } : undefined}
          >
            <HTMLFlipBook
              ref={flipBookRef}
              width={dimensions.width}
              height={dimensions.height}
              size="stretch"
              minWidth={200}
              maxWidth={1400}
              minHeight={280}
              maxHeight={1800}
              showCover={true}
              mobileScrollSupport={false}
              flippingTime={800}
              usePortrait={usePortrait}
              startZIndex={0}
              autoSize={true}
              maxShadowOpacity={0.5}
              drawShadow={true}
              onFlip={handleFlip}
              className="flipbook-pages"
              style={{}}
              startPage={0}
              clickEventForward={false}
              useMouseEvents={true}
              swipeDistance={30}
              showPageCorners={true}
              disableFlipByClick={false}
            >
              {pageImages.map((src, i) => (
                <Page key={i} src={src} pageNum={i + 1} totalPages={totalPages} />
              ))}
            </HTMLFlipBook>
          </div>

          {/* Next button */}
          <button
            onClick={goToNext}
            disabled={currentPage >= totalPages - 1}
            className={`group relative z-10 flex items-center justify-center rounded-full
                       transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed shrink-0
                       ${isFullscreen
                         ? "w-12 h-12 md:w-14 md:h-14 -ml-2 md:-ml-4 bg-white/15 hover:bg-white/25 text-white"
                         : "w-10 h-10 md:w-12 md:h-12 -ml-1 md:-ml-3 neo-btn"
                       }`}
          >
            <ChevronRight className={`group-hover:translate-x-0.5 transition-transform ${isFullscreen ? "h-6 w-6 md:h-7 md:w-7" : "h-5 w-5 md:h-6 md:w-6"}`} />
          </button>
        </div>

        {/* Bottom page info */}
        <div
          className={`flex items-center justify-center gap-3 mt-4 px-6 py-2.5 rounded-full shrink-0
                     ${isFullscreen
                       ? "bg-white/10 border border-white/20"
                       : "neo-inset-sm"
                     }`}
        >
          <BookOpen className={`h-4 w-4 ${isFullscreen ? "text-white/70" : "text-indigo-500/60"}`} />
          <span className={`text-sm font-semibold tracking-wide ${isFullscreen ? "text-white/80" : "text-slate-600"}`}>
            Page {displayPage} of {totalPages}
          </span>
        </div>
      </div>
    </div>
  );
}
