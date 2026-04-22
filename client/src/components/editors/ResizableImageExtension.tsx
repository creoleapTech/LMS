import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { useRef, useState, useCallback, useEffect } from "react";
import { Crop, X, Check, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

// ── Crop Modal ────────────────────────────────────────────────────────────────

interface CropArea { x: number; y: number; w: number; h: number }

function CropModal({
  src,
  onDone,
  onCancel,
}: {
  src: string;
  onDone: (croppedSrc: string) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<CropArea>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }); // normalized 0-1
  const [dragging, setDragging] = useState<null | "move" | "tl" | "tr" | "bl" | "br">(null);
  const dragStart = useRef<{ mx: number; my: number; crop: CropArea } | null>(null);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      // Fit to max 600x400 display
      const maxW = 600, maxH = 400;
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      setDisplaySize({ w: Math.round(img.naturalWidth * scale), h: Math.round(img.naturalHeight * scale) });
    };
    img.src = src;
  }, [src]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || displaySize.w === 0) return;
    canvas.width = displaySize.w;
    canvas.height = displaySize.h;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, displaySize.w, displaySize.h);
    ctx.drawImage(img, 0, 0, displaySize.w, displaySize.h);

    // Darken outside crop
    const cx = crop.x * displaySize.w;
    const cy = crop.y * displaySize.h;
    const cw = crop.w * displaySize.w;
    const ch = crop.h * displaySize.h;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, displaySize.w, cy);
    ctx.fillRect(0, cy + ch, displaySize.w, displaySize.h - cy - ch);
    ctx.fillRect(0, cy, cx, ch);
    ctx.fillRect(cx + cw, cy, displaySize.w - cx - cw, ch);

    // Crop border
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, cw, ch);

    // Rule-of-thirds grid
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(cx + (cw / 3) * i, cy); ctx.lineTo(cx + (cw / 3) * i, cy + ch); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy + (ch / 3) * i); ctx.lineTo(cx + cw, cy + (ch / 3) * i); ctx.stroke();
    }

    // Corner handles
    const hs = 10;
    ctx.fillStyle = "#6366f1";
    [[cx, cy], [cx + cw - hs, cy], [cx, cy + ch - hs], [cx + cw - hs, cy + ch - hs]].forEach(([hx, hy]) => {
      ctx.fillRect(hx, hy, hs, hs);
    });
  }, [crop, displaySize]);

  const getHandle = useCallback((mx: number, my: number): typeof dragging => {
    const cx = crop.x * displaySize.w;
    const cy = crop.y * displaySize.h;
    const cw = crop.w * displaySize.w;
    const ch = crop.h * displaySize.h;
    const hs = 14;
    if (mx >= cx && mx <= cx + hs && my >= cy && my <= cy + hs) return "tl";
    if (mx >= cx + cw - hs && mx <= cx + cw && my >= cy && my <= cy + hs) return "tr";
    if (mx >= cx && mx <= cx + hs && my >= cy + ch - hs && my <= cy + ch) return "bl";
    if (mx >= cx + cw - hs && mx <= cx + cw && my >= cy + ch - hs && my <= cy + ch) return "br";
    if (mx >= cx && mx <= cx + cw && my >= cy && my <= cy + ch) return "move";
    return null;
  }, [crop, displaySize]);

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const handle = getHandle(mx, my);
    if (!handle) return;
    setDragging(handle);
    dragStart.current = { mx, my, crop: { ...crop } };
    e.preventDefault();
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !dragStart.current || displaySize.w === 0) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const dx = (mx - dragStart.current.mx) / displaySize.w;
    const dy = (my - dragStart.current.my) / displaySize.h;
    const prev = dragStart.current.crop;
    const minSize = 0.05;

    setCrop((c) => {
      let { x, y, w, h } = prev;
      if (dragging === "move") {
        x = Math.max(0, Math.min(1 - w, prev.x + dx));
        y = Math.max(0, Math.min(1 - h, prev.y + dy));
      } else if (dragging === "tl") {
        const nx = Math.max(0, Math.min(prev.x + prev.w - minSize, prev.x + dx));
        const ny = Math.max(0, Math.min(prev.y + prev.h - minSize, prev.y + dy));
        w = prev.x + prev.w - nx;
        h = prev.y + prev.h - ny;
        x = nx; y = ny;
      } else if (dragging === "tr") {
        const ny = Math.max(0, Math.min(prev.y + prev.h - minSize, prev.y + dy));
        w = Math.max(minSize, Math.min(1 - prev.x, prev.w + dx));
        h = prev.y + prev.h - ny;
        y = ny;
      } else if (dragging === "bl") {
        const nx = Math.max(0, Math.min(prev.x + prev.w - minSize, prev.x + dx));
        w = prev.x + prev.w - nx;
        h = Math.max(minSize, Math.min(1 - prev.y, prev.h + dy));
        x = nx;
      } else if (dragging === "br") {
        w = Math.max(minSize, Math.min(1 - prev.x, prev.w + dx));
        h = Math.max(minSize, Math.min(1 - prev.y, prev.h + dy));
      }
      return { x, y, w, h };
    });
  }, [dragging, displaySize]);

  const onMouseUp = useCallback(() => { setDragging(null); dragStart.current = null; }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  const applyCrop = () => {
    const img = imgRef.current;
    if (!img) return;
    const out = document.createElement("canvas");
    const sx = Math.round(crop.x * img.naturalWidth);
    const sy = Math.round(crop.y * img.naturalHeight);
    const sw = Math.round(crop.w * img.naturalWidth);
    const sh = Math.round(crop.h * img.naturalHeight);
    out.width = sw;
    out.height = sh;
    out.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    onDone(out.toDataURL("image/png"));
  };

  const resetCrop = () => setCrop({ x: 0, y: 0, w: 1, h: 1 });

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 flex flex-col gap-4 max-w-[680px] w-full mx-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Crop className="h-4 w-4 text-indigo-600" /> Crop Image
          </h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500">Drag the corners or the crop area to adjust. Click Apply when done.</p>

        <div ref={containerRef} className="flex items-center justify-center bg-slate-100 rounded-xl overflow-hidden" style={{ minHeight: 200 }}>
          {displaySize.w > 0 ? (
            <canvas
              ref={canvasRef}
              onMouseDown={onMouseDown}
              style={{ cursor: dragging ? "grabbing" : "crosshair", display: "block", maxWidth: "100%" }}
            />
          ) : (
            <div className="text-slate-400 text-sm py-12">Loading image…</div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button onClick={resetCrop} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-4 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={applyCrop} className="px-4 py-1.5 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1.5">
              <Check className="h-4 w-4" /> Apply Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Resizable Image Node View ─────────────────────────────────────────────────

function ResizableImageView({ node, updateAttributes, selected }: any) {
  const [showCrop, setShowCrop] = useState(false);
  const [resizing, setResizing] = useState(false);
  const startRef = useRef<{ x: number; w: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const width = node.attrs.width || "auto";
  const src = node.attrs.src;

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const currentW = imgRef.current?.offsetWidth || 300;
    startRef.current = { x: e.clientX, w: currentW };
    setResizing(true);

    const onMove = (ev: MouseEvent) => {
      if (!startRef.current) return;
      const newW = Math.max(80, startRef.current.w + (ev.clientX - startRef.current.x));
      updateAttributes({ width: newW });
    };
    const onUp = () => {
      setResizing(false);
      startRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleCropDone = (croppedSrc: string) => {
    updateAttributes({ src: croppedSrc, width: "auto" });
    setShowCrop(false);
  };

  return (
    <NodeViewWrapper className="inline-block relative group" data-drag-handle>
      <div className="relative inline-block">
        <img
          ref={imgRef}
          src={src}
          alt={node.attrs.alt || ""}
          style={{
            width: typeof width === "number" ? `${width}px` : width,
            display: "block",
            borderRadius: 8,
            outline: selected ? "2px solid #6366f1" : "none",
            outlineOffset: 2,
            cursor: resizing ? "ew-resize" : "default",
            userSelect: "none",
          }}
          draggable={false}
        />

        {/* Resize handle — right edge */}
        {selected && (
          <div
            onMouseDown={onResizeStart}
            className="absolute top-1/2 -translate-y-1/2 -right-2 w-4 h-8 bg-indigo-600 rounded-full cursor-ew-resize flex items-center justify-center shadow-lg z-10 opacity-90 hover:opacity-100"
            title="Drag to resize"
          >
            <div className="flex flex-col gap-0.5">
              <div className="w-0.5 h-3 bg-white rounded-full" />
            </div>
          </div>
        )}

        {/* Image toolbar — appears on select */}
        {selected && (
          <div className="absolute -top-9 left-0 flex items-center gap-1 bg-slate-800 text-white rounded-lg px-2 py-1 shadow-xl z-20">
            <button
              onMouseDown={(e) => { e.preventDefault(); setShowCrop(true); }}
              className="flex items-center gap-1 text-xs font-medium hover:text-indigo-300 transition-colors px-1.5 py-0.5 rounded"
              title="Crop image"
            >
              <Crop className="h-3.5 w-3.5" /> Crop
            </button>
            <div className="w-px h-4 bg-white/20" />
            <button
              onMouseDown={(e) => { e.preventDefault(); updateAttributes({ width: "auto" }); }}
              className="flex items-center gap-1 text-xs font-medium hover:text-indigo-300 transition-colors px-1.5 py-0.5 rounded"
              title="Reset size"
            >
              <ZoomOut className="h-3.5 w-3.5" /> Reset
            </button>
            <div className="w-px h-4 bg-white/20" />
            <span className="text-xs text-white/50 px-1">
              {typeof width === "number" ? `${width}px` : "auto"}
            </span>
          </div>
        )}
      </div>

      {showCrop && (
        <CropModal
          src={src}
          onDone={handleCropDone}
          onCancel={() => setShowCrop(false)}
        />
      )}
    </NodeViewWrapper>
  );
}

// ── Tiptap Extension ──────────────────────────────────────────────────────────

export const ResizableImage = Node.create({
  name: "resizableImage",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: "auto" },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { width, ...rest } = HTMLAttributes;
    const style = width && width !== "auto" ? `width:${typeof width === "number" ? width + "px" : width};` : "";
    return ["img", mergeAttributes(rest, { style, class: "rounded-lg my-2" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },

  addCommands() {
    return {
      setResizableImage:
        (attrs: { src: string; alt?: string; title?: string }) =>
        ({ commands }: any) => {
          return commands.insertContent({ type: this.name, attrs });
        },
    } as any;
  },
});
