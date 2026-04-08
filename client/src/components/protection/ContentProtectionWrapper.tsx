import { useEffect, useRef, useState } from "react";

interface ContentProtectionWrapperProps {
  children: React.ReactNode;
  watermarkText?: string;
  enabled?: boolean;
  /** When true, wrapper fills parent height (use for PDF/flipbook that needs constrained height) */
  fillHeight?: boolean;
}

export function ContentProtectionWrapper({
  children,
  watermarkText,
  enabled = true,
  fillHeight = false,
}: ContentProtectionWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tabHidden, setTabHidden] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block PrintScreen
      if (e.key === "PrintScreen") {
        e.preventDefault();
      }
      // Block Ctrl+P (print), Ctrl+S (save), Ctrl+Shift+I (devtools)
      if (e.ctrlKey && (e.key === "p" || e.key === "s")) {
        e.preventDefault();
      }
      if (e.ctrlKey && e.shiftKey && e.key === "I") {
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);

  // Hide content when tab loses focus (anti-screenshot)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [enabled]);

  if (!enabled) return <>{children}</>;

  return (
    <div
      ref={containerRef}
      className={`relative select-none ${fillHeight ? "h-full flex flex-col" : ""}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={{ WebkitUserSelect: "none", userSelect: "none" }}
    >
      {/* Print blocker */}
      <style>{`@media print { .content-protected { display: none !important; visibility: hidden !important; } }`}</style>

      <div className={`content-protected ${fillHeight ? "flex-1 min-h-0 flex flex-col" : ""}`}>
        {children}
      </div>

      {/* Tab-hidden overlay (anti-screenshot when switching away) */}
      {tabHidden && (
        <div className="absolute inset-0 z-50 bg-white dark:bg-slate-950 flex items-center justify-center">
          <p className="text-muted-foreground text-lg font-medium">
            Content hidden — return to this tab to continue viewing
          </p>
        </div>
      )}

      {/* Watermark overlay */}
      {watermarkText && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10" aria-hidden="true">
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 150px,
              rgba(0,0,0,0.02) 150px,
              rgba(0,0,0,0.02) 151px
            )`,
          }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="absolute text-black/[0.04] dark:text-white/[0.06] text-sm font-medium whitespace-nowrap"
                style={{
                  transform: "rotate(-35deg)",
                  top: `${(i % 4) * 25 + 5}%`,
                  left: `${Math.floor(i / 4) * 35 - 10}%`,
                }}
              >
                {watermarkText}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
