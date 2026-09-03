import { useCallback, useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Maximize2, Move, X, Info } from "lucide-react";

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * SmartBoardZoomContainer
 * - Pinch (2 pointers) → zoom
 * - Wheel (ctrl/mouse wheel) → zoom
 * - Drag (1 pointer) when zoomed → pan (works for mouse, touch, stylus/pen)
 * - Double-tap / double-click → toggle 1x ↔ 2x, long-press stylus also resets
 * - Toolbar (+/-/Reset) + keyboard (+/-/0)
 * - Large touch targets (≥44px) for interactive whiteboards
 * - touch-action:none prevents browser zoom/scroll interference on boards
 *
 * UX fix (2025-09): Hint and toolbar are now rendered **outside** the slide
 * viewport (below the slide) so they never cover the CREOLEAP logo or slide
 * content when zoomed. Hint auto-hides after 4s / first interaction and can be
 * reopened via a small help button. Toolbar is compact on narrow/split screens.
 *
 * Logs to console as [zoom] and beacons to /api/admin/training-log as kind=zoom for tail:
 *   wrangler tail | grep "\[zoom\]"
 */
export function SmartBoardZoomContainer({
  children,
  disabled,
  className,
  sideFloating = false,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  /** When true, hint + toolbar are floating overlays on the sides (for fullscreen) */
  sideFloating?: boolean;
}) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);

  // pointer tracking for pinch/pan
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const lastTap = useRef<number>(0);

  // Hint visibility — outside the slide so it never covers content.
  // Auto-hides after 4s and after first zoom interaction; persisted per browser.
  const [hintVisible, setHintVisible] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem("sbz-hint-dismissed") !== "1";
    } catch {
      return true;
    }
  });

  const dismissHint = useCallback(() => {
    setHintVisible(false);
    try {
      localStorage.setItem("sbz-hint-dismissed", "1");
    } catch {}
  }, []);

  const showHintAgain = useCallback(() => {
    setHintVisible(true);
    try {
      localStorage.removeItem("sbz-hint-dismissed");
    } catch {}
  }, []);

  useEffect(() => {
    if (!hintVisible) return;
    const t = setTimeout(() => setHintVisible(false), 4000);
    return () => clearTimeout(t);
  }, [hintVisible]);

  const logZoom = useCallback((action: string, extra?: Record<string, unknown>) => {
    const payload = { kind: "zoom", action, scale, pan, ts: new Date().toISOString(), ...extra };
    // console for local dev
    console.log("[zoom]", payload);
    // beacon for worker observability — fire-and-forget
    try {
      fetch("/api/admin/training-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    } catch {}
  }, [scale, pan]);

  const setScaleClamped = useCallback((next: number, center?: { x: number; y: number }) => {
    const clamped = clamp(next, MIN_ZOOM, MAX_ZOOM);
    setScale(clamped);
    if (clamped === 1) setPan({ x: 0, y: 0 });
    // optionally adjust pan to keep center point stable — simplified: no offset
    if (center) {
      // keep pinch center stable (basic)
    }
    // First interaction dismisses the hint (user has understood)
    if (clamped !== 1) setHintVisible(false);
    return clamped;
  }, []);

  const zoomIn = useCallback(() => {
    const n = setScaleClamped(scale + ZOOM_STEP);
    logZoom("zoom_in", { nextScale: n });
    setHintVisible(false);
  }, [scale, setScaleClamped, logZoom]);
  const zoomOut = useCallback(() => {
    const n = setScaleClamped(scale - ZOOM_STEP);
    logZoom("zoom_out", { nextScale: n });
    setHintVisible(false);
  }, [scale, setScaleClamped, logZoom]);
  const reset = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    logZoom("reset");
  }, [logZoom]);

  // Wheel — ctrl+wheel or pinch-wheel on board
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (disabled) return;
    // On smart boards, wheel often comes as two-finger scroll without ctrl. Allow plain wheel when zoomed or with ctrl.
    if (!e.ctrlKey && !e.metaKey && scale === 1 && Math.abs(e.deltaY) < 20) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    const next = clamp(scale * (1 + delta), MIN_ZOOM, MAX_ZOOM);
    if (next !== scale) {
      setScale(next);
      if (next === 1) setPan({ x: 0, y: 0 });
      logZoom("wheel", { deltaY: e.deltaY, nextScale: next });
      if (next !== 1) setHintVisible(false);
    }
  }, [disabled, scale, logZoom]);

  // Pointer handlers — unified for mouse/touch/pen (stylus)
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    const el = e.currentTarget as HTMLElement;
    // capture for pen/mouse so we keep tracking even if stylus lifts slightly
    try { el.setPointerCapture(e.pointerId); } catch {}
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      pinchStart.current = { dist: dist(pts[0], pts[1]), scale };
      panStart.current = null;
      logZoom("pinch_start", { dist: pinchStart.current.dist });
      setHintVisible(false);
    } else if (pointers.current.size === 1 && scale > 1) {
      // single-pointer pan when zoomed — works for finger, mouse drag, or stylus pen
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }

    // double-tap detection for stylus/touch/mouse — 300ms
    const now = Date.now();
    if (e.pointerType === "pen" || e.pointerType === "touch" || e.pointerType === "mouse") {
      if (now - lastTap.current < 300) {
        // double tap → toggle 1x ↔ 2x
        const next = scale > 1.5 ? 1 : 2;
        setScale(next);
        if (next === 1) setPan({ x: 0, y: 0 });
        logZoom("double_tap", { nextScale: next, pointerType: e.pointerType });
        lastTap.current = 0;
        setHintVisible(false);
      } else {
        lastTap.current = now;
      }
    }
  }, [disabled, scale, pan, logZoom]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const pts = [...pointers.current.values()];
      const curDist = dist(pts[0], pts[1]);
      const next = clamp(pinchStart.current.scale * (curDist / pinchStart.current.dist), MIN_ZOOM, MAX_ZOOM);
      if (next !== scale) {
        setScale(next);
        if (next === 1) setPan({ x: 0, y: 0 });
      }
    } else if (pointers.current.size === 1 && panStart.current && scale > 1) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      // allow panning with pen, finger, or mouse when zoomed
      // clamp pan so content doesn't fly off — ± (scale-1)*200px heuristic
      const bound = (scale - 1) * 400;
      setPan({
        x: clamp(panStart.current.panX + dx, -bound, bound),
        y: clamp(panStart.current.panY + dy, -bound, bound),
      });
    }
  }, [disabled, scale]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) {
      if (pinchStart.current) {
        logZoom("pinch_end", { scale });
        pinchStart.current = null;
      }
    }
    if (pointers.current.size === 0) {
      panStart.current = null;
    }
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  }, [scale, logZoom]);

  // Keyboard: + / - / 0
  useEffect(() => {
    if (disabled) return;
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomIn(); }
      if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomOut(); }
      if (e.key === "0") { e.preventDefault(); reset(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [disabled, zoomIn, zoomOut, reset]);

  if (disabled) return <>{children}</>;

  // outerClass merges caller-provided className. With sideFloating, controls are
  // absolutely positioned so outer keeps the caller's layout (w-full h-full) and the
  // viewport fills it. Without sideFloating, controls flow below the viewport, so the
  // viewport must size from its content (NO h-full — h-full inside an auto-height
  // parent collapses to 0 and hides the slide).
  const isFullHeight = !!className?.includes("h-full");
  const outerClass = ["relative", className].filter(Boolean).join(" ");
  const viewportClass = isFullHeight
    ? "relative overflow-hidden w-full h-full flex items-center justify-center"
    : "relative overflow-hidden w-full flex items-center justify-center";

  return (
    <div
      className={outerClass}
      style={{
        // outer should not intercept toolbar clicks; viewport handles zoom gestures
      }}
    >
      {/* Zoom viewport — overflow hidden, content is transformed */}
      <div
        ref={viewportRef}
        className={viewportClass}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => {
          // fallback for mouse double-click if pointer double-tap missed
          const next = scale > 1.5 ? 1 : 2;
          setScale(next);
          if (next === 1) setPan({ x: 0, y: 0 });
          logZoom("double_click", { nextScale: next });
          setHintVisible(false);
        }}
        style={{
          touchAction: "none", // critical for smart boards — prevents browser handling of pinch
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
      >
        <div
          className={`${isFullHeight ? "w-full h-full" : "w-full"} flex items-center justify-center will-change-transform`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: pointers.current.size > 0 ? "none" : "transform 180ms ease-out",
          }}
        >
          {children}
        </div>
      </div>

      {/* Controls bar */}
      {sideFloating ? (
        <>
          {/* Hint — floating top center for fullscreen, auto-hides */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-auto">
            {hintVisible ? (
              <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-white/95 dark:bg-slate-800/95 px-3 py-1 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 backdrop-blur">
                <span>Pinch to zoom</span>
                <span className="opacity-30">•</span>
                <span>Drag to pan</span>
                <span className="opacity-30">•</span>
                <span>Double-tap to reset</span>
                <button
                  onClick={dismissHint}
                  aria-label="Dismiss zoom help"
                  className="ml-1 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={showHintAgain}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-white/80 hover:text-white bg-black/40 hover:bg-black/60 px-2.5 py-1 rounded-full border border-white/20 backdrop-blur"
              >
                <Info className="w-3 h-3" /> Zoom help
              </button>
            )}
          </div>
          {/* Toolbar — floating on right side, vertical, retractable bookmark */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex items-center">
            <div className="flex items-center translate-x-[calc(100%-18px)] hover:translate-x-0 focus-within:translate-x-0 transition-transform duration-200 ease-out">
              {/* handle peek */}
              <div className="w-[18px] h-14 rounded-l-lg bg-white dark:bg-slate-900 border border-r-0 border-slate-200 dark:border-slate-700 shadow-md flex flex-col items-center justify-center gap-0.5 -mr-px cursor-pointer shrink-0">
                <div className="w-1 h-5 rounded-full bg-amber-400" />
                <ZoomIn className="w-2.5 h-2.5 text-slate-400" />
              </div>
              <div className="flex flex-col items-center gap-1.5 p-1.5 rounded-l-xl bg-white/95 dark:bg-slate-900/90 backdrop-blur shadow-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={zoomIn}
                  aria-label="Zoom in"
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                  title="Zoom in (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <span className="min-w-[2.75rem] text-center text-[11px] font-bold tabular-nums py-0.5 bg-slate-50 dark:bg-slate-800 rounded-md">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={zoomOut}
                  aria-label="Zoom out"
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                  title="Zoom out (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <div className="w-5 h-px bg-slate-200 dark:bg-slate-700 my-0.5" />
                <button
                  onClick={reset}
                  aria-label="Reset zoom"
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 transition-colors"
                  title="Reset (0) / double-tap"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="shrink-0 flex flex-col items-center gap-1.5 mt-2 w-full max-w-full">
          {/* Hint — auto-hides after 4s or first interaction; can be reopened */}
          {hintVisible ? (
            <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-white/90 dark:bg-slate-800/90 px-2.5 sm:px-3 py-1 rounded-full shadow-sm border border-slate-200 dark:border-slate-700 backdrop-blur max-w-[min(100%,28rem)]">
              <span className="hidden sm:inline">Pinch to zoom</span>
              <span className="sm:hidden">Pinch zoom</span>
              <span className="opacity-30">•</span>
              <span>Drag to pan</span>
              <span className="opacity-30">•</span>
              <span>Double-tap to reset</span>
              <span className="opacity-30 hidden lg:inline">•</span>
              <span className="hidden lg:inline">Stylus supported</span>
              <button
                onClick={dismissHint}
                aria-label="Dismiss zoom help"
                className="ml-1 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={showHintAgain}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-white/70 dark:bg-slate-800/70 px-2.5 py-1 rounded-full border border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400 transition-colors"
            >
              <Info className="w-3 h-3" /> Zoom help
            </button>
          )}

          {/* Toolbar — compact on narrow/split screens, does not overlay slide */}
          <div className="flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 rounded-xl bg-white/95 dark:bg-slate-900/90 backdrop-blur shadow-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={zoomOut}
              aria-label="Zoom out"
              className="w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
              title="Zoom out (-)"
            >
              <ZoomOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <span className="min-w-[2.5rem] sm:min-w-[3.5rem] text-center text-xs sm:text-sm font-bold tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              aria-label="Zoom in"
              className="w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
              title="Zoom in (+)"
            >
              <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />
            <button
              onClick={reset}
              aria-label="Reset zoom"
              className="w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 flex items-center justify-center rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 transition-colors"
              title="Reset (0) / double-tap"
            >
              <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            {scale > 1 && (
              <span className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground ml-1">
                <Move className="w-3 h-3" /> drag to pan
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
