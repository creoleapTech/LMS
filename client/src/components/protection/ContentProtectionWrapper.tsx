import { useEffect, useRef, useState, useMemo, useCallback } from "react";
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
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);
  const fullscreenOverlayRef = useRef<HTMLDivElement | null>(null);

  // Build the tiled watermark image once per text value
  const watermarkBg = useMemo(() => {
    if (!watermarkText) return null;
    return buildWatermarkDataUrl(watermarkText);
  }, [watermarkText]);

  // Sync the fullscreen watermark overlay with the native fullscreen element
  useEffect(() => {
    if (!enabled || !watermarkBg) return;

    const addOverlay = (fsElement: Element) => {
      // Remove any existing overlay first
      removeOverlay();

      const overlay = document.createElement("div");
      overlay.setAttribute("aria-hidden", "true");
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 2147483647;
        pointer-events: none; user-select: none; -webkit-user-select: none;
        background-image: url(${watermarkBg});
        background-repeat: repeat;
        background-size: 320px 160px;
      `;
      fsElement.appendChild(overlay);
      fullscreenOverlayRef.current = overlay;
    };

    const removeOverlay = () => {
      if (fullscreenOverlayRef.current) {
        fullscreenOverlayRef.current.remove();
        fullscreenOverlayRef.current = null;
      }
    };

    const handleFullscreenChange = () => {
      const fsElement =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement;

      if (fsElement && containerRef.current?.contains(fsElement as Node)) {
        // A child of our container went fullscreen — add overlay
        // Use requestAnimationFrame to wait for the fullscreen render
        requestAnimationFrame(() => addOverlay(fsElement));
      } else {
        removeOverlay()
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      removeOverlay();
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, [enabled, watermarkBg]);

  // Block keyboard shortcuts for downloading, printing, devtools, view source
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Print screen
      if (e.key === "PrintScreen") e.preventDefault();
      // Ctrl+P (print), Ctrl+S (save), Ctrl+U (view source)
      if (e.ctrlKey && (e.key === "p" || e.key === "s" || e.key === "u")) e.preventDefault();
      // Ctrl+Shift+I (devtools), Ctrl+Shift+J (console), Ctrl+Shift+C (inspect)
      if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) e.preventDefault();
      // F12 (devtools toggle)
      if (e.key === "F12") e.preventDefault();
      // Ctrl+Shift+K (Firefox console)
      if (e.ctrlKey && e.shiftKey && e.key === "K") e.preventDefault();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);

  // Detect DevTools open/close via window size monitoring
  useEffect(() => {
    if (!enabled) return;
    let interval: ReturnType<typeof setInterval>;

    const detectDevTools = () => {
      const threshold = 160;
      const widthCheck = window.outerWidth - window.innerWidth > threshold;
      const heightCheck = window.outerHeight - window.innerHeight > threshold;
      setDevtoolsOpen(widthCheck || heightCheck);
    };

    interval = setInterval(detectDevTools, 1000);
    return () => clearInterval(interval);
  }, [enabled]);

  // Block tab visibility changes (pause/hide content when tab is not active)
  useEffect(() => {
    if (!enabled) return;
    const handleVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [enabled]);

  // Block dragging of video/media elements
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    return false;
  }, []);

  if (!enabled) return <>{children}</>;

  return (
    <div
      ref={containerRef}
      className={`relative select-none overflow-hidden ${fillHeight ? "h-full flex flex-col" : "w-full"}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={handleDragStart}
      style={{ WebkitUserSelect: "none", userSelect: "none" }}
    >
      <style>{`
        @media print { .content-protected { display: none !important; } }
        .content-protected video::-webkit-media-controls-download { display: none !important; }
        .content-protected video::-webkit-media-controls-enclosure { overflow: hidden; }
      `}</style>

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

      {/* DevTools detected overlay */}
      {devtoolsOpen && (
        <div className="absolute inset-0 z-50 bg-white dark:bg-slate-950 flex items-center justify-center rounded-[inherit]">
          <p className="text-muted-foreground text-lg font-medium">
            Developer tools detected — close them to continue viewing
          </p>
        </div>
      )}
    </div>
  );
}
