import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo } from "react";

export interface AnnotationCanvasHandle {
  clear: () => void;
  isEmpty: () => boolean;
}

interface AnnotationCanvasProps {
  /** Key that forces clear when it changes (slide/page number). */
  pageKey: string | number;
  /** Whether drawing is enabled */
  enabled?: boolean;
  /** Stroke color */
  color?: string;
  /** Stroke width in px (CSS pixels, scaled for DPR) */
  strokeWidth?: number;
  /** Eraser mode */
  eraser?: boolean;
  /** Called when user starts/stops drawing — useful to hide hints */
  onDrawStart?: () => void;
  onDrawEnd?: () => void;
}

export const AnnotationCanvas = forwardRef<AnnotationCanvasHandle, AnnotationCanvasProps>(
  function AnnotationCanvas(
    { pageKey, enabled = true, color = "#ff1a1a", strokeWidth = 3, eraser = false, onDrawStart, onDrawEnd },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef<HTMLDivElement>(null);
    const isDrawing = useRef(false);
    const lastPos = useRef<{ x: number; y: number } | null>(null);
    const dprRef = useRef<number>(1);

    // noticeably big eraser — deutlich larger than pen
    const eraserWidth = useMemo(() => Math.max(34, strokeWidth * 6), [strokeWidth]);

    const getCtx = useCallback(() => {
      const c = canvasRef.current;
      if (!c) return null;
      return c.getContext("2d");
    }, []);

    const resize = useCallback(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      const { width, height } = container.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      // preserve content on resize? per spec we clear on page change only,
      // but resize (e.g. zoom) shouldn't wipe — keep bitmap
      const prev = document.createElement("canvas");
      const hadContent = canvas.width > 0 && canvas.height > 0;
      let prevW = 0, prevH = 0;
      if (hadContent) {
        prevW = canvas.width;
        prevH = canvas.height;
        try {
          prev.width = prevW;
          prev.height = prevH;
          const pctx = prev.getContext("2d");
          if (pctx) pctx.drawImage(canvas, 0, 0);
        } catch {}
      }
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        // restore previous bitmap scaled to new size (if same aspect just redraw)
        if (hadContent && prevW > 0 && prevH > 0) {
          try {
            // draw previous content stretched to new css size
            ctx.drawImage(prev, 0, 0, prevW, prevH, 0, 0, width, height);
          } catch {}
        }
      }
    }, []);

    const clear = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = getCtx();
      if (!canvas || !ctx) return;
      // need to clear with identity transform because ctx is scaled by dpr
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }, [getCtx]);

    const isEmpty = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return true;
      const ctx = canvas.getContext("2d");
      if (!ctx) return true;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) return false;
      }
      return true;
    }, []);

    useImperativeHandle(ref, () => ({ clear, isEmpty }), [clear, isEmpty]);

    // Clear whenever pageKey changes — satisfies "annotations must be cleared when going to next page"
    useEffect(() => {
      clear();
    }, [pageKey, clear]);

    // Resize observer
    useEffect(() => {
      resize();
      const container = containerRef.current;
      if (!container) return;
      if (typeof ResizeObserver === "undefined") {
        window.addEventListener("resize", resize);
        return () => window.removeEventListener("resize", resize);
      }
      const ro = new ResizeObserver(() => resize());
      ro.observe(container);
      return () => ro.disconnect();
    }, [resize]);

    const getPoint = (e: PointerEvent, canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const updateCursor = useCallback((x: number, y: number, visible: boolean) => {
      const el = cursorRef.current;
      if (!el) return;
      if (!visible || !eraser) {
        el.style.opacity = "0";
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(0.85)`;
        return;
      }
      const size = eraserWidth;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.opacity = "1";
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }, [eraser, eraserWidth]);

    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!enabled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const penEraser =
          (e as unknown as PointerEvent & { pointerType?: string; button?: number }).pointerType === "pen" &&
          ((e as unknown as PointerEvent & { button?: number }).button === 5 ||
            (((e as unknown as PointerEvent & { buttons?: number }).buttons & 32) === 32));
        if (penEraser) {
          (e.currentTarget as HTMLElement).dataset.penEraser = "1";
        }
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        isDrawing.current = true;
        const p = getPoint(e.nativeEvent as PointerEvent, canvas);
        lastPos.current = p;
        // show cursor immediately
        if (eraser || penEraser) updateCursor(p.x, p.y, true);
        onDrawStart?.();

        // also draw initial dot immediately so single tap is visible and we don't wait for move
        const ctx = getCtx();
        if (ctx) {
          const isPenEraserActive = (e.currentTarget as HTMLElement).dataset.penEraser === "1";
          const useEraser = eraser || isPenEraserActive;
          const pressure = (e.nativeEvent as PointerEvent & { pressure?: number }).pressure;
          const isPen = (e.nativeEvent as PointerEvent & { pointerType?: string }).pointerType === "pen";
          const pf = isPen && typeof pressure === "number" && pressure > 0 ? 0.5 + pressure * 0.9 : 1;
          const lw = (useEraser ? eraserWidth : strokeWidth) * pf;
          ctx.save();
          ctx.globalCompositeOperation = useEraser ? "destination-out" : "source-over";
          if (useEraser) {
            ctx.fillStyle = "rgba(0,0,0,1)";
          } else {
            ctx.fillStyle = color;
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, lw / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      },
      [enabled, onDrawStart, eraser, eraserWidth, strokeWidth, color, getCtx, updateCursor]
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        const ctx = getCtx();
        if (!canvas || !ctx) return;

        // always update eraser cursor position (even when not drawing) — important for hover preview
        const rawNative = e.nativeEvent as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] };
        const isPenEraserActive = (e.currentTarget as HTMLElement).dataset.penEraser === "1";
        const useEraser = eraser || isPenEraserActive;

        // cursor hover update (use current event point)
        const hoverPt = getPoint(rawNative as unknown as PointerEvent, canvas);
        if (useEraser) updateCursor(hoverPt.x, hoverPt.y, true);

        if (!enabled || !isDrawing.current) return;

        // coalesced events give us every intermediate hardware point → no gaps even on fast strokes
        const events: PointerEvent[] = rawNative.getCoalescedEvents ? rawNative.getCoalescedEvents() : [rawNative as unknown as PointerEvent];

        for (const ev of events) {
          const cur = getPoint(ev, canvas);
          const prev = lastPos.current;
          if (!prev) {
            lastPos.current = cur;
            continue;
          }

          const pressure = (ev as PointerEvent & { pressure?: number }).pressure;
          const isPen = (ev as PointerEvent & { pointerType?: string }).pointerType === "pen";
          const pressureFactor = isPen && typeof pressure === "number" && pressure > 0 ? 0.5 + pressure * 0.9 : 1;

          const lineW = (useEraser ? eraserWidth : strokeWidth) * pressureFactor;

          ctx.save();
          ctx.globalCompositeOperation = useEraser ? "destination-out" : "source-over";
          ctx.strokeStyle = useEraser ? "rgba(0,0,0,1)" : color;
          ctx.lineWidth = lineW;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          // perfectly gapless: single segment per coalesced step
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          // Use straight line for gapless guarantee; round caps/joins make it look smooth.
          // For even smoother curves we could quadratic-interpolate, but lineTo + coalesced events is already smooth.
          ctx.lineTo(cur.x, cur.y);
          ctx.stroke();
          ctx.restore();

          lastPos.current = cur;
        }
      },
      [enabled, color, strokeWidth, eraser, eraserWidth, getCtx, updateCursor]
    );

    const handlePointerUp = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!enabled) return;
        const canvas = canvasRef.current;
        const ctx = getCtx();
        // if there was no move, we already drew a dot on pointerDown; but keep fallback for safety
        if (canvas && ctx && isDrawing.current && lastPos.current) {
          const cur = getPoint(e.nativeEvent as PointerEvent, canvas);
          const prev = lastPos.current;
          const dist = Math.hypot(cur.x - prev.x, cur.y - prev.y);
          if (dist < 1.2 && prev === lastPos.current) {
            const isPenEraserActive = (e.currentTarget as HTMLElement).dataset.penEraser === "1";
            const useEraser = eraser || isPenEraserActive;
            const pf = 1;
            const lw = (useEraser ? eraserWidth : strokeWidth) * pf;
            ctx.save();
            ctx.globalCompositeOperation = useEraser ? "destination-out" : "source-over";
            ctx.fillStyle = useEraser ? "rgba(0,0,0,1)" : color;
            ctx.beginPath();
            ctx.arc(cur.x, cur.y, lw / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
        isDrawing.current = false;
        lastPos.current = null;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
        } catch {}
        try {
          delete (e.currentTarget as HTMLElement).dataset.penEraser;
        } catch {}
        // keep cursor visible at up point for eraser hover
        if (eraser) {
          const canvas2 = canvasRef.current;
          if (canvas2) {
            const pt = getPoint(e.nativeEvent as PointerEvent, canvas2);
            updateCursor(pt.x, pt.y, true);
          }
        } else {
          // hide if pen
          updateCursor(0, 0, false);
        }
        onDrawEnd?.();
      },
      [enabled, color, strokeWidth, eraser, eraserWidth, getCtx, onDrawEnd, updateCursor]
    );

    const handlePointerEnter = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const isPenEraserActive = (e.currentTarget as HTMLElement).dataset.penEraser === "1";
      const useEraser = eraser || isPenEraserActive;
      if (!useEraser) return;
      const pt = getPoint(e.nativeEvent as PointerEvent, canvas);
      updateCursor(pt.x, pt.y, true);
    }, [eraser, updateCursor]);

    const handlePointerLeave = useCallback(() => {
      updateCursor(0, 0, false);
      // if still drawing and pointer left canvas, don't break — capture keeps it
      if (isDrawing.current) return;
    }, [updateCursor]);

    // also handle global pointer move for cursor when not captured? already covered

    return (
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: enabled ? "auto" : "none" }}
        aria-hidden="true"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none select-none"
          style={{
            touchAction: "none",
            pointerEvents: enabled ? "auto" : "none",
            cursor: enabled ? (eraser ? "none" : "crosshair") : "default",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onContextMenu={(e) => e.preventDefault()}
        />
        {/* Eraser preview circle — visible only in eraser mode, follows pointer */}
        <div
          ref={cursorRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-[2] rounded-full hidden sm:block"
          style={{
            width: eraserWidth,
            height: eraserWidth,
            opacity: 0,
            transform: "translate(0,0) translate(-50%, -50%)",
            transition: "opacity 110ms ease, width 120ms ease, height 120ms ease, transform 0s",
            background: "rgba(255,255,255,0.38)",
            backdropFilter: "blur(1px)",
            border: "2px solid rgba(15,23,42,0.92)",
            boxShadow: "0 0 0 2px rgba(255,255,255,0.96), 0 3px 12px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.7)",
          }}
        >
          {/* inner crosshair for precision */}
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              width: 10,
              height: 10,
              display: "block",
            }}
          >
            <span className="absolute left-1/2 top-0 -translate-x-1/2 w-px h-full bg-slate-900/55" />
            <span className="absolute top-1/2 left-0 -translate-y-1/2 w-full h-px bg-slate-900/55" />
          </span>
        </div>
      </div>
    );
  }
);

AnnotationCanvas.displayName = "AnnotationCanvas";
