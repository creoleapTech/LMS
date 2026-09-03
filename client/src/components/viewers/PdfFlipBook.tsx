import {
  useState, useEffect, useRef, useCallback, forwardRef,
  useImperativeHandle, useMemo,
} from "react";
import HTMLFlipBook from "react-pageflip";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Minimize,
} from "lucide-react";
import { buildWatermarkDataUrl } from "../../lib/watermarkUtils";
import { SmartBoardZoomContainer } from "./SmartBoardZoom";
import { AnnotationCanvas, type AnnotationCanvasHandle } from "./AnnotationCanvas";
import { AnnotationToolbar } from "./AnnotationToolbar";
// Ensure Uint8Array.toHex / toBase64 & other modern APIs exist before pdfjs loads
import "../../lib/polyfills";

export interface PdfFlipBookHandle {
  toggleFullscreen: () => void;
  isFullscreen: boolean;
}

interface PdfFlipBookProps {
  fileUrl: string;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  onFullscreenChange?: (fs: boolean) => void;
  onLoadError?: (error: unknown) => void;
  watermarkText?: string;
  enableAnnotation?: boolean;
  enableZoom?: boolean;
}

/* ─── Single page wrapper ─── */
const Page = forwardRef<HTMLDivElement, { src: string; pageNum: number; totalPages: number }>(
  ({ src, pageNum, totalPages }, ref) => (
    <div ref={ref} className="page-item" data-density="soft">
      <div className="relative w-full h-full bg-white overflow-hidden">
        <img
          src={src}
          alt={`Page ${pageNum}`}
          loading="lazy"
          decoding="async"
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
export const PdfFlipBook = forwardRef<PdfFlipBookHandle, PdfFlipBookProps>(
  function PdfFlipBook(
    { fileUrl, initialPage, onPageChange, onFullscreenChange, onLoadError, watermarkText, enableAnnotation, enableZoom = true },
    ref,
  ) {
    const [pageImages, setPageImages]         = useState<string[]>([]);
    const [totalPages, setTotalPages]         = useState(0);
    const [loading, setLoading]               = useState(true);
    const [renderProgress, setRenderProgress] = useState(0);
    const [error, setError]                   = useState<string | null>(null);
    const [currentPage, setCurrentPage]       = useState(0);
    const [isFullscreen, setIsFullscreen]     = useState(false);
    const [aspectRatio, setAspectRatio]       = useState(1.414); // A4 default
    const [usePortrait, setUsePortrait]       = useState(false);

    // Pixel dimensions fed to react-pageflip
    const [dimensions, setDimensions] = useState({ width: 400, height: 565 });
    // Bump this key to force-remount react-pageflip after fullscreen transitions
    const [flipbookKey, setFlipbookKey] = useState(0);

    const flipBookRef = useRef<any>(null);
    const wrapperRef  = useRef<HTMLDivElement>(null); // receives requestFullscreen()
    const bookAreaRef = useRef<HTMLDivElement>(null); // measured by ResizeObserver

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

    /* ─── Expose handle ─── */
    const toggleFullscreen = useCallback(() => {
      if (!document.fullscreenElement) {
        wrapperRef.current?.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    }, []);

    useImperativeHandle(ref, () => ({ toggleFullscreen, isFullscreen }), [
      toggleFullscreen, isFullscreen,
    ]);

    /* ─── Compute page dimensions from available rect ─── */
    const calcFromRect = useCallback((
      availW: number, availH: number, ar: number, fs: boolean,
    ) => {
      // In fullscreen the browser gives us the full screen; reserve space for
      // nav buttons (56px × 2 + 32px gaps) and the page-info bar (60px) + padding (48px).
      // In normal mode the ResizeObserver gives us the exact container rect; reserve
      // nav buttons (44px × 2 + 16px) and page-info bar (52px).
      const navW  = fs ? 56 * 2 + 32 : 44 * 2 + 16;
      const infoH = fs ? 60 + 48      : 52;

      const portrait = availW < (fs ? 700 : 600);
      setUsePortrait(portrait);

      const w0 = Math.max(80,  availW - navW);
      const h0 = Math.max(120, availH - infoH);

      let w: number, h: number;
      if (portrait) {
        h = h0; w = h / ar;
        if (w > w0) { w = w0; h = w * ar; }
      } else {
        // Two-page spread: each page is `w` wide, book renders `2w`
        h = h0; w = h / ar;
        if (w * 2 > w0) { w = w0 / 2; h = w * ar; }
      }

      setDimensions({
        width:  Math.max(100, Math.round(w)),
        height: Math.max(140, Math.round(h)),
      });
    }, []);

    /* ─── ResizeObserver — normal mode only ─── */
    useEffect(() => {
      if (isFullscreen) return;
      const el = bookAreaRef.current;
      if (!el || !totalPages) return;
      if (typeof ResizeObserver === "undefined") return;

      const ro = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0) calcFromRect(width, height, aspectRatio, false);
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, [isFullscreen, totalPages, aspectRatio, calcFromRect]);

    /* ─── Window resize — fullscreen mode only ─── */
    useEffect(() => {
      if (!isFullscreen || !totalPages) return;
      if (typeof window === "undefined") return;
      const recalc = () =>
        calcFromRect(window.innerWidth, window.innerHeight, aspectRatio, true);
      recalc();
      window.addEventListener("resize", recalc);
      return () => window.removeEventListener("resize", recalc);
    }, [isFullscreen, totalPages, aspectRatio, calcFromRect]);

    /* ─── Fullscreen change ─── */
    const flipbookKeyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
      if (typeof document === "undefined") return;
      const handler = () => {
        const fs = !!document.fullscreenElement;
        setIsFullscreen(fs);
        onFullscreenChange?.(fs);

        // After the transition the DOM needs a frame to settle before we
        // remount react-pageflip with the new dimensions.
        if (flipbookKeyTimeoutRef.current) clearTimeout(flipbookKeyTimeoutRef.current);
        flipbookKeyTimeoutRef.current = setTimeout(() => setFlipbookKey((k) => k + 1), 120);
      };
      document.addEventListener("fullscreenchange", handler);
      return () => {
        document.removeEventListener("fullscreenchange", handler);
        if (flipbookKeyTimeoutRef.current) clearTimeout(flipbookKeyTimeoutRef.current);
      };
    }, [onFullscreenChange]);

    /* ─── Load PDF ───
       Uses the legacy pdfjs-dist build which bundles core-js polyfills for
       Uint8Array.toHex / toBase64, Promise.withResolvers, Set.intersection etc.
       Without this, older Android WebViews / Chrome <129 throw
         "Failed to load PDF: n.toHex is not a function"
       at the fingerprint stage (pdf.worker). See src/lib/polyfills.ts.
    ───────────────────────────────────────────────────────────────────── */
    useEffect(() => {
      let cancelled = false;
      async function loadAndRender() {
        try {
          setLoading(true);
          setError(null);
          setRenderProgress(0);

          // Runtime safety-net: the static import of ../../lib/polyfills should
          // already have patched the main thread, but this guards against
          // test mocks / HMR edge cases where the file wasn't evaluated first.
          if (
            typeof Uint8Array !== "undefined" &&
            !(Uint8Array.prototype as unknown as { toHex?: unknown }).toHex
          ) {
            Object.defineProperty(Uint8Array.prototype, "toHex", {
              value: function (this: Uint8Array): string {
                let out = "";
                for (let i = 0; i < this.length; i++) {
                  const hex = this[i].toString(16);
                  out += hex.length === 1 ? "0" + hex : hex;
                }
                return out;
              },
              writable: true,
              configurable: true,
            });
          }

          // Use the legacy build which ships with core-js polyfills so the
          // *worker* also has toHex / toBase64 even on older browsers.
          // Falls back to the modern entry if the legacy path is not resolvable
          // (e.g. in unit tests where only "pdfjs-dist" is mocked).
          let pdfjsLib: any;
          try {
            pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
          } catch {
            pdfjsLib = await import("pdfjs-dist");
          }
          try {
            pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
              "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
              import.meta.url,
            ).toString();
          } catch {
            pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
              "pdfjs-dist/build/pdf.worker.min.mjs",
              import.meta.url,
            ).toString();
          }

          let doc;
          try {
            doc = await pdfjsLib.getDocument(fileUrl).promise;
          } catch (workerErr: unknown) {
            const msg = String((workerErr as { message?: string })?.message ?? workerErr ?? "");
            const isPolyfillOrWorkerErr =
              msg.includes("toHex") ||
              msg.includes("toBase64") ||
              msg.includes("withResolvers") ||
              msg.includes("intersection") ||
              msg.includes("getOrInsertComputed");
            if (isPolyfillOrWorkerErr) {
              console.warn("[PdfFlipBook] Worker failed (likely missing browser API), retrying without worker:", workerErr);
              doc = await pdfjsLib.getDocument({ url: fileUrl, disableWorker: true } as unknown as string).promise;
            } else {
              throw workerErr;
            }
          }
          if (cancelled) return;

          const numPages = doc.numPages;
          setTotalPages(numPages);

          const firstPage = await doc.getPage(1);
          const baseViewport = firstPage.getViewport({ scale: 1 });
          const ar = baseViewport.height / baseViewport.width;
          setAspectRatio(ar);

          const renderWidth = 1200;
          const renderScale = renderWidth / baseViewport.width;

          const images: string[] = [];
          for (let i = 1; i <= numPages; i++) {
            if (cancelled) return;
            const page    = await doc.getPage(i);
            const vp      = page.getViewport({ scale: renderScale });
            const canvas  = document.createElement("canvas");
            canvas.width  = vp.width;
            canvas.height = vp.height;
            await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp, canvas } as any).promise;
            images.push(canvas.toDataURL("image/jpeg", 0.92));
            setRenderProgress(Math.round((i / numPages) * 100));
            page.cleanup();
          }

          if (!cancelled) { setPageImages(images); setLoading(false); }
        } catch (err: any) {
          onLoadError?.(err);
          if (!cancelled) { setError(err.message || "Failed to load PDF"); setLoading(false); }
        }
      }
      loadAndRender();
      return () => { cancelled = true; };
    }, [fileUrl, onLoadError]);

    /* ─── Jump to initial page ─── */
    useEffect(() => {
      if (!loading && pageImages.length > 0 && initialPage && initialPage > 1) {
        const t = setTimeout(() => {
          flipBookRef.current?.pageFlip()?.turnToPage(initialPage - 1);
        }, 500);
        return () => clearTimeout(t);
      }
    }, [loading, pageImages.length, initialPage]);

    /* ─── Flip handler ─── */
    const handleFlip = useCallback((e: any) => {
      setCurrentPage(e.data);
      onPageChange?.(e.data + 1);
    }, [onPageChange]);

    /* ─── Navigation ─── */
    const goToPrev = useCallback(() => flipBookRef.current?.pageFlip()?.flipPrev(), []);
    const goToNext = useCallback(() => flipBookRef.current?.pageFlip()?.flipNext(), []);

    /* ─── Keyboard ─── */
    useEffect(() => {
      const h = (e: KeyboardEvent) => {
        if (e.key === "ArrowLeft")  goToPrev();
        if (e.key === "ArrowRight") goToNext();
      };
      document.addEventListener("keydown", h);
      return () => document.removeEventListener("keydown", h);
    }, [goToPrev, goToNext]);

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

    /* ─── Loading ─── */
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

    const bookSpreadW = usePortrait ? dimensions.width : dimensions.width * 2;

    /* ─────────────────────────────────────────────────────────────────────
       The wrapperRef div is the fullscreen target.
       When the browser promotes it to fullscreen it automatically fills the
       screen — we must NOT add `fixed inset-0` ourselves (that fights the
       browser and causes the off-centre / wrong-size issue).
       We DO add a dark background and flex-centering so the content looks
       right inside the fullscreen layer.
    ───────────────────────────────────────────────────────────────────── */
    return (
      <div
        ref={wrapperRef}
        className={`pdf-book-viewer select-none ${
          isFullscreen
            ? "w-full h-full flex flex-col bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900"
            : "w-full h-full flex flex-col"
        }`}
      >
        <style>{`
          @media print { .pdf-book-viewer { display: none !important; visibility: hidden !important; } }
          .stf__wrapper { box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 1px rgba(0,0,0,0.1) !important; }
          /* Make the fullscreen element fill the screen properly in all browsers */
          .pdf-book-viewer:fullscreen { width: 100vw; height: 100vh; }
          .pdf-book-viewer:-webkit-full-screen { width: 100vw; height: 100vh; }
        `}</style>

        {/* Watermark overlay (fullscreen only) */}
        {isFullscreen && watermarkBg && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute", inset: 0,
              pointerEvents: "none", zIndex: 30,
              backgroundImage: `url(${watermarkBg})`,
              backgroundRepeat: "repeat",
              backgroundSize: "320px 160px",
            }}
          />
        )}

        {/* Exit button — only visible when in fullscreen */}
        {isFullscreen && (
          <div className="absolute top-4 right-4 z-40">
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium
                         bg-white/15 hover:bg-white/25 text-white shadow-lg transition-all"
            >
              <Minimize className="h-4 w-4" />
              <span className="hidden sm:inline">Exit</span>
            </button>
          </div>
        )}

        {/* ── Book area — measured by ResizeObserver in normal mode ── */}
        <div
          ref={bookAreaRef}
          className="flex-1 min-h-0 flex flex-col items-center justify-center w-full relative"
        >
          {/* Book + nav buttons */}
          <div className="flex items-center justify-center w-full shrink-0">
            {/* Prev */}
            <button
              onClick={goToPrev}
              disabled={currentPage <= 0}
              className={`group flex items-center justify-center rounded-full shrink-0
                         transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed
                         ${isFullscreen
                           ? "w-14 h-14 bg-white/15 hover:bg-white/25 text-white"
                           : "w-10 h-10 md:w-11 md:h-11 neo-btn"
                         }`}
            >
              <ChevronLeft className={`group-hover:-translate-x-0.5 transition-transform ${isFullscreen ? "h-7 w-7" : "h-5 w-5"}`} />
            </button>

            {/* Flipbook — smart-board zoom: pinch/wheel/stylus pan, toolbar
                When enableZoom===false (preview), render without zoom for clean preview — also in fullscreen per latest spec (no zoom in fullscreen). */}
            {enableZoom === false ? (
              <div
                className={`relative shrink-0 ${isFullscreen ? "" : "neo-card p-1 sm:p-2"}`}
                style={{ width: bookSpreadW, height: dimensions.height }}
              >
                <HTMLFlipBook
                  key={flipbookKey}
                  ref={flipBookRef}
                  width={dimensions.width}
                  height={dimensions.height}
                  size="fixed"
                  minWidth={80}
                  maxWidth={2400}
                  minHeight={100}
                  maxHeight={3200}
                  showCover={true}
                  mobileScrollSupport={false}
                  flippingTime={800}
                  usePortrait={usePortrait}
                  startZIndex={0}
                  autoSize={false}
                  maxShadowOpacity={0.5}
                  drawShadow={true}
                  onFlip={handleFlip}
                  className="flipbook-pages"
                  style={{}}
                  startPage={currentPage}
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
                {enableAnnotation && isAnnotating && (
                  <AnnotationCanvas
                    pageKey={currentPage}
                    enabled={isAnnotating}
                    color={annoColor}
                    strokeWidth={annoWidth}
                    eraser={isEraser}
                    ref={annoRef}
                  />
                )}
              </div>
            ) : (
              <SmartBoardZoomContainer className="relative shrink-0 flex items-center justify-center" disabled={isAnnotating && !!enableAnnotation} sideFloating={isFullscreen}>
                <div
                  className={`relative shrink-0 ${isFullscreen ? "" : "neo-card p-1 sm:p-2"}`}
                  style={{ width: bookSpreadW, height: dimensions.height }}
                >
                  <HTMLFlipBook
                    key={flipbookKey}
                    ref={flipBookRef}
                    width={dimensions.width}
                    height={dimensions.height}
                    size="fixed"
                    minWidth={80}
                    maxWidth={2400}
                    minHeight={100}
                    maxHeight={3200}
                    showCover={true}
                    mobileScrollSupport={false}
                    flippingTime={800}
                    usePortrait={usePortrait}
                    startZIndex={0}
                    autoSize={false}
                    maxShadowOpacity={0.5}
                    drawShadow={true}
                    onFlip={handleFlip}
                    className="flipbook-pages"
                    style={{}}
                    startPage={currentPage}
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
                  {enableAnnotation && isAnnotating && (
                    <AnnotationCanvas
                      pageKey={currentPage}
                      enabled={isAnnotating}
                      color={annoColor}
                      strokeWidth={annoWidth}
                      eraser={isEraser}
                      ref={annoRef}
                    />
                  )}
                </div>
              </SmartBoardZoomContainer>
            )}

            {/* Next */}
            <button
              onClick={goToNext}
              disabled={currentPage >= totalPages - 1}
              className={`group flex items-center justify-center rounded-full shrink-0
                         transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed
                         ${isFullscreen
                           ? "w-14 h-14 bg-white/15 hover:bg-white/25 text-white"
                           : "w-10 h-10 md:w-11 md:h-11 neo-btn"
                         }`}
            >
              <ChevronRight className={`group-hover:translate-x-0.5 transition-transform ${isFullscreen ? "h-7 w-7" : "h-5 w-5"}`} />
            </button>
          </div>

          {/* Annotation toolbar — trainer only, cleared on page change */}
          {enableAnnotation && (
            <div className={isFullscreen ? "absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-20 hidden sm:flex" : "mt-3 w-full flex justify-center px-2"}>
              <AnnotationToolbar
                enabled={isAnnotating}
                onToggle={setIsAnnotating}
                color={annoColor}
                onColorChange={setAnnoColor}
                strokeWidth={annoWidth}
                onWidthChange={setAnnoWidth}
                eraser={isEraser}
                onEraserChange={setIsEraser}
                onClear={handleClearAnno}
              />
            </div>
          )}

          {/* Page info */}
          <div
            className={`flex items-center justify-center gap-3 mt-3 px-6 py-2 rounded-full shrink-0
                       ${isFullscreen ? "bg-white/10 border border-white/20" : "neo-inset-sm"}`}
          >
            <BookOpen className={`h-4 w-4 ${isFullscreen ? "text-white/70" : "text-indigo-500/60"}`} />
            <span className={`text-sm font-semibold tracking-wide ${isFullscreen ? "text-white/80" : "text-slate-600"}`}>
              Page {currentPage + 1} of {totalPages}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

PdfFlipBook.displayName = "PdfFlipBook";
