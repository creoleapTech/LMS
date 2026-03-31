import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Finds the LibreOffice executable on the system.
 */
function findLibreOffice(): string {
  const candidates = [
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    "/usr/bin/libreoffice",
    "/usr/bin/soffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // Fallback: assume it's in PATH
  return "soffice";
}

const SOFFICE = findLibreOffice();
const CACHE_DIR = path.resolve("uploads/.ppt-cache");

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Converts a PPTX file to PDF using LibreOffice.
 * Returns the path to the generated PDF.
 * Caches the result — if the PDF already exists, returns immediately.
 */
export async function convertPptToPdf(pptxPath: string): Promise<string> {
  // Derive PDF path: same location, .pdf extension
  const parsed = path.parse(pptxPath);
  const pdfPath = path.join(parsed.dir, `${parsed.name}.pdf`);

  // Return cached PDF if it already exists
  if (existsSync(pdfPath)) {
    return pdfPath;
  }

  // Ensure output directory exists
  if (!existsSync(parsed.dir)) {
    mkdirSync(parsed.dir, { recursive: true });
  }

  return runLibreOfficeConvert(path.resolve(pptxPath), path.resolve(parsed.dir), pdfPath);
}

/**
 * Converts a PPTX buffer to PDF using LibreOffice.
 * Writes to a temp file, converts, and returns the cached PDF path.
 * Uses a hash of the storage key for stable cache filenames.
 */
export async function convertPptBufferToPdf(
  buffer: Buffer,
  storageKey: string
): Promise<string> {
  // Create a stable cache key from the storage key
  const hash = crypto.createHash("sha256").update(storageKey).digest("hex").slice(0, 16);
  const pdfPath = path.join(CACHE_DIR, `${hash}.pdf`);

  // Return cached PDF if it already exists
  if (existsSync(pdfPath)) {
    return pdfPath;
  }

  // Write buffer to temp PPTX file
  const tempPptx = path.join(CACHE_DIR, `${hash}.pptx`);
  writeFileSync(tempPptx, buffer);

  try {
    return await runLibreOfficeConvert(tempPptx, CACHE_DIR, pdfPath);
  } finally {
    // Clean up temp PPTX (keep only the PDF)
    try {
      if (existsSync(tempPptx)) await Bun.file(tempPptx).unlink?.();
    } catch { /* ignore cleanup errors */ }
  }
}

/**
 * Runs LibreOffice headless conversion and returns the PDF path.
 */
async function runLibreOfficeConvert(
  inputFile: string,
  outDir: string,
  expectedPdfPath: string
): Promise<string> {
  try {
    const proc = Bun.spawn(
      [SOFFICE, "--headless", "--convert-to", "pdf", "--outdir", outDir, inputFile],
      { stdout: "pipe", stderr: "pipe" }
    );

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      console.error("LibreOffice stderr:", stderr);
      throw new Error(`LibreOffice exited with code ${exitCode}`);
    }
  } catch (error: any) {
    if (error.message?.includes("LibreOffice exited")) throw error;
    console.error("LibreOffice conversion failed:", error);
    throw new Error("Failed to convert presentation to PDF");
  }

  // Verify the PDF was created
  if (!existsSync(expectedPdfPath)) {
    throw new Error("PDF conversion completed but output file not found");
  }

  return expectedPdfPath;
}
