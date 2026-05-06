/**
 * Bug Condition Exploration Tests — Watermark Absent in Fullscreen
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * These tests encode the EXPECTED behavior (watermark overlay present inside the
 * fullscreen container). They are run on UNFIXED code and are EXPECTED TO FAIL —
 * failure confirms the bug exists.
 *
 * Bug condition (isBugCondition):
 *   isFullscreen = true AND watermarkText is non-empty AND
 *   no div[aria-hidden="true"] with backgroundImage is rendered inside the
 *   fullscreen container (wrapperRef for PdfFlipBook, viewerRef for PptViewer).
 *
 * When the fix is applied (Tasks 3.x), these same tests will PASS, confirming
 * the fix satisfies Requirements 2.1, 2.2, 2.3.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mock heavy dependencies so the components can render in jsdom
// ---------------------------------------------------------------------------

// pdfjs-dist is a large native module — mock it so PdfFlipBook can mount
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: () =>
        Promise.resolve({
          getViewport: () => ({ width: 800, height: 1131 }),
          render: () => ({ promise: Promise.resolve() }),
          cleanup: () => {},
        }),
    }),
  }),
}));

// react-pageflip renders a complex canvas-based flipbook — stub it out
vi.mock("react-pageflip", () => ({
  default: React.forwardRef((_props: any, _ref: any) => (
    <div data-testid="flipbook-stub" />
  )),
}));

// pptx-parser makes network requests — stub it
vi.mock("@/lib/pptx-parser", () => ({
  parsePptxProgressive: () => Promise.resolve({ slideWidth: 960, slideHeight: 540, slides: [] }),
}));

// Config used by PptViewer for the fetch URL
vi.mock("@/lib/config", () => ({
  Config: { pptPreviewUrl: "http://localhost/ppt?key=" },
}));

// SlideRenderer is a complex SVG renderer — stub it
vi.mock("../SlideRenderer", () => ({
  SlideRenderer: () => <div data-testid="slide-renderer-stub" />,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simulate the browser firing a fullscreenchange event so that the component's
 * `document.addEventListener("fullscreenchange", ...)` handler runs and sets
 * `isFullscreen = true`.
 *
 * We also mock `document.fullscreenElement` to return a truthy value so the
 * handler sees `!!document.fullscreenElement === true`.
 */
function simulateFullscreenEntry(element: Element) {
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => element,
  });
  document.dispatchEvent(new Event("fullscreenchange"));
}

function simulateFullscreenExit() {
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => null,
  });
  document.dispatchEvent(new Event("fullscreenchange"));
}

// ---------------------------------------------------------------------------
// PdfFlipBook — Bug Condition Exploration
// ---------------------------------------------------------------------------

describe("PdfFlipBook — Bug Condition: watermark absent in fullscreen", () => {
  beforeEach(() => {
    // Stub requestFullscreen on HTMLElement so the component can call it
    HTMLElement.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined);
    // Stub canvas getContext for buildWatermarkDataUrl (used after fix)
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      save: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      fillText: vi.fn(),
      restore: vi.fn(),
    });
    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue(
      "data:image/png;base64,AAAA"
    );
  });

  afterEach(() => {
    simulateFullscreenExit();
    vi.restoreAllMocks();
  });

  /**
   * Property 1 (Bug Condition) — PdfFlipBook:
   *
   * WHEN PdfFlipBook is rendered with watermarkText="www.creoleap.com"
   * AND the viewer enters fullscreen (isFullscreen=true)
   * THEN a div[aria-hidden="true"] with a backgroundImage style MUST be present
   * inside the wrapperRef container.
   *
   * EXPECTED TO FAIL on unfixed code because:
   * - PdfFlipBook does not accept a `watermarkText` prop
   * - PdfFlipBook does not render any watermark overlay inside wrapperRef
   *
   * Counterexample: PdfFlipBook with watermarkText="www.creoleap.com" and
   * isFullscreen=true renders no div[aria-hidden="true"] with backgroundImage
   * inside wrapperRef.
   */
  it("renders a watermark overlay inside wrapperRef when watermarkText is set and fullscreen is active", async () => {
    // Dynamically import so the mock is in place before the module loads
    const { PdfFlipBook } = await import("../PdfFlipBook");

    const { container } = render(
      <PdfFlipBook fileUrl="http://localhost/test.pdf" watermarkText="www.creoleap.com" />
    );

    // Simulate the browser entering fullscreen on the wrapperRef element.
    // The component listens for "fullscreenchange" and sets isFullscreen=true
    // when document.fullscreenElement is truthy.
    const wrapperEl = container.firstElementChild as Element;
    await act(async () => {
      simulateFullscreenEntry(wrapperEl);
    });

    // Assert: a div[aria-hidden="true"] with a backgroundImage style must be
    // present inside the fullscreen container (wrapperRef).
    const overlays = container.querySelectorAll('div[aria-hidden="true"]');
    const watermarkOverlay = Array.from(overlays).find(
      (el) => (el as HTMLElement).style.backgroundImage !== ""
    );

    expect(
      watermarkOverlay,
      "Expected a div[aria-hidden='true'] with backgroundImage inside wrapperRef " +
        "when watermarkText='www.creoleap.com' and isFullscreen=true, but none was found. " +
        "Counterexample: PdfFlipBook with watermarkText='www.creoleap.com' and isFullscreen=true " +
        "renders no watermark overlay inside wrapperRef."
    ).toBeDefined();

    expect(
      (watermarkOverlay as HTMLElement | undefined)?.style.backgroundImage,
      "Expected backgroundImage to be set on the watermark overlay"
    ).not.toBe("");
  });
});

// ---------------------------------------------------------------------------
// PptViewer — Bug Condition Exploration
// ---------------------------------------------------------------------------

describe("PptViewer — Bug Condition: watermark absent in fullscreen", () => {
  beforeEach(() => {
    HTMLElement.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined);
    // Stub fetch so PptViewer's load() doesn't fail
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 501,
      json: () => Promise.resolve({ message: "PPT preview not enabled" }),
    } as any);
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      save: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      fillText: vi.fn(),
      restore: vi.fn(),
    });
    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue(
      "data:image/png;base64,AAAA"
    );
  });

  afterEach(() => {
    simulateFullscreenExit();
    vi.restoreAllMocks();
  });

  /**
   * Property 1 (Bug Condition) — PptViewer:
   *
   * WHEN PptViewer is rendered with watermarkText="www.creoleap.com"
   * AND the viewer enters fullscreen (isFullscreen=true)
   * THEN a div[aria-hidden="true"] with a backgroundImage style MUST be present
   * inside the viewerRef container.
   *
   * EXPECTED TO FAIL on unfixed code because:
   * - PptViewer does not accept a `watermarkText` prop
   * - PptViewer does not render any watermark overlay inside viewerRef
   *
   * Counterexample: PptViewer with watermarkText="www.creoleap.com" and
   * isFullscreen=true renders no div[aria-hidden="true"] with backgroundImage
   * inside viewerRef.
   */
  it("renders a watermark overlay inside viewerRef when watermarkText is set and fullscreen is active", async () => {
    const { PptViewer } = await import("../PptViewer");

    const { container } = render(
      <PptViewer storageKey="uploads/test.pptx" watermarkText="www.creoleap.com" />
    );

    // The outermost div is the ppt-viewer / viewerRef element.
    // Simulate fullscreen entry so isFullscreen becomes true.
    const viewerEl = container.firstElementChild as Element;
    await act(async () => {
      simulateFullscreenEntry(viewerEl);
    });

    // Assert: a div[aria-hidden="true"] with a backgroundImage style must be
    // present inside the fullscreen container (viewerRef).
    const overlays = container.querySelectorAll('div[aria-hidden="true"]');
    const watermarkOverlay = Array.from(overlays).find(
      (el) => (el as HTMLElement).style.backgroundImage !== ""
    );

    expect(
      watermarkOverlay,
      "Expected a div[aria-hidden='true'] with backgroundImage inside viewerRef " +
        "when watermarkText='www.creoleap.com' and isFullscreen=true, but none was found. " +
        "Counterexample: PptViewer with watermarkText='www.creoleap.com' and isFullscreen=true " +
        "renders no watermark overlay inside viewerRef."
    ).toBeDefined();

    expect(
      (watermarkOverlay as HTMLElement | undefined)?.style.backgroundImage,
      "Expected backgroundImage to be set on the watermark overlay"
    ).not.toBe("");
  });
});
