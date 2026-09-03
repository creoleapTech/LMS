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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f59e0b] hover:bg-[#d97706] text-white text-[13px] font-bold shadow-[0_2px_10px_rgba(245,158,11,0.35)] border border-[#d97706] transition-all active:scale-[0.98]"
        title="Enable annotation"
      >
        <Pencil className="w-3.5 h-3.5" />
        Annotate
      </button>
    );
  }

  return (
    <div
      className={`relative flex flex-col items-stretch rounded-[18px] bg-white border border-slate-200 shadow-[0_8px_32px_rgba(0,0,0,0.14),0_1px_3px_rgba(0,0,0,0.08)] overflow-visible
        ${compact ? "scale-[0.92] origin-top" : ""}`}
      style={{ width: 72 }}
    >
      {/* subtle inner highlight */}
      <div className="pointer-events-none absolute inset-0 rounded-[18px] ring-1 ring-white/60" />

      {/* Header — DRAW pill */}
      <div className="flex items-center justify-center pt-2.5 pb-2">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#fff7ed] border border-[#fed7aa] text-[#c2410c]">
          <Pencil className="w-3 h-3" />
          <span className="text-[11px] font-extrabold tracking-[0.08em] leading-none">DRAW</span>
        </span>
      </div>

      {/* Pen / Eraser */}
      <div className="px-2 pb-2.5">
        <div className="flex flex-col gap-1 p-1 rounded-[14px] bg-[#f8fafc] border border-slate-200/70">
          <button
            onClick={() => onEraserChange(false)}
            className={`flex flex-col items-center justify-center gap-1 rounded-[11px] h-[52px] w-full text-[11px] font-bold leading-none tracking-wide transition-all ${
              !eraser
                ? "bg-[#111827] text-white shadow-[0_2px_8px_rgba(17,24,39,0.22)]"
                : "text-slate-500 hover:text-slate-700 hover:bg-white"
            }`}
            title="Pen"
            aria-pressed={!eraser}
          >
            <PenTool className={`w-[18px] h-[18px] ${!eraser ? "text-white" : "text-slate-500"}`} strokeWidth={2.1} />
            Pen
          </button>
          <button
            onClick={() => onEraserChange(true)}
            className={`flex flex-col items-center justify-center gap-1 rounded-[11px] h-[52px] w-full text-[11px] font-bold leading-none tracking-wide transition-all ${
              eraser
                ? "bg-[#111827] text-white shadow-[0_2px_8px_rgba(17,24,39,0.22)]"
                : "text-slate-500 hover:text-slate-700 hover:bg-white"
            }`}
            title="Eraser — noticeably larger"
            aria-pressed={eraser}
          >
            <Eraser className={`w-[18px] h-[18px] ${eraser ? "text-white" : "text-slate-500"}`} strokeWidth={2.1} />
            Erase
          </button>
        </div>
      </div>

      <div className="h-px bg-slate-100 mx-3" />

      {/* Colours */}
      <div className="px-2.5 pt-3 pb-2.5 flex flex-col items-center gap-2.5">
        <span className="text-[10px] font-extrabold tracking-[0.14em] text-slate-400">COLOUR</span>

        <div className="grid grid-cols-2 gap-[9px]">
          {COLORS.map((c) => {
            const isActive = color.toLowerCase() === c.toLowerCase() && !eraser;
            const isWhite = c === "#ffffff";
            return (
              <button
                key={c}
                onClick={() => {
                  onColorChange(c);
                  onEraserChange(false);
                }}
                className="relative w-[26px] h-[26px] rounded-full flex items-center justify-center transition-all duration-150 hover:scale-[1.06] active:scale-[0.96]"
                aria-label={`Color ${c}`}
                title={c}
              >
                {/* outer ring for active */}
                <span
                  className={`absolute inset-0 rounded-full transition-all ${
                    isActive ? "ring-2 ring-[#111827] ring-offset-2 ring-offset-white" : "ring-1 ring-black/5"
                  }`}
                />
                <span
                  className={`absolute inset-[2px] rounded-full border-2 transition-all ${
                    isWhite
                      ? isActive
                        ? "border-slate-900 bg-white shadow-inner"
                        : "border-slate-300 bg-white shadow-sm"
                      : isActive
                        ? "border-white shadow-[0_1px_6px_rgba(0,0,0,0.18)]"
                        : "border-white shadow-[0_1px_4px_rgba(0,0,0,0.14)]"
                  }`}
                  style={{ backgroundColor: isWhite ? "#ffffff" : c }}
                />
                {isActive && (
                  <Check
                    className={`relative w-3.5 h-3.5 drop-shadow-sm ${
                      isWhite || c === "#eab308" ? "text-slate-900" : "text-white"
                    }`}
                    strokeWidth={3.2}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* More — popover trigger */}
        <div className="relative w-full flex justify-center" ref={paletteRef}>
          <button
            onClick={() => setShowPalette((v) => !v)}
            className={`inline-flex items-center justify-center gap-1 w-full h-[26px] rounded-full border text-[11px] font-bold transition-colors ${
              showPalette
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-slate-50 hover:bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300"
            }`}
            title="More colours"
          >
            <Palette className="w-3 h-3" />
            More
          </button>

          {showPalette && (
            <div className="absolute left-[74px] top-1/2 -translate-y-1/2 ml-2 z-50 w-[148px] p-3 rounded-2xl bg-white border border-slate-200 shadow-[0_12px_32px_rgba(0,0,0,0.16)] flex flex-col gap-3 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2.5">
                <div className="relative w-9 h-9 rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm shrink-0">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      onColorChange(e.target.value);
                      onEraserChange(false);
                    }}
                    className="absolute -inset-2 w-[150%] h-[150%] p-0 border-0 cursor-pointer"
                    title="Custom colour"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-slate-900 leading-none">Custom</span>
                  <span className="text-[10px] font-mono text-slate-500 leading-none mt-1">{color}</span>
                </div>
              </div>
              <div className="h-px bg-slate-100" />
              <div className="grid grid-cols-4 gap-2">
                {["#ff1a1a", "#f97316", "#eab308", "#16a34a", "#06b6d4", "#2563eb", "#7c3aed", "#ec4899", "#0f172a", "#64748b", "#a16207", "#ffffff"].map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      onColorChange(c);
                      onEraserChange(false);
                      setShowPalette(false);
                    }}
                    className={`w-7 h-7 rounded-full border-2 shadow-sm hover:scale-110 transition-transform ${color.toLowerCase() === c.toLowerCase() ? "border-slate-900 scale-110" : "border-white"}`}
                    style={{ backgroundColor: c, boxShadow: c === "#ffffff" ? "inset 0 0 0 1px #cbd5e1" : undefined }}
                    aria-label={c}
                  />
                ))}
              </div>
              {/* arrow */}
              <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-white border-l border-b border-slate-200 rotate-45" />
            </div>
          )}
        </div>
      </div>

      <div className="h-px bg-slate-100 mx-3" />

      {/* Size */}
      <div className="px-2.5 pt-3 pb-3 flex flex-col items-center gap-2.5">
        <span className="text-[10px] font-extrabold tracking-[0.14em] text-slate-400">{eraser ? "ERASER" : "SIZE"}</span>

        {/* preview well */}
        <div className="w-full h-[42px] rounded-[13px] bg-[#f8fafc] border border-slate-200 flex items-center justify-center relative overflow-hidden">
          {/* faint grid */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, #0f172a 1px, transparent 0)",
              backgroundSize: "10px 10px",
            }}
          />
          <span
            className="relative rounded-full transition-all duration-200 shadow-sm"
            style={{
              width: eraser ? Math.max(22, Math.min(30, Math.max(34, strokeWidth * 6) * 0.52)) : Math.min(30, Math.max(5, strokeWidth * 1.45 + 5)),
              height: eraser ? Math.max(22, Math.min(30, Math.max(34, strokeWidth * 6) * 0.52)) : Math.min(30, Math.max(5, strokeWidth * 1.45 + 5)),
              backgroundColor: eraser ? "#e2e8f0" : color,
              border: eraser ? "1.5px dashed #94a3b8" : color.toLowerCase() === "#ffffff" ? "1.5px solid #cbd5e1" : "1.5px solid rgba(255,255,255,0.0)",
              boxShadow: eraser ? "inset 0 1px 2px rgba(255,255,255,0.9)" : "0 1px 3px rgba(0,0,0,0.14)",
            }}
          />
          {eraser && (
            <span className="absolute bottom-1 text-[9px] font-bold tracking-wide text-slate-500 bg-white/90 px-1.5 py-0.5 rounded-full border border-slate-200 leading-none">
              {Math.max(34, strokeWidth * 6)}px
            </span>
          )}
        </div>

        {/* - value + row */}
        <div className="flex items-center gap-1.5 w-full justify-between">
          <button
            onClick={() => onWidthChange(Math.max(1, WIDTHS[WIDTHS.indexOf(strokeWidth) - 1] ?? strokeWidth - 1))}
            className="w-7 h-7 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 hover:shadow transition-all active:scale-95 text-slate-700 shrink-0"
            aria-label="Thinner"
            title="Thinner"
          >
            <Minus className="w-3.5 h-3.5" strokeWidth={2.4} />
          </button>

          <span className="flex-1 flex items-center justify-center gap-0.5 text-[12px] font-extrabold tabular-nums text-slate-800">
            {strokeWidth}
            <span className="text-[10px] font-bold text-slate-400 -mt-px">px</span>
          </span>

          <button
            onClick={() => onWidthChange(Math.min(20, WIDTHS[WIDTHS.indexOf(strokeWidth) + 1] ?? strokeWidth + 1))}
            className="w-7 h-7 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 hover:shadow transition-all active:scale-95 text-slate-700 shrink-0"
            aria-label="Thicker"
            title="Thicker"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />
          </button>
        </div>
      </div>

      <div className="h-px bg-slate-100 mx-3" />

      {/* Bottom actions — compact icon + label, not clipped */}
      <div className="px-2 pt-2.5 pb-2.5 flex flex-col gap-1.5">
        <button
          onClick={onClear}
          className="w-full h-[36px] rounded-[12px] bg-[#fff1f2] hover:bg-[#ffe4e6] border border-[#fecdd3] text-[#e11d48] flex items-center justify-center gap-1.5 text-[12px] font-bold transition-colors active:scale-[0.98]"
          title="Clear all annotations on this page"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={2.2} />
          Clear
        </button>

        <button
          onClick={() => {
            onToggle(false);
            onClose?.();
          }}
          className="w-full h-[36px] rounded-[12px] bg-[#0f172a] hover:bg-black text-white flex items-center justify-center gap-1.5 text-[12px] font-bold shadow-[0_2px_10px_rgba(15,23,42,0.18)] transition-colors active:scale-[0.98]"
          title="Exit annotation"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2.4} />
          Exit
        </button>
      </div>
    </div>
  );
}
