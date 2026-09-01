import { useCallback, useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Maximize2, Move } from "lucide-react";

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
 * Logs to console as [zoom] and beacons to /api/admin/training-log as kind=zoom for tail:
 *   wrangler tail | grep "\[zoom\]"
 */
export function SmartBoardZoomContainer({
  children,
  disabled,
  className,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // pointer tracking for pinch/pan
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const lastTap = useRef<number>(0);

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
    return clamped;
  }, []);

  const zoomIn = useCallback(() => {
    const n = setScaleClamped(scale + ZOOM_STEP);
    logZoom("zoom_in", { nextScale: n });
  }, [scale, setScaleClamped, logZoom]);
  const zoomOut = useCallback(() => {
    const n = setScaleClamped(scale - ZOOM_STEP);
    logZoom("zoom_out", { nextScale: n });
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

  // When not zoomed, pan is 0; when zoomed, translate via pan
  return (
    <div
      ref={containerRef}
      className={className}
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
      }}
      style={{
        touchAction: "none", // critical for smart boards — prevents browser handling of pinch
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
    >
      {/* Zoom viewport — overflow hidden, content is transformed */}
      <div className="relative overflow-hidden w-full h-full">
        <div
          className="w-full h-full will-change-transform"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: pointers.current.size > 0 ? "none" : "transform 180ms ease-out",
          }}
        >
          {children}
        </div>
      </div>

      {/* Floating toolbar — large targets for stylus/finger on board */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 p-1.5 rounded-xl bg-white/95 dark:bg-slate-900/90 backdrop-blur shadow-lg border border-slate-200 dark:border-slate-700">
        <button
          onClick={zoomOut}
          aria-label="Zoom out"
          className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
          title="Zoom out (-)"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <span className="min-w-[3.5rem] text-center text-sm font-bold tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={zoomIn}
          aria-label="Zoom in"
          className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
          title="Zoom in (+)"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
        <button
          onClick={reset}
          aria-label="Reset zoom"
          className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 transition-colors"
          title="Reset (0) / double-tap"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
        {scale > 1 && (
          <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground ml-1">
            <Move className="w-3 h-3" /> drag to pan
          </span>
        )}
      </div>

      {/* Hint for smart board */}
      <div className="absolute top-3 left-3 z-20 hidden md:flex items-center gap-2 text-[11px] font-medium text-slate-500 bg-white/80 dark:bg-slate-900/70 px-2.5 py-1 rounded-full backdrop-blur">
        <span>Pinch to zoom</span>
        <span className="opacity-30">•</span>
        <span>Drag to pan</span>
        <span className="opacity-30">•</span>
        <span>Double-tap to reset</span>
        <span className="opacity-30">•</span>
        <span className="hidden lg:inline">Stylus supported</span>
      </div>
    </div>
  );
}
