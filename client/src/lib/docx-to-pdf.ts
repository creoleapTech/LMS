import { renderAsync } from "docx-preview";
// @ts-ignore
import html2pdf from "html2pdf.js";

/**
 * Converts a DOCX Blob to a PDF Blob entirely client-side.
 * Renders the DOCX structure into a temporary DOM container using docx-preview,
 * then converts it to PDF using html2pdf.js.
 */
export async function convertDocxToPdf(docxBlob: Blob, filename: string): Promise<Blob> {
  const container = document.createElement("div");

  // Position off-screen so the user doesn't see the rendering steps
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = "820px"; // Approximate A4 width in pixels
  container.style.background = "#ffffff";
  container.style.padding = "40px"; // Default page margin
  container.style.boxSizing = "border-box";
  container.className = "docx-pdf-conversion-container";

  // Inject a stylesheet to ensure tables and layout behave correctly when printed
  const style = document.createElement("style");
  style.innerHTML = `
    .docx-pdf-conversion-container p,
    .docx-pdf-conversion-container tr,
    .docx-pdf-conversion-container img {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .docx-pdf-conversion-container table {
      width: 100% !important;
      border-collapse: collapse !important;
      page-break-inside: auto !important;
    }
    .docx-pdf-conversion-container tr {
      page-break-inside: avoid !important;
      page-break-after: auto !important;
    }
  `;
  container.appendChild(style);
  document.body.appendChild(container);

  try {
    // Render DOCX into the container
    await renderAsync(docxBlob, container, undefined, {
      className: "docx-preview-element",
      inWrapper: false,
      ignoreWidth: false,
      ignoreHeight: false,
      debug: false,
    });

    // Wait briefly for images and styling to resolve
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Configure PDF conversion options
    const options: any = {
      margin: 10, // margin in mm
      filename: filename,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: {
        scale: 2, // high quality
        useCORS: true,
        logging: false,
        letterRendering: true,
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      },
      pagebreak: {
        mode: ["avoid-all", "css", "legacy"],
      },
    };

    // Generate and return the PDF Blob
    const pdfBlob = await html2pdf()
      .set(options)
      .from(container)
      .toPdf()
      .outputPdf("blob");

    return pdfBlob;
  } catch (error) {
    console.error("DOCX to PDF conversion error:", error);
    throw error;
  } finally {
    // Always clean up the temporary DOM element
    document.body.removeChild(container);
  }
}
