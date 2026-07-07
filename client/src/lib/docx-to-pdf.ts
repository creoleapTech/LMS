import { renderAsync } from "docx-preview";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

const DOCX_PAGE_CLASS = "docx-pdf-page";
const CSS_PX_TO_PT = 72 / 96;
const DEFAULT_RENDER_SCALE = 2;

function pxToPt(px: number): number {
  return px * CSS_PX_TO_PT;
}

function getRenderScale(): number {
  return Math.max(DEFAULT_RENDER_SCALE, Math.min(window.devicePixelRatio || 1, 3));
}

function getElementSize(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const width = Math.ceil(rect.width || element.scrollWidth);
  const contentHeight = Math.ceil(Math.max(rect.height, element.scrollHeight, element.offsetHeight));

  // Extract the target page height from CSS min-height to enable proper pagination slicing
  const computedStyle = window.getComputedStyle(element);
  const minHeightVal = parseFloat(computedStyle.minHeight);

  let pageHeight = minHeightVal;
  if (!pageHeight || isNaN(pageHeight) || pageHeight <= 0) {
    const heightVal = parseFloat(computedStyle.height);
    if (heightVal && !isNaN(heightVal) && heightVal > 0) {
      pageHeight = heightVal;
    } else {
      // Fallback to standard A4 aspect ratio (1.4142) if no CSS heights are specified
      pageHeight = Math.ceil(width * 1.4142);
    }
  } else {
    pageHeight = Math.ceil(pageHeight);
  }

  return {
    width,
    pageHeight,
    contentHeight,
  };
}

async function waitForRenderResources(container: HTMLElement): Promise<void> {
  if ("fonts" in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue with the browser's fallback font state.
    }
  }

  const images = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth !== 0) {
            resolve();
            return;
          }

          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );

  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

function createPageSlice(
  source: HTMLCanvasElement,
  y: number,
  sliceHeight: number,
): HTMLCanvasElement {
  const page = document.createElement("canvas");
  page.width = source.width;
  page.height = sliceHeight;

  const ctx = page.getContext("2d");
  if (!ctx) throw new Error("Could not create PDF page canvas");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, page.width, page.height);
  ctx.drawImage(
    source,
    0,
    y,
    source.width,
    Math.min(sliceHeight, source.height - y),
    0,
    0,
    source.width,
    Math.min(sliceHeight, source.height - y),
  );

  return page;
}

function appendCanvasPages(
  pdf: jsPDF | null,
  canvas: HTMLCanvasElement,
  pageWidthPx: number,
  pageHeightPx: number,
): jsPDF {
  const pageWidthPt = pxToPt(pageWidthPx);
  const pageHeightPt = pxToPt(pageHeightPx);
  const orientation = pageWidthPt > pageHeightPt ? "landscape" : "portrait";
  const renderedScale = canvas.width / pageWidthPx;
  const sliceHeight = Math.round(pageHeightPx * renderedScale);
  let doc = pdf;

  for (let y = 0; y < canvas.height; y += sliceHeight) {
    if (!doc) {
      doc = new jsPDF({
        unit: "pt",
        format: [pageWidthPt, pageHeightPt],
        orientation,
        compress: true,
      });
    } else {
      doc.addPage([pageWidthPt, pageHeightPt], orientation);
    }

    const pageSlice = createPageSlice(canvas, y, sliceHeight);
    doc.addImage(
      pageSlice.toDataURL("image/png"),
      "PNG",
      0,
      0,
      pageWidthPt,
      pageHeightPt,
      undefined,
      "FAST",
    );
  }

  if (!doc) throw new Error("Could not create PDF document");
  return doc;
}

/**
 * Converts the submitted DOCX Blob to a PDF Blob by rendering the DOCX pages
 * first, then capturing those pages into a PDF with the same page dimensions.
 */
export async function convertDocxToPdf(docxBlob: Blob, filename: string): Promise<Blob> {
  const container = document.createElement("div");
  container.className = "docx-pdf-conversion-container";
  Object.assign(container.style, {
    position: "absolute",
    left: "-100000px",
    top: "0",
    background: "#ffffff",
    pointerEvents: "none",
  });

  document.body.appendChild(container);

  try {
    await renderAsync(docxBlob, container, container, {
      className: DOCX_PAGE_CLASS,
      inWrapper: true,
      hideWrapperOnPrint: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      ignoreLastRenderedPageBreak: false,
      useBase64URL: true,
      debug: false,
    });

    const layoutOverrides = document.createElement("style");
    layoutOverrides.textContent = `
      .${DOCX_PAGE_CLASS}-wrapper {
        align-items: flex-start !important;
        background: #ffffff !important;
        display: block !important;
        padding: 0 !important;
      }

      .${DOCX_PAGE_CLASS}-wrapper > section.${DOCX_PAGE_CLASS} {
        background: #ffffff !important;
        box-shadow: none !important;
        margin: 0 !important;
      }
    `;
    container.appendChild(layoutOverrides);

    await waitForRenderResources(container);

    const pages = Array.from(
      container.querySelectorAll<HTMLElement>(`section.${DOCX_PAGE_CLASS}`),
    );

    if (pages.length === 0) {
      throw new Error("DOCX renderer did not produce any pages");
    }

    let pdf: jsPDF | null = null;
    const scale = getRenderScale();

    for (const page of pages) {
      const { width, pageHeight, contentHeight } = getElementSize(page);
      const canvas = await html2canvas(page, {
        backgroundColor: "#ffffff",
        height: contentHeight,
        logging: false,
        scale,
        scrollX: 0,
        scrollY: 0,
        useCORS: true,
        width,
        windowHeight: contentHeight,
        windowWidth: width,
      });

      pdf = appendCanvasPages(pdf, canvas, width, pageHeight);
    }

    if (!pdf) throw new Error("Could not create PDF document");

    pdf.setProperties({
      title: filename.replace(/\.pdf$/i, ""),
      subject: "Monthly Lesson Completion Report",
    });

    return pdf.output("blob");
  } finally {
    document.body.removeChild(container);
  }
}
