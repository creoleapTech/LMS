import { PenTool, Eraser, Trash2, Palette, Minus, Plus, X, Pencil } from "lucide-react";
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

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl backdrop-blur max-w-[min(100vw-16px,36rem)] ${
        compact ? "scale-[0.9] sm:scale-100 origin-center" : ""
      }`}
    >
      {/* Pen / Eraser toggle */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
        <button
          onClick={() => onEraserChange(false)}
          className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-md transition-colors ${
            !eraser ? "bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-300" : "text-slate-500 hover:bg-white/60"
          }`}
          title="Pen"
          aria-label="Pen"
          aria-pressed={!eraser}
        >
          <PenTool className="w-4 h-4" />
        </button>
        <button
          onClick={() => onEraserChange(true)}
          className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-md transition-colors ${
            eraser ? "bg-white dark:bg-slate-700 shadow text-indigo-600" : "text-slate-500 hover:bg-white/60"
          }`}
          title="Eraser"
          aria-label="Eraser"
          aria-pressed={eraser}
        >
          <Eraser className="w-4 h-4" />
        </button>
      </div>

      {/* Colors */}
      <div className="hidden sm:flex items-center gap-1">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => {
              onColorChange(c);
              onEraserChange(false);
            }}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-all ${
              color === c && !eraser ? "border-indigo-600 scale-110 shadow" : "border-white dark:border-slate-600 hover:scale-105"
            }`}
            style={{ backgroundColor: c }}
            title={c}
            aria-label={`Color ${c}`}
          >
            {c === "#ffffff" && <span className="w-3 h-3 rounded-full border border-slate-300" />}
          </button>
        ))}
        <button
          onClick={() => setShowPalette((v) => !v)}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center hover:border-indigo-400"
          title="More colors"
        >
          <Palette className="w-3.5 h-3.5 text-slate-500" />
        </button>
      </div>

      {/* Mobile palette trigger */}
      <button
        onClick={() => setShowPalette((v) => !v)}
        className="sm:hidden w-8 h-8 rounded-full border-2 flex items-center justify-center"
        style={{ backgroundColor: color, borderColor: color === "#ffffff" ? "#cbd5e1" : color }}
        aria-label="Pick color"
      >
        <Palette className="w-3 h-3 text-white mix-blend-difference" />
      </button>

      {/* Width */}
      <div className="flex items-center gap-0.5 sm:gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
        <button
          onClick={() => onWidthChange(Math.max(1, WIDTHS[WIDTHS.indexOf(strokeWidth) - 1] ?? strokeWidth - 1))}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-white dark:hover:bg-slate-700"
          aria-label="Thinner"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="text-xs font-bold tabular-nums min-w-[1.5rem] text-center">{strokeWidth}</span>
        <button
          onClick={() => onWidthChange(Math.min(20, WIDTHS[WIDTHS.indexOf(strokeWidth) + 1] ?? strokeWidth + 1))}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-white dark:hover:bg-slate-700"
          aria-label="Thicker"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Clear */}
      <button
        onClick={onClear}
        className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800"
        title="Clear all annotations on this page"
        aria-label="Clear"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden sm:block" />

      <button
        onClick={() => {
          onToggle(false);
          onClose?.();
        }}
        className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-slate-900 hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        title="Exit annotation"
        aria-label="Exit"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Expanded palette */}
      {showPalette && (
        <div className="w-full flex flex-wrap gap-1.5 mt-1 sm:mt-0 sm:ml-1 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-700">
          <input
            type="color"
            value={color}
            onChange={(e) => {
              onColorChange(e.target.value);
              onEraserChange(false);
            }}
            className="w-8 h-8 rounded cursor-pointer p-0 border-0"
            title="Custom color"
          />
          {COLORS.map((c) => (
            <button
              key={c + "-2"}
              onClick={() => {
                onColorChange(c);
                onEraserChange(false);
                setShowPalette(false);
              }}
              className="w-6 h-6 rounded-full border border-white shadow"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
