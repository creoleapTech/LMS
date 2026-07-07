import { renderAsync } from "docx-preview";
// @ts-ignore
import html2pdf from "html2pdf.js";

/**
 * Converts a DOCX Blob to a PDF Blob entirely client-side.
 * Renders the DOCX structure into a temporary DOM container using docx-preview,
 * then converts it to PDF using html2pdf.js.
 */
export async function convertDocxToPdf(docxBlob: Blob, filename: string): Promise<Blob> {
  console.log("[docx-to-pdf] Starting conversion for:", filename);
  console.log("[docx-to-pdf] Blob size (bytes):", docxBlob.size, "type:", docxBlob.type);

  const container = document.createElement("div");

  // Position inside document bounds but behind everything
  container.style.position = "absolute";
  container.style.left = "0px";
  container.style.top = "0px";
  container.style.width = "820px"; // Approximate A4 width in pixels
  container.style.background = "#ffffff";
  container.style.padding = "40px"; // Default page margin
  container.style.boxSizing = "border-box";
  container.style.zIndex = "-9999";
  container.style.pointerEvents = "none";
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
  console.log("[docx-to-pdf] Temporary container appended to body.");

  try {
    console.log("[docx-to-pdf] Calling renderAsync with docx-preview...");
    // Render DOCX into the container
    await renderAsync(docxBlob, container, undefined, {
      className: "docx-preview-element",
      inWrapper: false,
      ignoreWidth: false,
      ignoreHeight: false,
      debug: true,
    });
    console.log("[docx-to-pdf] renderAsync completed.");

    // Log the structure of the container
    console.log("[docx-to-pdf] Container child nodes count:", container.childNodes.length);
    console.log("[docx-to-pdf] Container innerHTML snippet (first 1000 chars):", container.innerHTML.substring(0, 1000));
    console.log("[docx-to-pdf] Container clientHeight:", container.clientHeight, "clientWidth:", container.clientWidth);

    // Wait briefly for images and styling to resolve
    console.log("[docx-to-pdf] Waiting 1000ms for resources...");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Configure PDF conversion options
    const options: any = {
      margin: 10, // margin in mm
      filename: filename,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: {
        scale: 2, // high quality
        useCORS: true,
        logging: true, // Enable HTML2Canvas debug logging
        letterRendering: true,
        onclone: (clonedDoc: Document) => {
          console.log("[docx-to-pdf] html2canvas onclone callback triggered.");
          const el = clonedDoc.querySelector(".docx-pdf-conversion-container") as HTMLElement;
          if (el) {
            console.log("[docx-to-pdf] Cloned element found in clonedDoc. Resetting styles.");
            console.log("[docx-to-pdf] Cloned element clientHeight before:", el.clientHeight, "clientWidth:", el.clientWidth);
            el.style.position = "static";
            el.style.left = "0px";
            el.style.top = "0px";
            console.log("[docx-to-pdf] Cloned element styles reset to static at 0,0.");
          } else {
            console.warn("[docx-to-pdf] Cloned element NOT found in clonedDoc!");
          }
        }
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

    console.log("[docx-to-pdf] Starting html2pdf compilation...");
    // Generate and return the PDF Blob
    const pdfBlob = await html2pdf()
      .set(options)
      .from(container)
      .toPdf()
      .outputPdf("blob");

    console.log("[docx-to-pdf] html2pdf completed successfully. PDF Blob size:", pdfBlob.size);
    return pdfBlob;
  } catch (error) {
    console.error("[docx-to-pdf] Error during conversion process:", error);
    throw error;
  } finally {
    // Always clean up the temporary DOM element
    console.log("[docx-to-pdf] Cleaning up temporary container.");
    document.body.removeChild(container);
  }
}
