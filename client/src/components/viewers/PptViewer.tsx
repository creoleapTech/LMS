import { useState, useEffect, useCallback, useRef } from "react";
import { Config } from "@/lib/config";
import { parsePptx, type PresentationData } from "@/lib/pptx-parser";
import { SlideRenderer } from "./SlideRenderer";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Presentation,
  AlertTriangle,
} from "lucide-react";

interface PptViewerProps {
  /** Raw storage key from the DB, e.g. "uploads/content/docs/xxx.pptx" or "drive:FILE_ID.pptx" */
  storageKey: string;
  title?: string;
  onPageChange?: (page: number) => void;
  initialPage?: number;
}

export function PptViewer({
  storageKey,
  title: _title,
  onPageChange,
  initialPage,
}: PptViewerProps) {
  const [presentation, setPresentation] = useState<PresentationData | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<"left" | "right" | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [, setControlsVisible] = useState(true);
  const viewerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch & parse PPTX
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const url = `${Config.pptPreviewUrl}${encodeURIComponent(storageKey)}&format=raw`;
        const res = await fetch(url);

        if (!res.ok) {
          throw new Error(`Failed to fetch presentation (${res.status})`);
        }

        const buffer = await res.arrayBuffer();
        if (cancelled) return;

        const data = await parsePptx(buffer);
        if (cancelled) return;

        setPresentation(data);
        const startSlide =
          initialPage && initialPage >= 1 && initialPage <= data.slides.length
            ? initialPage - 1
            : 0;
        setCurrentSlide(startSlide);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load presentation");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  // Notify parent of page change
  useEffect(() => {
    if (presentation && onPageChange) {
      onPageChange(currentSlide + 1);
    }
  }, [currentSlide, presentation, onPageChange]);

  const goToPrev = useCallback(() => {
    if (currentSlide > 0 && !isFlipping) {
      setFlipDirection("left");
      setIsFlipping(true);
      setCurrentSlide((s) => s - 1);
      setTimeout(() => {
        setIsFlipping(false);
        setFlipDirection(null);
      }, 150);
    }
  }, [currentSlide, isFlipping]);

  const goToNext = useCallback(() => {
    if (presentation && currentSlide < presentation.slides.length - 1 && !isFlipping) {
      setFlipDirection("right");
      setIsFlipping(true);
      setCurrentSlide((s) => s + 1);
      setTimeout(() => {
        setIsFlipping(false);
        setFlipDirection(null);
      }, 150);
    }
  }, [currentSlide, presentation, isFlipping]);

  // ── Fullscreen ──────────────────────────────────────────────────
  const enterFullscreen = useCallback(() => {
    if (viewerRef.current?.requestFullscreen) {
      viewerRef.current.requestFullscreen();
    }
  }, []);

  // Sync state with browser fullscreen changes (ESC key, etc.)
  useEffect(() => {
    const onChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (fs) {
        setControlsVisible(true);
        resetHideTimer();
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Auto-hide controls after 2.5s of no mouse movement in fullscreen
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 2500);
  }, []);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goToPrev();
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goToNext();
      }
      // F5 or F11 to enter presentation mode
      if ((e.key === "F5" || e.key === "F11") && !isFullscreen) {
        e.preventDefault();
        enterFullscreen();
      }
      // Escape exits fullscreen (browser handles this natively, but reset controls)
      if (e.key === "Escape" && isFullscreen) {
        setControlsVisible(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goToPrev, goToNext, isFullscreen, enterFullscreen]);

  // Block print
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
    const handleBeforePrint = (e: Event) => e.preventDefault();

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
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <span className="text-muted-foreground font-medium">Loading presentation...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3 text-destructive">
        <AlertTriangle className="h-10 w-10" />
        <p className="font-medium">Failed to load presentation</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!presentation || presentation.slides.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        <p>No slides found in this presentation.</p>
      </div>
    );
  }

  const totalSlides = presentation.slides.length;
  const slide = presentation.slides[currentSlide];

  return (
    <div className="flex flex-col items-center gap-0 select-none ppt-viewer">
      {/* Print protection */}
      <style>{`
        @media print {
          .ppt-viewer { display: none !important; visibility: hidden !important; }
        }
      `}</style>

      {/* Slide with side arrows */}
      <div className="relative flex items-center gap-0 w-full justify-center">
        {/* Left arrow */}
        <button
          onClick={goToPrev}
          disabled={currentSlide <= 0 || isFlipping}
          className="group relative z-10 flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full
                     bg-indigo-900/10 hover:bg-indigo-900/20 dark:bg-indigo-100/10 dark:hover:bg-indigo-100/20
                     text-indigo-900 dark:text-indigo-100 transition-all duration-200
                     disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-indigo-900/10
                     shadow-md hover:shadow-lg -mr-2 md:-mr-4 shrink-0"
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-6 w-6 md:h-7 md:w-7 group-hover:-translate-x-0.5 transition-transform" />
        </button>

        {/* Slide */}
        <div
          className="relative overflow-hidden w-full max-w-4xl"
        >
          <div
            className="relative bg-white dark:bg-slate-900 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.12)]
                        border border-gray-200/60 dark:border-slate-700/60"
            onContextMenu={(e) => e.preventDefault()}
          >
            <div
              className={`${isFlipping && flipDirection === "right" ? "animate-slide-next" : ""}
                ${isFlipping && flipDirection === "left" ? "animate-slide-prev" : ""}`}
            >
              <SlideRenderer
                slide={slide}
                slideWidth={presentation.slideWidth}
                slideHeight={presentation.slideHeight}
              />
            </div>
          </div>
        </div>

        {/* Right arrow */}
        <button
          onClick={goToNext}
          disabled={currentSlide >= totalSlides - 1 || isFlipping}
          className="group relative z-10 flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full
                     bg-indigo-900/10 hover:bg-indigo-900/20 dark:bg-indigo-100/10 dark:hover:bg-indigo-100/20
                     text-indigo-900 dark:text-indigo-100 transition-all duration-200
                     disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-indigo-900/10
                     shadow-md hover:shadow-lg -ml-2 md:-ml-4 shrink-0"
          aria-label="Next slide"
        >
          <ChevronRight className="h-6 w-6 md:h-7 md:w-7 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Slide info bar */}
      <div className="flex items-center justify-center gap-3 mt-4 px-6 py-2.5 rounded-full
                      bg-indigo-900/5 dark:bg-indigo-100/5 border border-indigo-200/40 dark:border-slate-600/40">
        <Presentation className="h-4 w-4 text-indigo-800/60 dark:text-indigo-200/60" />
        <span className="text-sm font-medium text-indigo-900/70 dark:text-indigo-100/70 tracking-wide">
          Slide {currentSlide + 1} of {totalSlides}
        </span>
      </div>

      {/* Thumbnail strip */}
      {totalSlides > 1 && (
        <div className="flex gap-2 mt-4 overflow-x-auto max-w-full px-4 pb-2">
          {presentation.slides.map((s, i) => (
            <button
              key={i}
              onClick={() => !isFlipping && setCurrentSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`shrink-0 w-24 rounded border-2 transition-all overflow-hidden
                ${i === currentSlide
                  ? "border-indigo-500 shadow-md scale-105"
                  : "border-transparent opacity-60 hover:opacity-90 hover:border-gray-300"
                }`}
            >
              <SlideRenderer
                slide={s}
                slideWidth={presentation.slideWidth}
                slideHeight={presentation.slideHeight}
              />
            </button>
          ))}
        </div>
      )}

      {/* Slide transition animations */}
      <style>{`
        @keyframes slideNext {
          0%   { opacity: 0.6; transform: translateX(20px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes slidePrev {
          0%   { opacity: 0.6; transform: translateX(-20px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-next {
          animation: slideNext 0.15s ease-out;
        }
        .animate-slide-prev {
          animation: slidePrev 0.15s ease-out;
        }
      `}</style>
    </div>
  );
}
