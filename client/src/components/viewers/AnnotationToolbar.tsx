import { PenTool, Eraser, Trash2, Palette, Minus, Plus, X, Pencil, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const COLORS = ["#ff1a1a", "#0f172a", "#2563eb", "#16a34a", "#eab308", "#ffffff"];
const WIDTHS = [2, 4, 6, 10];

interface AnnotationToolbarProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  color: string;
  onColorChange: (c: string) => void;
  strokeWidth: number;
  onWidthChange: (w: number) => void;
  eraser: boolean;
  onEraserChange: (e: boolean) => void;
  onClear: () => void;
  onClose?: () => void;
  compact?: boolean;
}

export function AnnotationToolbar({
  enabled,
  onToggle,
  color,
  onColorChange,
  strokeWidth,
  onWidthChange,
  eraser,
  onEraserChange,
  onClear,
  onClose,
  compact,
}: AnnotationToolbarProps) {
  const [showPalette, setShowPalette] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPalette) return;
    const onDown = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) setShowPalette(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showPalette]);

  if (!enabled) {
    return (
      <button
        onClick={() => onToggle(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md transition-colors"
        title="Annotate"
      >
        <Pencil className="w-3.5 h-3.5" />
        Annotate
      </button>
    );
  }

  return (
    <div
      className={`relative flex flex-col rounded-2xl bg-white/95 backdrop-blur border border-slate-200/70 shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-visible ${compact ? "scale-90 origin-top" : ""}`}
      style={{ width: 64 }}
    >
      {/* Pen / Eraser — icon buttons */}
      <div className="p-1 flex flex-col gap-0.5">
        <button
          onClick={() => onEraserChange(false)}
          className={`w-full h-10 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
            !eraser
              ? "bg-slate-900 text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
              : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          }`}
          title="Pen"
          aria-pressed={!eraser}
        >
          <PenTool className="w-4 h-4" />
        </button>
        <button
          onClick={() => onEraserChange(true)}
          className={`w-full h-10 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
            eraser
              ? "bg-slate-900 text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
              : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          }`}
          title="Eraser"
          aria-pressed={eraser}
        >
          <Eraser className="w-4 h-4" />
        </button>
      </div>

      <div className="h-px bg-slate-100 mx-2" />

      {/* Colors — 2-col grid */}
      <div className="p-1.5 flex flex-col items-center gap-1">
        <div className="grid grid-cols-2 gap-1">
          {COLORS.map((c) => {
            const active = color.toLowerCase() === c.toLowerCase() && !eraser;
            const isWhite = c === "#ffffff";
            return (
              <button
                key={c}
                onClick={() => { onColorChange(c); onEraserChange(false); }}
                className="relative w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 hover:scale-110 transition-transform"
                title={c}
              >
                {active && (
                  <span className="absolute inset-[-3px] rounded-full border-2 border-slate-900" />
                )}
                <span
                  className={`w-full h-full rounded-full border-2 transition-all ${
                    isWhite ? "border-slate-300" : "border-white"
                  } ${active ? "shadow-md" : "shadow-sm"}`}
                  style={{ backgroundColor: c }}
                />
                {active && (
                  <Check
                    className={`absolute w-2.5 h-2.5 ${isWhite || c === "#eab308" ? "text-slate-800" : "text-white"}`}
                    strokeWidth={3.5}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Palette icon */}
        <div className="relative" ref={paletteRef}>
          <button
            onClick={() => setShowPalette((v) => !v)}
            className={`w-[28px] h-[28px] rounded-full flex items-center justify-center border transition-all ${
              showPalette
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600"
            }`}
            title="More colours"
          >
            <Palette className="w-3 h-3" />
          </button>

          {showPalette && (
            <div className="absolute left-[72px] top-0 z-50 w-[164px] p-3 rounded-2xl bg-white border border-slate-200 shadow-xl flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <div className="relative w-8 h-8 rounded-lg overflow-hidden border-2 border-slate-200 shrink-0">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => { onColorChange(e.target.value); onEraserChange(false); }}
                    className="absolute -inset-2 w-[150%] h-[150%] p-0 border-0 cursor-pointer"
                  />
                </div>
                <span className="text-[11px] font-mono text-slate-500">{color}</span>
              </div>
              <div className="h-px bg-slate-100" />
              <div className="grid grid-cols-4 gap-1.5">
                {["#ff1a1a", "#f97316", "#eab308", "#16a34a", "#06b6d4", "#2563eb", "#7c3aed", "#ec4899", "#0f172a", "#64748b", "#a16207", "#ffffff"].map((c) => (
                  <button
                    key={c}
                    onClick={() => { onColorChange(c); onEraserChange(false); setShowPalette(false); }}
                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${color.toLowerCase() === c.toLowerCase() ? "border-slate-900" : "border-white"}`}
                    style={{ backgroundColor: c, boxShadow: c === "#ffffff" ? "inset 0 0 0 1px #cbd5e1" : undefined }}
                  />
                ))}
              </div>
              <span className="absolute -left-1 top-4 w-2 h-2 bg-white border-l border-b border-slate-200 rotate-45" />
            </div>
          )}
        </div>
      </div>

      <div className="h-px bg-slate-100 mx-2" />

      {/* Size — compact */}
      <div className="p-1.5 flex flex-col items-center gap-1">
        <div className="w-full h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
          <span
            className="rounded-full transition-all duration-150"
            style={{
              width: Math.min(22, Math.max(4, strokeWidth * 1.4 + 2)),
              height: Math.min(22, Math.max(4, strokeWidth * 1.4 + 2)),
              backgroundColor: eraser ? "#cbd5e1" : color,
              border: eraser ? "1.5px dashed #94a3b8" : isWhiteColor(color) ? "1px solid #e2e8f0" : "none",
              boxShadow: eraser ? "inset 0 1px 2px rgba(255,255,255,0.9)" : "0 1px 2px rgba(0,0,0,0.12)",
            }}
          />
        </div>
        <div className="flex items-center gap-0.5 w-full justify-center">
          <button
            onClick={() => onWidthChange(Math.max(1, WIDTHS[WIDTHS.indexOf(strokeWidth) - 1] ?? strokeWidth - 1))}
            className="w-[18px] h-[18px] rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors text-slate-600 shrink-0"
            aria-label="Thinner"
          >
            <Minus className="w-2.5 h-2.5" />
          </button>
          <span className="text-[11px] font-bold tabular-nums text-slate-700 min-w-[20px] text-center">
            {strokeWidth}
          </span>
          <button
            onClick={() => onWidthChange(Math.min(20, WIDTHS[WIDTHS.indexOf(strokeWidth) + 1] ?? strokeWidth + 1))}
            className="w-[18px] h-[18px] rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors text-slate-600 shrink-0"
            aria-label="Thicker"
          >
            <Plus className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      <div className="h-px bg-slate-100 mx-2" />

      {/* Clear + Exit */}
      <div className="p-1 flex flex-col gap-0.5">
        <button
          onClick={onClear}
          className="w-full h-10 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors"
          title="Clear all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => { onToggle(false); onClose?.(); }}
          className="w-full h-10 rounded-xl bg-slate-900 hover:bg-black text-white flex items-center justify-center transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
          title="Exit annotation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function isWhiteColor(c: string) {
  return c.toLowerCase() === "#ffffff";
}
