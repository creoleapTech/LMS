import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";

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
    const isDrawing = useRef(false);
    const lastPos = useRef<{ x: number; y: number } | null>(null);
    // For DPR
    const dprRef = useRef<number>(1);

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
      // Save existing content as data URL if we want to preserve, but per spec we clear on resize/page change anyway
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    }, []);

    const clear = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = getCtx();
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
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

    // Also re-apply ctx settings when color/width/eraser changes (for next stroke)
    const getPoint = (e: PointerEvent | React.PointerEvent, canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!enabled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        isDrawing.current = true;
        lastPos.current = getPoint(e as unknown as PointerEvent, canvas);
        onDrawStart?.();
      },
      [enabled, onDrawStart]
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!enabled || !isDrawing.current) return;
        const canvas = canvasRef.current;
        const ctx = getCtx();
        if (!canvas || !ctx) return;
        const cur = getPoint(e as unknown as PointerEvent, canvas);
        const prev = lastPos.current;
        if (!prev) {
          lastPos.current = cur;
          return;
        }
        ctx.save();
        ctx.globalCompositeOperation = eraser ? "destination-out" : "source-over";
        ctx.strokeStyle = eraser ? "rgba(0,0,0,1)" : color;
        ctx.lineWidth = eraser ? strokeWidth * 2 : strokeWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        // Use quadratic for smoother
        const midX = (prev.x + cur.x) / 2;
        const midY = (prev.y + cur.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
        ctx.stroke();
        ctx.restore();
        lastPos.current = cur;
      },
      [enabled, color, strokeWidth, eraser, getCtx]
    );

    const handlePointerUp = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!enabled) return;
        // Finish stroke with last segment
        const canvas = canvasRef.current;
        const ctx = getCtx();
        if (canvas && ctx && isDrawing.current && lastPos.current) {
          // Ensure dot for single tap
          const cur = getPoint(e as unknown as PointerEvent, canvas);
          const prev = lastPos.current;
          // If barely moved, draw a dot
          const dist = Math.hypot(cur.x - prev.x, cur.y - prev.y);
          if (dist < 1) {
            ctx.save();
            ctx.globalCompositeOperation = eraser ? "destination-out" : "source-over";
            ctx.fillStyle = eraser ? "rgba(0,0,0,1)" : color;
            ctx.beginPath();
            ctx.arc(cur.x, cur.y, (eraser ? strokeWidth * 2 : strokeWidth) / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
        isDrawing.current = false;
        lastPos.current = null;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
        } catch {}
        onDrawEnd?.();
      },
      [enabled, color, strokeWidth, eraser, getCtx, onDrawEnd]
    );

    return (
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: enabled ? "auto" : "none" }}
        aria-hidden="true"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          style={{ touchAction: "none", pointerEvents: enabled ? "auto" : "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    );
  }
);

AnnotationCanvas.displayName = "AnnotationCanvas";
