import { PenTool, Eraser, Trash2, Palette, Minus, Plus, X, Pencil, Highlighter } from "lucide-react";
import { useState } from "react";

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
  /** Compact for narrow panels (split screen) */
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

  if (!enabled) {
    return (
      <button
        onClick={() => onToggle(true)}
        className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-semibold shadow-md border border-amber-600 transition-colors"
        title="Enable annotation"
      >
        <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        Annotate
      </button>
    );
  }

  // vertical toolbar — floating left side, hidden on mobile by parent (hidden sm:flex)
  return (
    <div
      className={`flex flex-col items-stretch gap-3 p-2.5 rounded-[22px] bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/70 dark:border-slate-700/60 shadow-[0_18px_45px_rgba(0,0,0,0.18),0_4px_14px_rgba(0,0,0,0.10)] w-[76px] sm:w-[82px] max-h-[min(88vh,560px)] overflow-y-auto overflow-x-hidden scrollbar-thin
        ${compact ? "scale-[0.92] sm:scale-100 origin-top" : ""}`}
      style={{ scrollbarWidth: "thin" }}
    >
      {/* header / annotate label */}
      <div className="flex items-center justify-center gap-1.5 pt-1">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
          <Highlighter className="w-3 h-3" />
          <span className="text-[9px] font-extrabold tracking-[0.14em] uppercase leading-none">Draw</span>
        </span>
      </div>

      {/* Pen / Eraser — vertical segmented control */}
      <div className="flex flex-col gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/40">
        <button
          onClick={() => onEraserChange(false)}
          className={`relative w-full h-[46px] flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold transition-all ${
            !eraser
              ? "bg-white dark:bg-slate-700 shadow-[0_2px_10px_rgba(0,0,0,0.09)] text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-200/60 dark:ring-slate-600"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-700/40"
          }`}
          title="Pen"
          aria-label="Pen"
          aria-pressed={!eraser}
        >
          <PenTool className="w-[18px] h-[18px]" />
          <span className="leading-none tracking-wide">Pen</span>
        </button>
        <button
          onClick={() => onEraserChange(true)}
          className={`relative w-full h-[46px] flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold transition-all ${
            eraser
              ? "bg-white dark:bg-slate-700 shadow-[0_2px_10px_rgba(0,0,0,0.09)] text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-200/60 dark:ring-slate-600"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-700/40"
          }`}
          title="Eraser — noticeably larger"
          aria-label="Eraser"
          aria-pressed={eraser}
        >
          <Eraser className="w-[18px] h-[18px]" />
          <span className="leading-none tracking-wide">Erase</span>
          {eraser && <span className="absolute -right-1 -top-1 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-slate-800 animate-pulse" />}
        </button>
      </div>

      {/* Colors — vertical grid */}
      <div className="flex flex-col items-center gap-2 px-1">
        <span className="text-[9px] font-bold tracking-[0.16em] uppercase text-slate-400 dark:text-slate-500">Colour</span>
        <div className="grid grid-cols-2 gap-2">
          {COLORS.map((c) => {
            const active = color === c && !eraser;
            return (
              <button
                key={c}
                onClick={() => {
                  onColorChange(c);
                  onEraserChange(false);
                }}
                className={`relative w-[28px] h-[28px] rounded-full border-[2.5px] flex items-center justify-center transition-all duration-150 ${
                  active
                    ? "border-indigo-600 dark:border-indigo-400 scale-[1.08] shadow-[0_2px_10px_rgba(79,70,229,0.35)] ring-2 ring-indigo-200 dark:ring-indigo-900"
                    : "border-white dark:border-slate-600 shadow-sm hover:scale-105 hover:shadow-md"
                }`}
                style={{ backgroundColor: c }}
                title={c}
                aria-label={`Color ${c}`}
              >
                {active && <span className="absolute inset-0 rounded-full ring-1 ring-white/70 pointer-events-none" />}
                {c === "#ffffff" && (
                  <span className="w-3 h-3 rounded-full border border-slate-300 bg-white shadow-inner" />
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setShowPalette((v) => !v)}
          className={`w-full h-7 rounded-full border border-dashed flex items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
            showPalette
              ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-300"
              : "border-slate-300 dark:border-slate-600 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
          title="More colours"
        >
          <Palette className="w-3 h-3" />
          {showPalette ? "Less" : "More"}
        </button>

        {showPalette && (
          <div className="w-full flex flex-col gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/40 animate-in fade-in slide-in-from-top-1">
            <label className="flex items-center gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-400">
              <input
                type="color"
                value={color}
                onChange={(e) => {
                  onColorChange(e.target.value);
                  onEraserChange(false);
                }}
                className="w-8 h-8 rounded-lg cursor-pointer p-0 border-2 border-white dark:border-slate-700 shadow-sm shrink-0"
                title="Custom colour"
              />
              Custom
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c + "-2"}
                  onClick={() => {
                    onColorChange(c);
                    onEraserChange(false);
                  }}
                  className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-700 shadow hover:scale-105 transition-transform"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* divider */}
      <div className="h-px w-full bg-slate-200/70 dark:bg-slate-700/50" />

      {/* Stroke width — vertical control with preview */}
      <div className="flex flex-col items-center gap-2 p-2 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/40 dark:border-slate-700/30">
        <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-slate-500 dark:text-slate-400">
          {eraser ? "Eraser" : "Size"}
        </span>

        {/* live preview dot */}
        <div className="w-full flex items-center justify-center h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/50 shadow-inner">
          <span
            className="rounded-full transition-all duration-150 shrink-0"
            style={{
              width: Math.min(28, Math.max(4, eraser ? Math.max(18, Math.min(28, strokeWidth * 1.35 + 10)) : strokeWidth * 1.7 + 4)),
              height: Math.min(28, Math.max(4, eraser ? Math.max(18, Math.min(28, strokeWidth * 1.35 + 10)) : strokeWidth * 1.7 + 4)),
              backgroundColor: eraser ? "rgba(15,23,42,0.12)" : color,
              border: eraser ? "1.5px solid rgba(15,23,42,0.28)" : `1.5px solid ${color === "#ffffff" ? "rgba(148,163,184,0.5)" : "transparent"}`,
              boxShadow: eraser ? "inset 0 0 0 1px rgba(255,255,255,0.9)" : "none",
            }}
          />
        </div>

        <div className="flex flex-col items-center gap-1 w-full">
          <button
            onClick={() => onWidthChange(Math.min(20, WIDTHS[WIDTHS.indexOf(strokeWidth) + 1] ?? strokeWidth + 1))}
            className="w-full h-8 flex items-center justify-center rounded-xl bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 shadow-sm hover:shadow transition-all text-slate-700 dark:text-slate-200 hover:text-indigo-600"
            aria-label="Thicker"
            title="Thicker"
          >
            <Plus className="w-4 h-4" />
          </button>
          <span className="text-xs font-extrabold tabular-nums text-slate-700 dark:text-slate-200 min-h-[18px] flex items-center">
            {strokeWidth}
            <span className="ml-0.5 text-[10px] font-semibold text-slate-400">px</span>
          </span>
          <button
            onClick={() => onWidthChange(Math.max(1, WIDTHS[WIDTHS.indexOf(strokeWidth) - 1] ?? strokeWidth - 1))}
            className="w-full h-8 flex items-center justify-center rounded-xl bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 shadow-sm hover:shadow transition-all text-slate-700 dark:text-slate-200 hover:text-indigo-600"
            aria-label="Thinner"
            title="Thinner"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        {eraser && (
          <span className="text-[10px] leading-tight text-center font-medium text-slate-500 dark:text-slate-400 px-1">
            ~{Math.max(34, strokeWidth * 6)}px
          </span>
        )}
      </div>

      {/* Actions — vertical stack at bottom */}
      <div className="flex flex-col gap-2 mt-auto">
        <button
          onClick={onClear}
          className="w-full h-10 flex flex-col items-center justify-center gap-0.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/30 text-red-600 dark:text-red-300 border border-red-200/80 dark:border-red-900/40 shadow-sm hover:shadow transition-all"
          title="Clear all annotations on this page"
          aria-label="Clear"
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-[10px] font-bold leading-none tracking-wide">Clear</span>
        </button>

        <div className="h-px w-full bg-slate-200/60 dark:bg-slate-700/40" />

        <button
          onClick={() => {
            onToggle(false);
            onClose?.();
          }}
          className="w-full h-10 flex flex-col items-center justify-center gap-0.5 rounded-xl bg-slate-900 hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-all"
          title="Exit annotation"
          aria-label="Exit"
        >
          <X className="w-4 h-4" />
          <span className="text-[10px] font-bold leading-none tracking-wide">Exit</span>
        </button>
      </div>
    </div>
  );
}
