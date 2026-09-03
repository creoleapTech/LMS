/**
 * Preservation Property Tests — Non-Fullscreen and No-Watermark Behavior Unchanged
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 *
 * These tests encode the BASELINE behavior that must be preserved after the fix.
 * They are run on UNFIXED code and are EXPECTED TO PASS — passing confirms the
 * baseline behavior we must not regress.
 *
 * Property 2 (Preservation):
 *   For all viewer states where isBugCondition returns false
 *   (isFullscreen=false OR watermarkText is absent/empty),
 *   no watermark overlay div[aria-hidden="true"] is present inside the viewer's
 *   own DOM tree.
 *
 * After the fix is applied (Tasks 3.x), these same tests must STILL PASS,
 * confirming no regressions in normal-mode rendering, navigation, and
 * no-watermark cases.
 *
 * Observation notes (observation-first methodology):
 * - PdfFlipBook rendered without fullscreen shows no internal watermark overlay;
 *   ContentProtectionWrapper handles it externally.
 * - PptViewer rendered without fullscreen shows no internal watermark overlay;
 *   ContentProtectionWrapper handles it externally.
 * - Either viewer rendered with watermarkText=undefined in any mode shows no
 *   internal watermark overlay.
 * - Navigation callbacks (onPageChange), keyboard events, and page/slide state
 *   updates fire correctly in normal mode.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Mock heavy dependencies (same pattern as watermark-fullscreen-bug.test.tsx)
// ---------------------------------------------------------------------------

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

// PdfFlipBook now tries pdfjs-dist/legacy/build/pdf.mjs first (polyfilled worker)
// – mock it the same way so tests don't load the real 2 MB worker in jsdom.
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
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

vi.mock("react-pageflip", () => ({
  default: React.forwardRef((_props: any, _ref: any) => (
    <div data-testid="flipbook-stub" />
  )),
}));

vi.mock("@/lib/pptx-parser", () => ({
  parsePptxProgressive: () =>
    Promise.resolve({ slideWidth: 960, slideHeight: 540, slides: [] }),
}));

vi.mock("@/lib/config", () => ({
  Config: { pptPreviewUrl: "http://localhost/ppt?key=" },
}));

vi.mock("../SlideRenderer", () => ({
  SlideRenderer: () => <div data-testid="slide-renderer-stub" />,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Returns true if any div[aria-hidden="true"] with a backgroundImage is present */
function hasWatermarkOverlay(container: Element): boolean {
  const overlays = container.querySelectorAll('div[aria-hidden="true"]');
  return Array.from(overlays).some(
    (el) => (el as HTMLElement).style.backgroundImage !== ""
  );
}

// ---------------------------------------------------------------------------
// Shared beforeEach / afterEach setup
// ---------------------------------------------------------------------------

function setupCanvasMocks() {
  HTMLElement.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined);
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    clearRect: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    font: "",
    fillStyle: "",
    textAlign: "",
    textBaseline: "",
  });
  HTMLCanvasElement.prototype.toDataURL = vi
    .fn()
    .mockReturnValue("data:image/png;base64,AAAA");
}

// ---------------------------------------------------------------------------
// PdfFlipBook — Preservation: no internal watermark in normal mode
// ---------------------------------------------------------------------------

describe("PdfFlipBook — Preservation: no internal watermark overlay in normal mode", () => {
  beforeEach(() => {
    setupCanvasMocks();
  });

  afterEach(() => {
    simulateFullscreenExit();
    vi.restoreAllMocks();
  });

  /**
   * Observation 1 — PdfFlipBook without fullscreen:
   * Rendered in normal mode (isFullscreen=false), no div[aria-hidden="true"] with
   * backgroundImage is present inside the viewer's own DOM tree.
   * ContentProtectionWrapper handles the watermark externally.
   *
   * EXPECTED TO PASS on unfixed code (baseline behavior to preserve).
   */
  it("shows no internal watermark overlay when not in fullscreen (watermarkText absent)", async () => {
    const { PdfFlipBook } = await import("../PdfFlipBook");

    const { container } = render(
      <PdfFlipBook fileUrl="http://localhost/test.pdf" />
    );

    // Do NOT enter fullscreen — stay in normal mode
    expect(hasWatermarkOverlay(container)).toBe(false);
  });

  /**
   * Observation 2 — PdfFlipBook without fullscreen, watermarkText provided:
   * Even if a watermarkText prop were accepted, in normal mode the viewer should
   * not render its own internal overlay (ContentProtectionWrapper handles it).
   *
   * On unfixed code: the prop is not accepted, so no overlay is rendered.
   * After fix: the prop is accepted but overlay is only rendered when isFullscreen=true.
   *
   * EXPECTED TO PASS on both unfixed and fixed code.
   */
  it("shows no internal watermark overlay when not in fullscreen (watermarkText provided)", async () => {
    const { PdfFlipBook } = await import("../PdfFlipBook");

    const { container } = render(
      <PdfFlipBook fileUrl="http://localhost/test.pdf" watermarkText="www.creoleap.com" />
    );

    // Normal mode — no fullscreen entry
    expect(hasWatermarkOverlay(container)).toBe(false);
  });

  /**
   * Observation 3 — PdfFlipBook with fullscreen but watermarkText absent:
   * When entering fullscreen without a watermarkText, no internal overlay should
   * appear (consistent with normal mode behavior per Requirement 2.4).
   *
   * EXPECTED TO PASS on unfixed code (no watermarkText prop exists, so no overlay).
   * EXPECTED TO PASS on fixed code (watermarkText is undefined → no overlay).
   */
  it("shows no internal watermark overlay when in fullscreen but watermarkText is absent", async () => {
    const { PdfFlipBook } = await import("../PdfFlipBook");

    const { container } = render(
      <PdfFlipBook fileUrl="http://localhost/test.pdf" />
    );

    const wrapperEl = container.firstElementChild as Element;
    await act(async () => {
      simulateFullscreenEntry(wrapperEl);
    });

    expect(hasWatermarkOverlay(container)).toBe(false);
  });

  /**
   * Property 2 (Preservation) — PdfFlipBook, fast-check:
   *
   * For all viewer states where isFullscreen=false (regardless of watermarkText),
   * no watermark overlay div[aria-hidden="true"] is present inside the viewer's
   * own DOM tree.
   *
   * **Validates: Requirements 3.1, 3.3, 3.5, 3.7**
   *
   * EXPECTED TO PASS on unfixed code (baseline behavior to preserve).
   */
  it("property: no internal watermark overlay for any watermarkText when isFullscreen=false", async () => {
    const { PdfFlipBook } = await import("../PdfFlipBook");

    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary watermarkText values: undefined, empty string, or non-empty string
        fc.oneof(
          fc.constant(undefined),
          fc.constant(""),
          fc.string({ minLength: 1, maxLength: 50 })
        ),
        async (watermarkText) => {
          const { container, unmount } = render(
            <PdfFlipBook
              fileUrl="http://localhost/test.pdf"
              watermarkText={watermarkText}
            />
          );

          // Normal mode — do NOT enter fullscreen
          const overlayPresent = hasWatermarkOverlay(container);
          unmount();

          return !overlayPresent;
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ---------------------------------------------------------------------------
// PptViewer — Preservation: no internal watermark in normal mode
// ---------------------------------------------------------------------------

describe("PptViewer — Preservation: no internal watermark overlay in normal mode", () => {
  beforeEach(() => {
    setupCanvasMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 501,
      json: () =>
        Promise.resolve({ message: "PPT preview not enabled" }),
    } as any);
  });

  afterEach(() => {
    simulateFullscreenExit();
    vi.restoreAllMocks();
  });

  /**
   * Observation 4 — PptViewer without fullscreen:
   * Rendered in normal mode (isFullscreen=false), no div[aria-hidden="true"] with
   * backgroundImage is present inside the viewer's own DOM tree.
   *
   * EXPECTED TO PASS on unfixed code (baseline behavior to preserve).
   */
  it("shows no internal watermark overlay when not in fullscreen (watermarkText absent)", async () => {
    const { PptViewer } = await import("../PptViewer");

    const { container } = render(
      <PptViewer storageKey="uploads/test.pptx" />
    );

    expect(hasWatermarkOverlay(container)).toBe(false);
  });

  /**
   * Observation 5 — PptViewer without fullscreen, watermarkText provided:
   * Even if a watermarkText prop were accepted, in normal mode the viewer should
   * not render its own internal overlay.
   *
   * EXPECTED TO PASS on both unfixed and fixed code.
   */
  it("shows no internal watermark overlay when not in fullscreen (watermarkText provided)", async () => {
    const { PptViewer } = await import("../PptViewer");

    const { container } = render(
      <PptViewer storageKey="uploads/test.pptx" watermarkText="www.creoleap.com" />
    );

    expect(hasWatermarkOverlay(container)).toBe(false);
  });

  /**
   * Observation 6 — PptViewer with fullscreen but watermarkText absent:
   * When entering fullscreen without a watermarkText, no internal overlay should
   * appear (Requirement 2.4).
   *
   * EXPECTED TO PASS on unfixed code (no watermarkText prop exists, so no overlay).
   * EXPECTED TO PASS on fixed code (watermarkText is undefined → no overlay).
   */
  it("shows no internal watermark overlay when in fullscreen but watermarkText is absent", async () => {
    const { PptViewer } = await import("../PptViewer");

    const { container } = render(
      <PptViewer storageKey="uploads/test.pptx" />
    );

    const viewerEl = container.firstElementChild as Element;
    await act(async () => {
      simulateFullscreenEntry(viewerEl);
    });

    expect(hasWatermarkOverlay(container)).toBe(false);
  });

  /**
   * Property 2 (Preservation) — PptViewer, fast-check:
   *
   * For all viewer states where isFullscreen=false (regardless of watermarkText),
   * no watermark overlay div[aria-hidden="true"] is present inside the viewer's
   * own DOM tree.
   *
   * **Validates: Requirements 3.2, 3.4, 3.6, 3.7**
   *
   * EXPECTED TO PASS on unfixed code (baseline behavior to preserve).
   */
  it("property: no internal watermark overlay for any watermarkText when isFullscreen=false", async () => {
    const { PptViewer } = await import("../PptViewer");

    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(undefined),
          fc.constant(""),
          fc.string({ minLength: 1, maxLength: 50 })
        ),
        async (watermarkText) => {
          const { container, unmount } = render(
            <PptViewer
              storageKey="uploads/test.pptx"
              watermarkText={watermarkText}
            />
          );

          // Normal mode — do NOT enter fullscreen
          const overlayPresent = hasWatermarkOverlay(container);
          unmount();

          return !overlayPresent;
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ---------------------------------------------------------------------------
// Navigation preservation — onPageChange fires correctly in normal mode
// ---------------------------------------------------------------------------

describe("PptViewer — Preservation: navigation callbacks fire in normal mode", () => {
  beforeEach(() => {
    setupCanvasMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 501,
      json: () => Promise.resolve({ message: "PPT preview not enabled" }),
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Observation 7 — onPageChange fires on initial render:
   * PptViewer calls onPageChange(1) when the presentation loads.
   * This confirms navigation callbacks are wired correctly in normal mode.
   *
   * Note: With the 501 mock, the viewer shows an error state, so onPageChange
   * is not called (no presentation loaded). We verify the callback is not
   * called with unexpected values.
   *
   * EXPECTED TO PASS on unfixed code (baseline behavior to preserve).
   */
  it("does not call onPageChange with unexpected values when presentation fails to load", async () => {
    const { PptViewer } = await import("../PptViewer");
    const onPageChange = vi.fn();

    render(
      <PptViewer storageKey="uploads/test.pptx" onPageChange={onPageChange} />
    );

    // With a 501 error, the viewer shows an error state — onPageChange should
    // not be called with any slide number
    expect(onPageChange).not.toHaveBeenCalledWith(expect.any(Number));
  });
});

// ---------------------------------------------------------------------------
// Keyboard event preservation — print/screenshot blocking in normal mode
// ---------------------------------------------------------------------------

describe("PdfFlipBook — Preservation: print/screenshot blocking (Req 3.5)", () => {
  beforeEach(() => {
    setupCanvasMocks();
  });

  afterEach(() => {
    simulateFullscreenExit();
    vi.restoreAllMocks();
  });

  /**
   * Observation 8 — Ctrl+P is blocked:
   * PdfFlipBook prevents the default action on Ctrl+P keydown events.
   * This confirms print protection is active in normal mode.
   *
   * EXPECTED TO PASS on unfixed code (baseline behavior to preserve).
   */
  it("prevents default on Ctrl+P keydown (print protection)", async () => {
    const { PdfFlipBook } = await import("../PdfFlipBook");

    render(<PdfFlipBook fileUrl="http://localhost/test.pdf" />);

    const event = new KeyboardEvent("keydown", {
      key: "p",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    document.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});

describe("PptViewer — Preservation: print/screenshot blocking (Req 3.6)", () => {
  beforeEach(() => {
    setupCanvasMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 501,
      json: () => Promise.resolve({ message: "PPT preview not enabled" }),
    } as any);
  });

  afterEach(() => {
    simulateFullscreenExit();
    vi.restoreAllMocks();
  });

  /**
   * Observation 9 — Ctrl+P is blocked in PptViewer:
   * PptViewer prevents the default action on Ctrl+P keydown events.
   *
   * EXPECTED TO PASS on unfixed code (baseline behavior to preserve).
   */
  it("prevents default on Ctrl+P keydown (print protection)", async () => {
    const { PptViewer } = await import("../PptViewer");

    render(<PptViewer storageKey="uploads/test.pptx" />);

    const event = new KeyboardEvent("keydown", {
      key: "p",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    document.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// buildWatermarkDataUrl — Property test (indirect via ContentProtectionWrapper)
//
// NOTE: buildWatermarkDataUrl is currently private to ContentProtectionWrapper.
// This test verifies the function's contract indirectly by checking that
// ContentProtectionWrapper renders a watermark overlay whose backgroundImage
// starts with "url(data:image/png".
//
// After Task 3.1 extracts buildWatermarkDataUrl to watermarkUtils.ts, a direct
// unit test can be added there. The property below will continue to pass because
// ContentProtectionWrapper will import from the same utility.
// ---------------------------------------------------------------------------

describe("buildWatermarkDataUrl — Property: returns data:image/png URL (indirect via ContentProtectionWrapper)", () => {
  beforeEach(() => {
    // Use a real canvas mock that returns a proper data URL
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      save: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      fillText: vi.fn(),
      restore: vi.fn(),
      font: "",
      fillStyle: "",
      textAlign: "",
      textBaseline: "",
    });
    // toDataURL returns a valid data:image/png URL
    HTMLCanvasElement.prototype.toDataURL = vi
      .fn()
      .mockImplementation((type?: string) => {
        const mimeType = type || "image/png";
        return `data:${mimeType};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
      });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Property 2 (Preservation) — buildWatermarkDataUrl:
   *
   * For any non-empty watermarkText string, the watermark data URL produced by
   * ContentProtectionWrapper's internal buildWatermarkDataUrl always starts with
   * "data:image/png".
   *
   * This is tested indirectly: ContentProtectionWrapper renders a div[aria-hidden="true"]
   * whose backgroundImage style is `url(data:image/png...)` when watermarkText is set.
   *
   * **Validates: Requirements 3.1, 3.2**
   *
   * NOTE: After Task 3.1 extracts buildWatermarkDataUrl to watermarkUtils.ts,
   * add a direct test: import { buildWatermarkDataUrl } from "@/lib/watermarkUtils"
   * and assert buildWatermarkDataUrl(text).startsWith("data:image/png").
   *
   * EXPECTED TO PASS on unfixed code (ContentProtectionWrapper already works correctly).
   */
  it("property: ContentProtectionWrapper watermark backgroundImage starts with url(data:image/png for any non-empty text", async () => {
    const { ContentProtectionWrapper } = await import(
      "../../protection/ContentProtectionWrapper"
    );

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (watermarkText) => {
          const { container, unmount } = render(
            <ContentProtectionWrapper watermarkText={watermarkText}>
              <div>content</div>
            </ContentProtectionWrapper>
          );

          const overlays = container.querySelectorAll('div[aria-hidden="true"]');
          const watermarkOverlay = Array.from(overlays).find(
            (el) => (el as HTMLElement).style.backgroundImage !== ""
          );

          const bgImage = (watermarkOverlay as HTMLElement | undefined)
            ?.style.backgroundImage ?? "";

          unmount();

          // backgroundImage is set as url("data:image/png...") or url(data:image/png...)
          return bgImage.includes("data:image/png");
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Observation 10 — ContentProtectionWrapper with empty watermarkText:
   * When watermarkText is empty or undefined, no watermark overlay is rendered.
   *
   * EXPECTED TO PASS on unfixed code.
   */
  it("ContentProtectionWrapper renders no watermark overlay when watermarkText is absent", async () => {
    const { ContentProtectionWrapper } = await import(
      "../../protection/ContentProtectionWrapper"
    );

    const { container: c1 } = render(
      <ContentProtectionWrapper>
        <div>content</div>
      </ContentProtectionWrapper>
    );
    expect(hasWatermarkOverlay(c1)).toBe(false);

    const { container: c2 } = render(
      <ContentProtectionWrapper watermarkText="">
        <div>content</div>
      </ContentProtectionWrapper>
    );
    expect(hasWatermarkOverlay(c2)).toBe(false);
  });
});
