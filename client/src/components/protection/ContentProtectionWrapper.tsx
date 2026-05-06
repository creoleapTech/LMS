import { useEffect, useRef, useState, useMemo } from "react";
import { buildWatermarkDataUrl } from "../../lib/watermarkUtils";

interface ContentProtectionWrapperProps {
  children: React.ReactNode;
  watermarkText?: string;
  enabled?: boolean;
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

  // Build the tiled watermark image once per text value
  const watermarkBg = useMemo(() => {
    if (!watermarkText) return null;
    return buildWatermarkDataUrl(watermarkText);
  }, [watermarkText]);

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") e.preventDefault();
      if (e.ctrlKey && (e.key === "p" || e.key === "s")) e.preventDefault();
      if (e.ctrlKey && e.shiftKey && e.key === "I") e.preventDefault();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);

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
      className={`relative select-none overflow-hidden ${fillHeight ? "h-full flex flex-col" : "w-full"}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={{ WebkitUserSelect: "none", userSelect: "none" }}
    >
      <style>{`@media print { .content-protected { display: none !important; } }`}</style>

      {/* Content */}
      <div className={`content-protected ${fillHeight ? "flex-1 min-h-0 flex flex-col" : ""}`}>
        {children}
      </div>

      {/* Tiled watermark — sits exactly over the content, never outside */}
      {watermarkBg && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none z-10 rounded-[inherit]"
          style={{
            backgroundImage: `url(${watermarkBg})`,
            backgroundRepeat: "repeat",
            backgroundSize: "320px 160px",
          }}
        />
      )}

      {/* Tab-hidden overlay */}
      {tabHidden && (
        <div className="absolute inset-0 z-50 bg-white dark:bg-slate-950 flex items-center justify-center rounded-[inherit]">
          <p className="text-muted-foreground text-lg font-medium">
            Content hidden — return to this tab to continue viewing
          </p>
        </div>
      )}
    </div>
  );
}
