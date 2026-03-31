import JSZip from "jszip";

// ── Types ──────────────────────────────────────────────────────────

export interface PresentationData {
  slideWidth: number;
  slideHeight: number;
  slides: SlideData[];
}

export interface SlideData {
  background?: BackgroundData;
  elements: SlideElement[];
}

export interface BackgroundData {
  type: "solid" | "gradient" | "image";
  color?: string;
  gradientStops?: { position: number; color: string }[];
  imageData?: string;
}

export interface SlideElement {
  type: "text" | "image" | "shape";
  position: { x: number; y: number; width: number; height: number };
  rotation?: number;
  // text + shape
  paragraphs?: ParagraphData[];
  // image
  imageData?: string;
  // shape
  shapeType?: string;
  fill?: FillData;
  outline?: { color: string; width: number };
  cornerRadius?: number;
}

export interface FillData {
  type: "solid" | "gradient" | "none";
  color?: string;
  gradientStops?: { position: number; color: string }[];
  gradientAngle?: number;
}

export interface ParagraphData {
  alignment?: "left" | "center" | "right" | "justify";
  runs: TextRunData[];
  bulletChar?: string;
  level?: number;
  spaceBefore?: number;
  spaceAfter?: number;
}

export interface TextRunData {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  highlight?: string;
}

// ── Constants ──────────────────────────────────────────────────────

const EMU_PER_POINT = 12700;
const DEFAULT_SLIDE_WIDTH = 9144000;
const DEFAULT_SLIDE_HEIGHT = 6858000;

const NS = {
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  rel: "http://schemas.openxmlformats.org/package/2006/relationships",
};

// ── Helpers ────────────────────────────────────────────────────────

function qn(ns: string, local: string): string {
  return `{${ns}}${local}`;
}

/** Parse XML string into a Document */
function parseXml(xmlStr: string): Document {
  return new DOMParser().parseFromString(xmlStr, "application/xml");
}

/** Get text file from zip */
async function readZipText(zip: JSZip, path: string): Promise<string | null> {
  const file = zip.file(path);
  if (!file) return null;
  return file.async("text");
}

/** Get binary file from zip as base64 data URL */
async function readZipBase64(zip: JSZip, path: string, mimeType: string): Promise<string | null> {
  const file = zip.file(path);
  if (!file) return null;
  const b64 = await file.async("base64");
  return `data:${mimeType};base64,${b64}`;
}

/** Get all elements with a given local name, ignoring namespace */
function getElementsByLocal(parent: Element | Document, localName: string): Element[] {
  return Array.from(parent.getElementsByTagName("*")).filter(
    (el) => el.localName === localName
  );
}

/** Get first element with a given local name */
function getFirstByLocal(parent: Element | Document, localName: string): Element | null {
  return getElementsByLocal(parent, localName)[0] || null;
}

/** Convert EMU to points */
function emuToPoints(emu: number): number {
  return emu / EMU_PER_POINT;
}

/** Parse an XML color value — handles srgbClr, schemeClr fallback, etc. */
function parseColor(el: Element | null, themeColors: Map<string, string>): string | undefined {
  if (!el) return undefined;

  // Direct sRGB color
  const srgb = getFirstByLocal(el, "srgbClr");
  if (srgb) {
    return "#" + (srgb.getAttribute("val") || "000000");
  }

  // Theme/scheme color reference
  const scheme = getFirstByLocal(el, "schemeClr");
  if (scheme) {
    const val = scheme.getAttribute("val") || "";
    const mapped = themeColors.get(val);
    if (mapped) return mapped;
  }

  return undefined;
}

/** Parse a fill element (solidFill, gradFill, noFill) */
function parseFill(parent: Element, themeColors: Map<string, string>): FillData | undefined {
  const noFill = getFirstByLocal(parent, "noFill");
  if (noFill) return { type: "none" };

  const solidFill = getFirstByLocal(parent, "solidFill");
  if (solidFill) {
    return {
      type: "solid",
      color: parseColor(solidFill, themeColors) || "#000000",
    };
  }

  const gradFill = getFirstByLocal(parent, "gradFill");
  if (gradFill) {
    const stops: { position: number; color: string }[] = [];
    for (const gs of getElementsByLocal(gradFill, "gs")) {
      const pos = parseInt(gs.getAttribute("pos") || "0") / 1000;
      const color = parseColor(gs, themeColors) || "#000000";
      stops.push({ position: pos, color });
    }
    const lin = getFirstByLocal(gradFill, "lin");
    const angle = lin ? parseInt(lin.getAttribute("ang") || "0") / 60000 : 0;
    return { type: "gradient", gradientStops: stops, gradientAngle: angle };
  }

  return undefined;
}

/** Resolve relationship ID to target path */
function resolveRel(rels: Document, rId: string): string | null {
  const relEls = rels.getElementsByTagName("Relationship");
  for (let i = 0; i < relEls.length; i++) {
    if (relEls[i].getAttribute("Id") === rId) {
      return relEls[i].getAttribute("Target");
    }
  }
  return null;
}

/** Get MIME type from file extension */
function getMimeFromExt(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    webp: "image/webp",
    tiff: "image/tiff",
    tif: "image/tiff",
    emf: "image/emf",
    wmf: "image/wmf",
  };
  return map[ext] || "image/png";
}

// ── Theme Parser ───────────────────────────────────────────────────

function parseThemeColors(themeXml: string): Map<string, string> {
  const colors = new Map<string, string>();
  const doc = parseXml(themeXml);

  const schemeMap: Record<string, string[]> = {
    dk1: ["dk1"],
    dk2: ["dk2"],
    lt1: ["lt1"],
    lt2: ["lt2"],
    accent1: ["accent1"],
    accent2: ["accent2"],
    accent3: ["accent3"],
    accent4: ["accent4"],
    accent5: ["accent5"],
    accent6: ["accent6"],
    hlink: ["hlink"],
    folHlink: ["folHlink"],
  };

  const clrScheme = getFirstByLocal(doc, "clrScheme");
  if (!clrScheme) return colors;

  for (const [xmlTag, aliases] of Object.entries(schemeMap)) {
    const el = getFirstByLocal(clrScheme, xmlTag);
    if (el) {
      const srgb = getFirstByLocal(el, "srgbClr");
      const sysClr = getFirstByLocal(el, "sysClr");
      let hex: string | undefined;
      if (srgb) hex = "#" + (srgb.getAttribute("val") || "000000");
      else if (sysClr) hex = "#" + (sysClr.getAttribute("lastClr") || "000000");
      if (hex) {
        for (const alias of aliases) colors.set(alias, hex);
      }
    }
  }

  // Common aliases
  if (colors.has("dk1")) colors.set("tx1", colors.get("dk1")!);
  if (colors.has("lt1")) colors.set("bg1", colors.get("lt1")!);
  if (colors.has("dk2")) colors.set("tx2", colors.get("dk2")!);
  if (colors.has("lt2")) colors.set("bg2", colors.get("lt2")!);

  return colors;
}

// ── Slide Parser ───────────────────────────────────────────────────

async function parseSlide(
  zip: JSZip,
  slideIndex: number,
  themeColors: Map<string, string>
): Promise<SlideData> {
  const slidePath = `ppt/slides/slide${slideIndex}.xml`;
  const relsPath = `ppt/slides/_rels/slide${slideIndex}.xml.rels`;

  const slideXml = await readZipText(zip, slidePath);
  if (!slideXml) return { elements: [] };

  const doc = parseXml(slideXml);
  const relsXml = await readZipText(zip, relsPath);
  const relDoc = relsXml ? parseXml(relsXml) : null;

  const slide: SlideData = { elements: [] };

  // ── Background ──
  const bgEl = getFirstByLocal(doc, "bg");
  if (bgEl) {
    const bgFill = parseFill(bgEl, themeColors);
    if (bgFill && bgFill.type === "solid") {
      slide.background = { type: "solid", color: bgFill.color };
    } else if (bgFill && bgFill.type === "gradient") {
      slide.background = {
        type: "gradient",
        gradientStops: bgFill.gradientStops,
      };
    }
    // Check for background image
    const blipFill = getFirstByLocal(bgEl, "blipFill");
    if (blipFill && relDoc) {
      const blip = getFirstByLocal(blipFill, "blip");
      const embedId = blip?.getAttributeNS(NS.r, "embed") || blip?.getAttribute("r:embed");
      if (embedId) {
        const target = resolveRel(relDoc, embedId);
        if (target) {
          const imgPath = normalizePath("ppt/slides", target);
          const mime = getMimeFromExt(imgPath);
          const dataUrl = await readZipBase64(zip, imgPath, mime);
          if (dataUrl) {
            slide.background = { type: "image", imageData: dataUrl };
          }
        }
      }
    }
  }

  // ── Shape Tree ──
  const spTree = getFirstByLocal(doc, "spTree");
  if (!spTree) return slide;

  // Process shapes (sp)
  for (const sp of getElementsByLocal(spTree, "sp")) {
    const element = await parseShape(sp, themeColors, zip, relDoc);
    if (element) slide.elements.push(element);
  }

  // Process pictures (pic)
  for (const pic of getElementsByLocal(spTree, "pic")) {
    const element = await parsePicture(pic, zip, relDoc, themeColors);
    if (element) slide.elements.push(element);
  }

  // Process group shapes (grpSp) — flatten children
  for (const grpSp of getElementsByLocal(spTree, "grpSp")) {
    // Only handle direct children of spTree
    if (grpSp.parentElement?.localName !== "spTree") continue;
    for (const sp of getElementsByLocal(grpSp, "sp")) {
      const element = await parseShape(sp, themeColors, zip, relDoc);
      if (element) slide.elements.push(element);
    }
    for (const pic of getElementsByLocal(grpSp, "pic")) {
      const element = await parsePicture(pic, zip, relDoc, themeColors);
      if (element) slide.elements.push(element);
    }
  }

  return slide;
}

/** Parse a shape element */
async function parseShape(
  sp: Element,
  themeColors: Map<string, string>,
  zip: JSZip,
  relDoc: Document | null
): Promise<SlideElement | null> {
  const spPr = getFirstByLocal(sp, "spPr");
  if (!spPr) return null;

  const pos = parsePosition(spPr);
  if (!pos) return null;

  const rotation = parseRotation(spPr);
  const fill = parseFill(spPr, themeColors);
  const outline = parseOutline(spPr, themeColors);
  const cornerRadius = parseCornerRadius(spPr);

  // Check for blipFill (image fill) inside spPr
  const blipFill = getFirstByLocal(spPr, "blipFill");
  if (blipFill && relDoc) {
    const blip = getFirstByLocal(blipFill, "blip");
    const embedId = blip?.getAttributeNS(NS.r, "embed") || blip?.getAttribute("r:embed");
    if (embedId) {
      const target = resolveRel(relDoc, embedId);
      if (target) {
        const imgPath = normalizePath("ppt/slides", target);
        const mime = getMimeFromExt(imgPath);
        const dataUrl = await readZipBase64(zip, imgPath, mime);
        if (dataUrl) {
          return {
            type: "image",
            position: pos,
            rotation,
            imageData: dataUrl,
          };
        }
      }
    }
  }

  // Determine shape type
  const prstGeom = getFirstByLocal(spPr, "prstGeom");
  const shapeType = prstGeom?.getAttribute("prst") || "rect";

  // Parse text body
  const txBody = getFirstByLocal(sp, "txBody");
  const paragraphs = txBody ? parseParagraphs(txBody, themeColors) : undefined;

  const hasText = paragraphs && paragraphs.some((p) => p.runs.some((r) => r.text.trim()));

  return {
    type: hasText ? "text" : "shape",
    position: pos,
    rotation,
    paragraphs: hasText ? paragraphs : undefined,
    shapeType,
    fill,
    outline: outline || undefined,
    cornerRadius,
  };
}

/** Parse a picture element */
async function parsePicture(
  pic: Element,
  zip: JSZip,
  relDoc: Document | null,
  themeColors: Map<string, string>
): Promise<SlideElement | null> {
  const spPr = getFirstByLocal(pic, "spPr");
  if (!spPr) return null;

  const pos = parsePosition(spPr);
  if (!pos) return null;

  const rotation = parseRotation(spPr);

  // Get image reference
  const blipFill = getFirstByLocal(pic, "blipFill");
  if (!blipFill || !relDoc) return null;

  const blip = getFirstByLocal(blipFill, "blip");
  const embedId = blip?.getAttributeNS(NS.r, "embed") || blip?.getAttribute("r:embed");
  if (!embedId) return null;

  const target = resolveRel(relDoc, embedId);
  if (!target) return null;

  const imgPath = normalizePath("ppt/slides", target);
  const mime = getMimeFromExt(imgPath);
  const dataUrl = await readZipBase64(zip, imgPath, mime);

  if (!dataUrl) return null;

  return {
    type: "image",
    position: pos,
    rotation,
    imageData: dataUrl,
  };
}

/** Parse position from spPr */
function parsePosition(spPr: Element): SlideElement["position"] | null {
  const xfrm = getFirstByLocal(spPr, "xfrm");
  if (!xfrm) return null;

  const off = getFirstByLocal(xfrm, "off");
  const ext = getFirstByLocal(xfrm, "ext");
  if (!off || !ext) return null;

  return {
    x: parseInt(off.getAttribute("x") || "0"),
    y: parseInt(off.getAttribute("y") || "0"),
    width: parseInt(ext.getAttribute("cx") || "0"),
    height: parseInt(ext.getAttribute("cy") || "0"),
  };
}

/** Parse rotation from spPr */
function parseRotation(spPr: Element): number | undefined {
  const xfrm = getFirstByLocal(spPr, "xfrm");
  if (!xfrm) return undefined;
  const rot = xfrm.getAttribute("rot");
  if (!rot) return undefined;
  return parseInt(rot) / 60000; // Convert from 60000ths of a degree
}

/** Parse outline/border */
function parseOutline(
  spPr: Element,
  themeColors: Map<string, string>
): { color: string; width: number } | null {
  const ln = getFirstByLocal(spPr, "ln");
  if (!ln) return null;

  const noFill = getFirstByLocal(ln, "noFill");
  if (noFill) return null;

  const w = parseInt(ln.getAttribute("w") || "0");
  const color = parseColor(ln, themeColors) || "#000000";

  return w > 0 ? { color, width: emuToPoints(w) } : null;
}

/** Parse corner radius for rounded rectangles */
function parseCornerRadius(spPr: Element): number | undefined {
  const prstGeom = getFirstByLocal(spPr, "prstGeom");
  if (!prstGeom) return undefined;

  const prst = prstGeom.getAttribute("prst");
  if (prst === "roundRect") {
    const avLst = getFirstByLocal(prstGeom, "avLst");
    if (avLst) {
      const gd = getFirstByLocal(avLst, "gd");
      if (gd) {
        const fmla = gd.getAttribute("fmla") || "";
        const match = fmla.match(/val\s+(\d+)/);
        if (match) return parseInt(match[1]) / 1000; // percentage
      }
    }
    return 10; // default 10% for roundRect
  }
  return undefined;
}

/** Parse paragraphs from txBody */
function parseParagraphs(txBody: Element, themeColors: Map<string, string>): ParagraphData[] {
  const paragraphs: ParagraphData[] = [];

  for (const p of getElementsByLocal(txBody, "p")) {
    // Only direct children paragraphs
    if (p.parentElement !== txBody) continue;

    const para: ParagraphData = { runs: [] };

    // Paragraph properties
    const pPr = getFirstByLocal(p, "pPr");
    if (pPr) {
      const algn = pPr.getAttribute("algn");
      if (algn === "ctr") para.alignment = "center";
      else if (algn === "r") para.alignment = "right";
      else if (algn === "just") para.alignment = "justify";
      else para.alignment = "left";

      const lvl = pPr.getAttribute("lvl");
      if (lvl) para.level = parseInt(lvl);

      // Bullet
      const buChar = getFirstByLocal(pPr, "buChar");
      if (buChar) {
        para.bulletChar = buChar.getAttribute("char") || "•";
      }
      const buAutoNum = getFirstByLocal(pPr, "buAutoNum");
      if (buAutoNum) {
        para.bulletChar = "1.";
      }

      // Spacing
      const spcBef = getFirstByLocal(pPr, "spcBef");
      if (spcBef) {
        const pts = getFirstByLocal(spcBef, "spcPts");
        if (pts) para.spaceBefore = parseInt(pts.getAttribute("val") || "0") / 100;
      }
      const spcAft = getFirstByLocal(pPr, "spcAft");
      if (spcAft) {
        const pts = getFirstByLocal(spcAft, "spcPts");
        if (pts) para.spaceAfter = parseInt(pts.getAttribute("val") || "0") / 100;
      }
    }

    // Text runs
    for (const r of getElementsByLocal(p, "r")) {
      if (r.parentElement !== p) continue;
      const run = parseTextRun(r, themeColors);
      if (run) para.runs.push(run);
    }

    // Standalone text (no run wrapper)
    for (const t of getElementsByLocal(p, "t")) {
      if (t.parentElement === p) {
        para.runs.push({ text: t.textContent || "" });
      }
    }

    // Line breaks
    for (const br of getElementsByLocal(p, "br")) {
      if (br.parentElement === p) {
        para.runs.push({ text: "\n" });
      }
    }

    paragraphs.push(para);
  }

  return paragraphs;
}

/** Parse a single text run */
function parseTextRun(r: Element, themeColors: Map<string, string>): TextRunData | null {
  const tEl = getFirstByLocal(r, "t");
  if (!tEl) return null;

  const text = tEl.textContent || "";
  const run: TextRunData = { text };

  const rPr = getFirstByLocal(r, "rPr");
  if (rPr) {
    run.bold = rPr.getAttribute("b") === "1";
    run.italic = rPr.getAttribute("i") === "1";
    run.underline = rPr.getAttribute("u") === "sng" || rPr.getAttribute("u") === "heavy";

    const sz = rPr.getAttribute("sz");
    if (sz) run.fontSize = parseInt(sz) / 100; // hundredths of a point → points

    // Font
    const latin = getFirstByLocal(rPr, "latin");
    if (latin) run.fontFamily = latin.getAttribute("typeface") || undefined;

    // Color
    const solidFill = getFirstByLocal(rPr, "solidFill");
    if (solidFill) {
      run.color = parseColor(solidFill, themeColors);
    }
  }

  return run;
}

/** Normalize a relative path against a base */
function normalizePath(basePath: string, relativePath: string): string {
  if (relativePath.startsWith("/")) return relativePath.slice(1);

  const baseParts = basePath.split("/");
  const relParts = relativePath.split("/");

  for (const part of relParts) {
    if (part === "..") baseParts.pop();
    else if (part !== ".") baseParts.push(part);
  }

  return baseParts.join("/");
}

// ── Main Parser ────────────────────────────────────────────────────

export async function parsePptx(arrayBuffer: ArrayBuffer): Promise<PresentationData> {
  const zip = await JSZip.loadAsync(arrayBuffer);

  // ── Parse theme ──
  let themeColors = new Map<string, string>();
  const themeXml = await readZipText(zip, "ppt/theme/theme1.xml");
  if (themeXml) {
    themeColors = parseThemeColors(themeXml);
  }

  // ── Parse presentation.xml for slide dimensions and slide list ──
  const presXml = await readZipText(zip, "ppt/presentation.xml");
  let slideWidth = DEFAULT_SLIDE_WIDTH;
  let slideHeight = DEFAULT_SLIDE_HEIGHT;
  let slideCount = 0;

  if (presXml) {
    const presDoc = parseXml(presXml);

    const sldSz = getFirstByLocal(presDoc, "sldSz");
    if (sldSz) {
      slideWidth = parseInt(sldSz.getAttribute("cx") || String(DEFAULT_SLIDE_WIDTH));
      slideHeight = parseInt(sldSz.getAttribute("cy") || String(DEFAULT_SLIDE_HEIGHT));
    }

    // Count slides from sldIdLst
    const sldIdLst = getFirstByLocal(presDoc, "sldIdLst");
    if (sldIdLst) {
      slideCount = getElementsByLocal(sldIdLst, "sldId").length;
    }
  }

  // Fallback: count slide files in zip
  if (slideCount === 0) {
    let i = 1;
    while (zip.file(`ppt/slides/slide${i}.xml`)) i++;
    slideCount = i - 1;
  }

  // ── Parse each slide ──
  const slides: SlideData[] = [];
  for (let i = 1; i <= slideCount; i++) {
    const slide = await parseSlide(zip, i, themeColors);
    slides.push(slide);
  }

  return { slideWidth, slideHeight, slides };
}
