import {
  useState, useEffect, useCallback, useRef, useMemo,
  forwardRef, useImperativeHandle,
} from "react";
import { Config } from "@/lib/config";
import {
  parsePptxProgressive,
  type PresentationData,
  type SlideData,
} from "@/lib/pptx-parser";
import { SlideRenderer } from "./SlideRenderer";
import { PdfFlipBook } from "./PdfFlipBook";
import { buildWatermarkDataUrl } from "../../lib/watermarkUtils";
import { SmartBoardZoomContainer } from "./SmartBoardZoom";
import { AnnotationCanvas, type AnnotationCanvasHandle } from "./AnnotationCanvas";
import { AnnotationToolbar } from "./AnnotationToolbar";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Presentation,
  AlertTriangle,
  Minimize,
} from "lucide-react";

export interface PptViewerHandle {
  toggleFullscreen: () => void;
  isFullscreen: boolean;
}

interface PptViewerProps {
  storageKey: string;
  title?: string;
  onPageChange?: (page: number) => void;
  onFullscreenChange?: (fs: boolean) => void;
  initialPage?: number;
  watermarkText?: string;
  /** When true, trainer annotation UI is shown */
  enableAnnotation?: boolean;
  /** When false, zoom controls are hidden (preview mode) */
  enableZoom?: boolean;
}

export const LegacyPptViewer = forwardRef<PptViewerHandle, PptViewerProps>(
  function LegacyPptViewer(
    { storageKey, title: _title, onPageChange, onFullscreenChange, initialPage, watermarkText, enableAnnotation, enableZoom = true },
    ref,
  ) {
    const [presentation, setPresentation]   = useState<PresentationData | null>(null);
    const [currentSlide, setCurrentSlide]   = useState(0);
    const [loading, setLoading]             = useState(true);
    const [error, setError]                 = useState<string | null>(null);
    const [isFlipping, setIsFlipping]       = useState(false);
    const [flipDirection, setFlipDirection] = useState<"left" | "right" | null>(null);
    const [loadedSlideIndexes, setLoadedSlideIndexes]           = useState<Set<number>>(new Set());
    const [renderedThumbnailIndexes, setRenderedThumbnailIndexes] = useState<Set<number>>(new Set());
    const [isFullscreen, setIsFullscreen]   = useState(false);

    const viewerRef      = useRef<HTMLDivElement>(null);
    const hideTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flushFrameRef  = useRef<number | null>(null);
    const pendingSlidesRef = useRef<Map<number, SlideData>>(new Map());
    const startSlideRef  = useRef(0);
    const totalSlidesRef = useRef(0);

    const watermarkBg = useMemo(
      () => (watermarkText ? buildWatermarkDataUrl(watermarkText) : null),
      [watermarkText],
    );

    /* ─── Annotation (trainer only) — cleared on page change via pageKey ─── */
    const [isAnnotating, setIsAnnotating] = useState(false);
    const [annoColor, setAnnoColor] = useState("#ff1a1a");
    const [annoWidth, setAnnoWidth] = useState(3);
    const [isEraser, setIsEraser] = useState(false);
    const annoRef = useRef<AnnotationCanvasHandle>(null);
    const handleClearAnno = useCallback(() => annoRef.current?.clear(), []);

    /* ─── Bookmark open states — click to toggle (fullscreen only) ─── */
    const [annoBarOpen, setAnnoBarOpen] = useState(false);
    const [bottomBarOpen, setBottomBarOpen] = useState(false);

    /* ─── Expose handle ─── */
    const toggleFullscreen = useCallback(() => {
      if (!document.fullscreenElement) {
        viewerRef.current?.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    }, []);

    useImperativeHandle(ref, () => ({ toggleFullscreen, isFullscreen }), [
      toggleFullscreen, isFullscreen,
    ]);

    /* ─── Slide flush ─── */
    const scheduleSlideFlush = useCallback(() => {
      if (flushFrameRef.current !== null) return;
      flushFrameRef.current = requestAnimationFrame(() => {
        flushFrameRef.current = null;
        const pending = pendingSlidesRef.current;
        if (pending.size === 0) return;

        // Snapshot the pending map and clear it before the setState call
        // so new slides arriving during the render don't get lost.
        const toFlush = new Map(pending);
        pending.clear();

        setPresentation((prev) => {
          // prev can be null if onMeta's setState hasn't committed yet.
          // In that case put the slides back and reschedule — they'll be
          // picked up on the next frame once presentation is initialised.
          if (!prev) {
            for (const [i, s] of toFlush) pendingSlidesRef.current.set(i, s);
            // Reschedule without the guard so it runs next frame
            requestAnimationFrame(() => {
              const p2 = pendingSlidesRef.current;
              if (p2.size === 0) return;
              const t2 = new Map(p2); p2.clear();
              setPresentation((prev2) => {
                if (!prev2) return prev2;
                const next = prev2.slides.slice();
                for (const [i, s] of t2) next[i] = s;
                return { ...prev2, slides: next };
              });
            });
            return prev;
          }
          const next = prev.slides.slice();
          for (const [i, s] of toFlush) next[i] = s;
          return { ...prev, slides: next };
        });
      });
    }, []);

    const createPlaceholderSlide = useCallback(
      (): SlideData => ({ background: { type: "solid", color: "#FFFFFF" }, elements: [] }),
      [],
    );

    /* ─── Load PPTX ─── */
    useEffect(() => {
      let cancelled = false;
      const abortController = new AbortController();

      setPresentation(null);
      setLoadedSlideIndexes(new Set());
      setRenderedThumbnailIndexes(new Set());
      pendingSlidesRef.current.clear();
      totalSlidesRef.current = 0;
      startSlideRef.current  = 0;

      async function load() {
        try {
          setLoading(true);
          setError(null);

          const url = `${Config.pptPreviewUrl}${encodeURIComponent(storageKey)}&format=raw`;
          const res = await fetch(url);

          if (!res.ok) {
            let msg = "";
            try { const b = await res.json(); if (typeof b?.message === "string") msg = b.message; } catch {}
            if (res.status === 501) throw new Error(msg || "PPT preview is not enabled on this server.");
            if (res.status === 503) throw new Error(msg || "File storage is not configured on the server.");
            throw new Error(msg || `Failed to fetch presentation (${res.status})`);
          }

          const buffer = await res.arrayBuffer();
          if (cancelled) return;

          await parsePptxProgressive(buffer, {
            signal: abortController.signal,
            concurrency: 2,
            onMeta: (meta) => {
              if (cancelled) return;
              console.log("[PptViewer] onMeta:", meta.slideCount, "slides", meta.slideWidth, "x", meta.slideHeight);
              const placeholders = Array.from({ length: meta.slideCount }, () => createPlaceholderSlide());
              const startSlide = initialPage && initialPage >= 1 && initialPage <= meta.slideCount
                ? initialPage - 1 : 0;
              startSlideRef.current  = startSlide;
              totalSlidesRef.current = meta.slideCount;
              setPresentation({ slideWidth: meta.slideWidth, slideHeight: meta.slideHeight, slides: placeholders });
              setCurrentSlide(startSlide);
              if (meta.slideCount === 0) setLoading(false);
            },
            onSlide: ({ index, slide }) => {
              if (cancelled) return;
              console.log("[PptViewer] onSlide index:", index, "elements:", slide.elements.length, "bg:", slide.background?.type);

              // Apply the start slide immediately (direct setState) so the
              // viewer never shows a blank placeholder on first render.
              // All other slides go through the rAF batch for performance.
              if (index === startSlideRef.current) {
                setPresentation((prev) => {
                  if (!prev) {
                    console.warn("[PptViewer] presentation not ready for start slide, queuing");
                    pendingSlidesRef.current.set(index, slide);
                    scheduleSlideFlush();
                    return prev;
                  }
                  const next = prev.slides.slice();
                  next[index] = slide;
                  return { ...prev, slides: next };
                });
                setLoadedSlideIndexes((prev) => {
                  const next = new Set(prev); next.add(index); return next;
                });
                // Defer setLoading(false) by one frame so the slide state
                // has committed before we exit the loading screen.
                requestAnimationFrame(() => {
                  if (!cancelled) setLoading(false);
                });
              } else {
                pendingSlidesRef.current.set(index, slide);
                scheduleSlideFlush();
                setLoadedSlideIndexes((prev) => {
                  if (prev.has(index)) return prev;
                  const next = new Set(prev); next.add(index); return next;
                });
              }
            },
          });

          if (!cancelled) {
            // final flush already done via onSlide; just ensure loading is off
            setLoading(false);
          }
        } catch (err: any) {
          if (!cancelled && err?.message !== "PPT parse aborted") {
            setError(err.message || "Failed to load presentation");
          }
        } finally {
          if (!cancelled && totalSlidesRef.current === 0) setLoading(false);
        }
      }

      load();
      return () => {
        cancelled = true;
        abortController.abort();
        if (flushFrameRef.current !== null) { cancelAnimationFrame(flushFrameRef.current); flushFrameRef.current = null; }
        pendingSlidesRef.current.clear();
      };
    }, [storageKey, initialPage, createPlaceholderSlide, scheduleSlideFlush]);

    /* ─── Notify parent of page change ─── */
    useEffect(() => {
      if (presentation && onPageChange) onPageChange(currentSlide + 1);
    }, [currentSlide, presentation, onPageChange]);

    /* ─── Thumbnail window ─── */
    useEffect(() => {
      if (!presentation || presentation.slides.length === 0) return;
      setRenderedThumbnailIndexes((prev) => {
        const next = new Set(prev);
        const total = presentation.slides.length;
        for (let i = Math.max(0, currentSlide - 2); i <= Math.min(total - 1, currentSlide + 2); i++) next.add(i);
        next.add(0); next.add(total - 1);
        return next;
      });
    }, [currentSlide, presentation]);

    /* ─── Navigation ─── */
    const goToPrev = useCallback(() => {
      if (currentSlide > 0 && !isFlipping) {
        setFlipDirection("left"); setIsFlipping(true);
        setCurrentSlide((s) => s - 1);
        setTimeout(() => { setIsFlipping(false); setFlipDirection(null); }, 150);
      }
    }, [currentSlide, isFlipping]);

    const goToNext = useCallback(() => {
      if (presentation && currentSlide < presentation.slides.length - 1 &&
          loadedSlideIndexes.has(currentSlide + 1) && !isFlipping) {
        setFlipDirection("right"); setIsFlipping(true);
        setCurrentSlide((s) => s + 1);
        setTimeout(() => { setIsFlipping(false); setFlipDirection(null); }, 150);
      }
    }, [currentSlide, presentation, loadedSlideIndexes, isFlipping]);

    /* ─── Fullscreen sync ─── */
    useEffect(() => {
      const onChange = () => {
        const fs = !!document.fullscreenElement;
        setIsFullscreen(fs);
        // Annotation UI lives in fullscreen only — reset when exiting
        if (!fs) { setIsAnnotating(false); setIsEraser(false); setAnnoBarOpen(false); setBottomBarOpen(false); }
        onFullscreenChange?.(fs);
      };
      document.addEventListener("fullscreenchange", onChange);
      return () => document.removeEventListener("fullscreenchange", onChange);
    }, [onFullscreenChange]);

    /* ─── Auto-hide timer cleanup ─── */
    useEffect(() => () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); }, []);

    /* ─── Keyboard ─── */
    useEffect(() => {
      const h = (e: KeyboardEvent) => {
        if (e.key === "ArrowLeft") goToPrev();
        if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goToNext(); }
        if ((e.key === "F5" || e.key === "F11") && !isFullscreen) { e.preventDefault(); toggleFullscreen(); }
      };
      document.addEventListener("keydown", h);
      return () => document.removeEventListener("keydown", h);
    }, [goToPrev, goToNext, isFullscreen, toggleFullscreen]);

    /* ─── Print protection ─── */
    useEffect(() => {
      const h = (e: KeyboardEvent) => {
        if (e.key === "PrintScreen") { e.preventDefault(); navigator.clipboard.writeText("").catch(() => {}); }
        if (e.ctrlKey && (e.key === "p" || e.key === "P")) e.preventDefault();
      };
      const bp = (e: Event) => e.preventDefault();
      document.addEventListener("keydown", h);
      window.addEventListener("beforeprint", bp);
      return () => { document.removeEventListener("keydown", h); window.removeEventListener("beforeprint", bp); };
    }, []);

    /* ─── Shared watermark overlay ─── */
    const WatermarkOverlay = watermarkBg && isFullscreen ? (
      <div
        aria-hidden="true"
        style={{
          position: "fixed", inset: 0,
          pointerEvents: "none", zIndex: 30,
          backgroundImage: `url(${watermarkBg})`,
          backgroundRepeat: "repeat",
          backgroundSize: "320px 160px",
        }}
      />
    ) : null;

    /* ─── Loading ─── */
    if (loading) {
      return (
        <div ref={viewerRef} className="flex flex-col items-center gap-0 select-none ppt-viewer">
          {WatermarkOverlay}
          <div className="flex flex-col items-center justify-center h-96 gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
            <span className="text-muted-foreground font-medium">Loading presentation...</span>
          </div>
        </div>
      );
    }

    /* ─── Error ─── */
    if (error) {
      return (
        <div ref={viewerRef} className="flex flex-col items-center gap-0 select-none ppt-viewer">
          {WatermarkOverlay}
          <div className="flex flex-col items-center justify-center h-96 gap-3 text-destructive">
            <AlertTriangle className="h-10 w-10" />
            <p className="font-medium">Failed to load presentation</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      );
    }

    /* ─── Empty ─── */
    if (!presentation || presentation.slides.length === 0) {
      return (
        <div ref={viewerRef} className="flex flex-col items-center gap-0 select-none ppt-viewer">
          {WatermarkOverlay}
          <div className="flex items-center justify-center h-96 text-muted-foreground">
            <p>No slides found in this presentation.</p>
          </div>
        </div>
      );
    }

    const totalSlides = presentation.slides.length;
    const slide       = presentation.slides[currentSlide];

    /* ─── Fullscreen layout — edge-to-edge, no black bars, overlay slide selector ─── */
    if (isFullscreen) {
      return (
        <div
          ref={viewerRef}
          className="select-none ppt-viewer fixed inset-0 z-50 flex flex-col bg-[#f8fafc] dark:bg-slate-900"
        >
          <style>{`@media print { .ppt-viewer { display: none !important; } }`}</style>
          {WatermarkOverlay}

          {/* Exit button */}
          <div className="absolute top-4 right-4 z-40">
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium
                         bg-slate-900/80 hover:bg-black text-white shadow-lg transition-all border border-white/10 backdrop-blur"
            >
              <Minimize className="h-4 w-4" />
              <span className="hidden sm:inline">Exit</span>
            </button>
          </div>

          {/* Slide area — true fullscreen, slide fills viewport with no black bars.
              Canvas is OUTSIDE zoom so drawing stays at screen coords while zooming (no offset) */}
          <div className="flex-1 relative flex items-center justify-center min-h-0 p-0 overflow-hidden">
            <div
              className="relative w-full h-full max-w-full max-h-full"
              style={{ aspectRatio: `${presentation.slideWidth} / ${presentation.slideHeight}`, maxWidth: "100%", maxHeight: "100%" }}
              onContextMenu={(e) => e.preventDefault()}
            >
              {enableZoom === false ? (
                <div className={`absolute inset-0 ${isFlipping && flipDirection === "right" ? "animate-slide-next" : ""} ${isFlipping && flipDirection === "left" ? "animate-slide-prev" : ""}`}>
                  <SlideRenderer
                    slide={slide}
                    slideWidth={presentation.slideWidth}
                    slideHeight={presentation.slideHeight}
                  />
                </div>
              ) : (
                <SmartBoardZoomContainer className="absolute inset-0 w-full h-full flex items-center justify-center" disabled={false} sideFloating>
                  <div className={`w-full h-full ${isFlipping && flipDirection === "right" ? "animate-slide-next" : ""} ${isFlipping && flipDirection === "left" ? "animate-slide-prev" : ""}`}>
                    <SlideRenderer
                      slide={slide}
                      slideWidth={presentation.slideWidth}
                      slideHeight={presentation.slideHeight}
                    />
                  </div>
                </SmartBoardZoomContainer>
              )}
              {enableAnnotation && isAnnotating && (
                <AnnotationCanvas
                  pageKey={currentSlide}
                  enabled={isAnnotating}
                  color={annoColor}
                  strokeWidth={annoWidth}
                  eraser={isEraser}
                  ref={annoRef}
                />
              )}
            </div>
            {/* Annotation toolbar — left side bookmark, retractable (trainer only) — click to toggle, goes directly to toolbox */}
            {enableAnnotation && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 z-30 flex items-center">
                <div className={`flex items-center transition-transform duration-200 ease-out ${annoBarOpen ? "translate-x-0" : "translate-x-[calc(-100%+18px)]"}`}>
                  <div className="shrink-0">
                    <AnnotationToolbar
                      enabled={true}
                      onToggle={(v) => {
                        setIsAnnotating(v);
                        if (!v) setAnnoBarOpen(false);
                      }}
                      color={annoColor}
                      onColorChange={setAnnoColor}
                      strokeWidth={annoWidth}
                      onWidthChange={setAnnoWidth}
                      eraser={isEraser}
                      onEraserChange={setIsEraser}
                      onClear={handleClearAnno}
                      onClose={() => setAnnoBarOpen(false)}
                    />
                  </div>
                  <button
                    onClick={() => {
                      const next = !annoBarOpen;
                      setAnnoBarOpen(next);
                      if (next) setIsAnnotating(true);
                    }}
                    aria-label={annoBarOpen ? "Hide drawing tools" : "Show drawing tools"}
                    className="w-[18px] h-14 rounded-r-lg bg-white dark:bg-slate-900 border border-l-0 border-slate-200 dark:border-slate-700 shadow-md flex flex-col items-center justify-center gap-0.5 -ml-px shrink-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="w-1 h-5 rounded-full bg-amber-400" />
                    <span className="text-[7px] font-bold tracking-widest text-slate-400 [writing-mode:vertical-lr]">DRAW</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Thumbnail strip + bottom bar — overlay, click to toggle (fullscreen only) */}
          <div className="absolute bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
            <div className={`w-full max-w-full pointer-events-auto transition-transform duration-200 ease-out flex flex-col items-center ${bottomBarOpen ? "translate-y-0" : "translate-y-[calc(100%-14px)]"}`}>
              {/* handle — click to toggle */}
              <button
                onClick={() => setBottomBarOpen((o) => !o)}
                aria-label={bottomBarOpen ? "Hide slides" : "Show slides"}
                className="h-[14px] w-20 rounded-t-lg bg-white dark:bg-slate-900 border border-b-0 border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center -mb-px cursor-pointer shrink-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="w-6 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              </button>
              <div className="w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-700 shadow-xl">
                {totalSlides > 1 && (
                  <div className="w-full max-w-full px-2 sm:px-4 py-2 overflow-x-auto">
                    <div className="flex gap-2 justify-center min-w-max mx-auto">
                      {presentation.slides.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => !isFlipping && loadedSlideIndexes.has(i) && setCurrentSlide(i)}
                          aria-label={`Go to slide ${i + 1}`}
                          className={`shrink-0 w-20 sm:w-24 rounded border-2 transition-all overflow-hidden ${
                            i === currentSlide
                              ? "border-indigo-500 shadow-md scale-105"
                              : "border-transparent opacity-70 hover:opacity-100 hover:border-slate-300"
                          }`}
                        >
                          {loadedSlideIndexes.has(i) && renderedThumbnailIndexes.has(i) ? (
                            <SlideRenderer
                              slide={s}
                              slideWidth={presentation.slideWidth}
                              slideHeight={presentation.slideHeight}
                            />
                          ) : (
                            <div
                              style={{ width: "100%", aspectRatio: `${presentation.slideWidth / presentation.slideHeight}` }}
                              className="bg-slate-100 dark:bg-slate-800"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-center gap-4 py-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={goToPrev}
                    disabled={currentSlide <= 0 || isFlipping}
                    className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center disabled:opacity-30 transition-colors"
                    aria-label="Previous slide"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <Presentation className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                      {currentSlide + 1} / {totalSlides}
                    </span>
                  </div>
                  <button
                    onClick={goToNext}
                    disabled={currentSlide >= totalSlides - 1 || !loadedSlideIndexes.has(currentSlide + 1) || isFlipping}
                    className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center disabled:opacity-30 transition-colors"
                    aria-label="Next slide"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <style>{`
            @keyframes slideNext { 0% { opacity:.6; transform:translateX(20px); } 100% { opacity:1; transform:translateX(0); } }
            @keyframes slidePrev { 0% { opacity:.6; transform:translateX(-20px); } 100% { opacity:1; transform:translateX(0); } }
            .animate-slide-next { animation: slideNext .15s ease-out; }
            .animate-slide-prev { animation: slidePrev .15s ease-out; }
          `}</style>
        </div>
      );
    }

    /* ─── Normal layout — zoom + annotate always available, retractable bookmarks ─── */
    return (
      <div ref={viewerRef} className="flex flex-col items-center gap-0 select-none ppt-viewer w-full">
        <style>{`
          @media print { .ppt-viewer { display: none !important; visibility: hidden !important; } }
          @keyframes slideNext { 0% { opacity:.6; transform:translateX(20px); } 100% { opacity:1; transform:translateX(0); } }
          @keyframes slidePrev { 0% { opacity:.6; transform:translateX(-20px); } 100% { opacity:1; transform:translateX(0); } }
          .animate-slide-next { animation: slideNext .15s ease-out; }
          .animate-slide-prev { animation: slidePrev .15s ease-out; }
        `}</style>

        {/* Slide + side arrows — relative container for overlay bookmark toolbars */}
        <div className="relative flex items-center gap-0 w-full justify-center">
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

          <div className="relative overflow-visible w-full max-w-4xl">
            {/* Normal mode — plain slide, no zoom & no annotation UI (fullscreen only) */}
            <div
              className="relative bg-white dark:bg-slate-900 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.12)]
                          border border-gray-200/60 dark:border-slate-700/60 overflow-hidden"
              onContextMenu={(e) => e.preventDefault()}
            >
              <div className={`${isFlipping && flipDirection === "right" ? "animate-slide-next" : ""} ${isFlipping && flipDirection === "left" ? "animate-slide-prev" : ""}`}>
                <SlideRenderer
                  slide={slide}
                  slideWidth={presentation.slideWidth}
                  slideHeight={presentation.slideHeight}
                />
              </div>
            </div>
          </div>

          <button
            onClick={goToNext}
            disabled={currentSlide >= totalSlides - 1 || !loadedSlideIndexes.has(currentSlide + 1) || isFlipping}
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

        {/* Slide info — compact pill */}
        <div className="flex items-center justify-center gap-3 mt-3 px-5 py-1.5 rounded-full
                        bg-indigo-900/5 dark:bg-indigo-100/5 border border-indigo-200/40 dark:border-slate-600/40">
          <Presentation className="h-3.5 w-3.5 text-indigo-800/60 dark:text-indigo-200/60" />
          <span className="text-xs font-bold text-indigo-900/70 dark:text-indigo-100/70 tracking-wide tabular-nums">
            Slide {currentSlide + 1} of {totalSlides}
          </span>
        </div>

        {/* Thumbnail strip — collapsible, not overlay in normal mode */}
        {totalSlides > 1 && (
          <div className="group mt-3 flex flex-col items-center w-full max-w-full">
            <button
              onClick={(e) => {
                const el = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (el) el.classList.toggle("hidden");
                e.currentTarget.querySelector("svg")?.classList.toggle("rotate-180");
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <ChevronLeft className="w-3 h-3 rotate-90" />
              Slides
            </button>
            <div className="flex gap-2 mt-2 overflow-x-auto max-w-full px-4 pb-2 justify-center">
              {presentation.slides.map((s, i) => (
                <button
                  key={i}
                  onClick={() => !isFlipping && loadedSlideIndexes.has(i) && setCurrentSlide(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`shrink-0 w-20 sm:w-24 rounded border-2 transition-all overflow-hidden
                    ${i === currentSlide
                      ? "border-indigo-500 shadow-md scale-105"
                      : "border-transparent opacity-60 hover:opacity-90 hover:border-gray-300"
                    }`}
                >
                  {loadedSlideIndexes.has(i) && renderedThumbnailIndexes.has(i) ? (
                    <SlideRenderer
                      slide={s}
                      slideWidth={presentation.slideWidth}
                      slideHeight={presentation.slideHeight}
                    />
                  ) : (
                    <div
                      style={{ width: "100%", aspectRatio: `${presentation.slideWidth / presentation.slideHeight}` }}
                      className="bg-slate-100 dark:bg-slate-800 animate-pulse"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

LegacyPptViewer.displayName = "LegacyPptViewer";

export const PptViewer = forwardRef<PptViewerHandle, PptViewerProps>(
  function PptViewer(
    { storageKey, title, onPageChange, onFullscreenChange, initialPage, watermarkText, enableAnnotation },
    ref,
  ) {
    const [useLegacyRenderer, setUseLegacyRenderer] = useState(true);
    const fileUrl = `${Config.pptPreviewUrl}${encodeURIComponent(storageKey)}`;

    if (useLegacyRenderer) {
      return (
        <LegacyPptViewer
          ref={ref}
          storageKey={storageKey}
          title={title}
          initialPage={initialPage}
          onPageChange={onPageChange}
          onFullscreenChange={onFullscreenChange}
          watermarkText={watermarkText}
          enableAnnotation={enableAnnotation}
        />
      );
    }

    return (
      <PdfFlipBook
        ref={ref}
        fileUrl={fileUrl}
        initialPage={initialPage}
        onPageChange={onPageChange}
        onFullscreenChange={onFullscreenChange}
        onLoadError={() => setUseLegacyRenderer(true)}
        watermarkText={watermarkText}
        enableAnnotation={enableAnnotation}
      />
    );
  }
);

PptViewer.displayName = "PptViewer";
