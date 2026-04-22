import { useEffect, useRef, useState, useMemo } from "react";

interface ContentProtectionWrapperProps {
  children: React.ReactNode;
  watermarkText?: string;
  enabled?: boolean;
  fillHeight?: boolean;
}

/** Build a tiled watermark as a base64 PNG data URL using canvas */
function buildWatermarkDataUrl(text: string): string {
  const canvas = document.createElement("canvas");
  const tileW = 320;
  const tileH = 160;
  canvas.width = tileW;
  canvas.height = tileH;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, tileW, tileH);
  ctx.save();

  // Rotate around tile centre
  ctx.translate(tileW / 2, tileH / 2);
  ctx.rotate(-Math.PI / 6); // -30°

  ctx.font = "600 15px system-ui, sans-serif";
  ctx.fillStyle = "rgba(0,0,0,0.07)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Draw the text centred — it will tile seamlessly
  ctx.fillText(text, 0, 0);

  ctx.restore();
  return canvas.toDataURL("image/png");
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
