import JSZip from "jszip";

// ── Types ──────────────────────────────────────────────────────────

export interface PresentationData {
  slideWidth: number;
  slideHeight: number;
  slides: SlideData[];
}

export interface PptxProgressMeta {
  slideWidth: number;
  slideHeight: number;
  slideCount: number;
}

export interface ParsePptxProgressiveOptions {
  onMeta?: (meta: PptxProgressMeta) => void;
  onSlide?: (payload: { index: number; slide: SlideData }) => void;
  signal?: AbortSignal;
  concurrency?: number;
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

export interface TextBodyProps {
  anchor?: "t" | "ctr" | "b"; // top, center, bottom
  anchorCtr?: boolean; // horizontal center
  lIns?: number; // left inset in EMU
  rIns?: number; // right inset
  tIns?: number; // top inset
  bIns?: number; // bottom inset
  wrap?: "square" | "none";
  autoFit?: "normal" | "shape" | "none";
}

export interface SlideElement {
  type: "text" | "image" | "shape" | "table";
  position: { x: number; y: number; width: number; height: number };
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
  // text + shape
  paragraphs?: ParagraphData[];
  bodyProps?: TextBodyProps;
  // image
  imageData?: string;
  imageCrop?: { l: number; r: number; t: number; b: number }; // crop percentages
  // shape
  shapeType?: string;
  fill?: FillData;
  outline?: OutlineData;
  cornerRadius?: number;
  shadow?: ShadowData;
  // table
  table?: TableData;
}

export interface OutlineData {
  color: string;
  width: number;
  dashType?: "solid" | "dash" | "dot" | "dashDot";
}

export interface ShadowData {
  color: string;
  blur: number;
  dist: number;
  dir: number; // angle in degrees
  alpha?: number;
}

export interface FillData {
  type: "solid" | "gradient" | "none" | "pattern";
  color?: string;
  gradientStops?: { position: number; color: string }[];
  gradientAngle?: number;
  gradientType?: "linear" | "radial";
}

export interface ParagraphData {
  alignment?: "left" | "center" | "right" | "justify";
  runs: TextRunData[];
  bulletChar?: string;
  bulletColor?: string;
  bulletSize?: number;
  level?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  lineSpacing?: number; // percentage (100 = single space)
  indent?: number; // first line indent in points
  marginLeft?: number; // left margin in points
  defTabSz?: number; // default tab size
}

export interface TextRunData {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  highlight?: string;
  letterSpacing?: number; // in points (can be negative)
  baseline?: number; // superscript/subscript offset
  caps?: "all" | "small" | "none";
}

export interface TableData {
  rows: TableRowData[];
  gridCols: number[]; // column widths in EMU
}

export interface TableRowData {
  height: number;
  cells: TableCellData[];
}

export interface TableCellData {
  paragraphs: ParagraphData[];
  fill?: FillData;
  borders?: {
    left?: OutlineData;
    right?: OutlineData;
    top?: OutlineData;
    bottom?: OutlineData;
  };
  gridSpan?: number;
  rowSpan?: number;
}

// ── Constants ──────────────────────────────────────────────────────

const EMU_PER_POINT = 12700;
const DEFAULT_SLIDE_WIDTH = 9144000;
const DEFAULT_SLIDE_HEIGHT = 6858000;
const DEFAULT_TEXT_INSET = 91440; // ~7.2pt default text inset

const NS = {
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  rel: "http://schemas.openxmlformats.org/package/2006/relationships",
};

// Font stacks for common PowerPoint fonts with web-safe fallbacks
const FONT_STACKS: Record<string, string> = {
  "Calibri": "'Calibri', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  "Arial": "Arial, 'Helvetica Neue', Helvetica, sans-serif",
  "Times New Roman": "'Times New Roman', Times, Georgia, serif",
  "Cambria": "Cambria, Georgia, 'Times New Roman', serif",
  "Verdana": "Verdana, Geneva, 'Segoe UI', sans-serif",
  "Tahoma": "Tahoma, Geneva, Verdana, sans-serif",
  "Georgia": "Georgia, 'Times New Roman', serif",
  "Garamond": "Garamond, 'Times New Roman', serif",
  "Comic Sans MS": "'Comic Sans MS', cursive, sans-serif",
  "Impact": "Impact, Haettenschweiler, 'Arial Black', sans-serif",
  "Trebuchet MS": "'Trebuchet MS', Helvetica, sans-serif",
  "Palatino Linotype": "'Palatino Linotype', Palatino, Georgia, serif",
  "Lucida Console": "'Lucida Console', Monaco, 'Courier New', monospace",
  "Consolas": "Consolas, Monaco, 'Courier New', monospace",
  "Courier New": "'Courier New', Courier, monospace",
  "Century Gothic": "'Century Gothic', 'Apple Gothic', sans-serif",
  "Franklin Gothic": "'Franklin Gothic Medium', 'Franklin Gothic', sans-serif",
  "Segoe UI": "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  "Open Sans": "'Open Sans', 'Segoe UI', Arial, sans-serif",
  "Roboto": "Roboto, 'Segoe UI', Arial, sans-serif",
  "Lato": "Lato, 'Open Sans', 'Segoe UI', sans-serif",
  "Montserrat": "Montserrat, 'Segoe UI', Arial, sans-serif",
};

const DEFAULT_FONT_STACK = "'Calibri', 'Segoe UI', Arial, sans-serif";

// ── Helpers ────────────────────────────────────────────────────────

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

/** Get a font stack for a given font family */
function getFontStack(fontFamily: string | undefined): string {
  if (!fontFamily) return DEFAULT_FONT_STACK;
  // Check if we have a predefined stack
  const stack = FONT_STACKS[fontFamily];
  if (stack) return stack;
  // Build a fallback stack
  return `'${fontFamily}', ${DEFAULT_FONT_STACK}`;
}

/** Parse hex color and apply modifiers (lumMod, lumOff, tint, shade, alpha) */
function applyColorModifiers(baseHex: string, modifiers: Element): string {
  // Get the modifiers
  const lumModEl = getFirstByLocal(modifiers, "lumMod");
  const lumOffEl = getFirstByLocal(modifiers, "lumOff");
  const tintEl = getFirstByLocal(modifiers, "tint");
  const shadeEl = getFirstByLocal(modifiers, "shade");
  const alphaEl = getFirstByLocal(modifiers, "alpha");
  
  let hex = baseHex.replace("#", "");
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  
  // Parse RGB
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  
  // Apply luminance modification
  if (lumModEl || lumOffEl) {
    const lumMod = lumModEl ? parseInt(lumModEl.getAttribute("val") || "100000") / 100000 : 1;
    const lumOff = lumOffEl ? parseInt(lumOffEl.getAttribute("val") || "0") / 100000 : 0;
    
    // Convert to HSL, modify, convert back
    const hsl = rgbToHsl(r, g, b);
    hsl.l = Math.min(1, Math.max(0, hsl.l * lumMod + lumOff));
    const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    r = rgb.r;
    g = rgb.g;
    b = rgb.b;
  }
  
  // Apply tint (mix with white)
  if (tintEl) {
    const tint = parseInt(tintEl.getAttribute("val") || "100000") / 100000;
    r = Math.round(r + (255 - r) * (1 - tint));
    g = Math.round(g + (255 - g) * (1 - tint));
    b = Math.round(b + (255 - b) * (1 - tint));
  }
  
  // Apply shade (mix with black)
  if (shadeEl) {
    const shade = parseInt(shadeEl.getAttribute("val") || "100000") / 100000;
    r = Math.round(r * shade);
    g = Math.round(g * shade);
    b = Math.round(b * shade);
  }
  
  // Handle alpha
  if (alphaEl) {
    const alpha = parseInt(alphaEl.getAttribute("val") || "100000") / 100000;
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
  }
  
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** RGB to HSL conversion */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return { h, s, l };
}

/** HSL to RGB conversion */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/** Parse an XML color value — handles srgbClr, schemeClr, and modifiers */
function parseColor(el: Element | null, themeColors: Map<string, string>): string | undefined {
  if (!el) return undefined;

  // Direct sRGB color
  const srgb = getFirstByLocal(el, "srgbClr");
  if (srgb) {
    const baseColor = "#" + (srgb.getAttribute("val") || "000000");
    // Check for color modifiers
    if (srgb.children.length > 0) {
      return applyColorModifiers(baseColor, srgb);
    }
    return baseColor;
  }

  // Theme/scheme color reference
  const scheme = getFirstByLocal(el, "schemeClr");
  if (scheme) {
    const val = scheme.getAttribute("val") || "";
    const mapped = themeColors.get(val);
    if (mapped) {
      // Apply modifiers if present
      if (scheme.children.length > 0) {
        return applyColorModifiers(mapped, scheme);
      }
      return mapped;
    }
  }

  // Preset color (named colors like "black", "white", etc.)
  const prstClr = getFirstByLocal(el, "prstClr");
  if (prstClr) {
    const val = prstClr.getAttribute("val") || "";
    const presetColors: Record<string, string> = {
      black: "#000000",
      white: "#FFFFFF",
      red: "#FF0000",
      green: "#00FF00",
      blue: "#0000FF",
      yellow: "#FFFF00",
      cyan: "#00FFFF",
      magenta: "#FF00FF",
    };
    return presetColors[val] || "#000000";
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
    const path = getFirstByLocal(gradFill, "path");
    let angle = 0;
    let gradientType: "linear" | "radial" = "linear";
    
    if (lin) {
      angle = parseInt(lin.getAttribute("ang") || "0") / 60000;
    } else if (path) {
      gradientType = "radial";
    }
    
    return { 
      type: "gradient", 
      gradientStops: stops, 
      gradientAngle: angle,
      gradientType,
    };
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

/** Parse shadow effect */
function parseShadow(effectLst: Element | null, themeColors: Map<string, string>): ShadowData | undefined {
  if (!effectLst) return undefined;
  
  const outerShdw = getFirstByLocal(effectLst, "outerShdw");
  if (!outerShdw) return undefined;
  
  const blurRad = parseInt(outerShdw.getAttribute("blurRad") || "0");
  const dist = parseInt(outerShdw.getAttribute("dist") || "0");
  const dir = parseInt(outerShdw.getAttribute("dir") || "0") / 60000; // degrees
  
  const color = parseColor(outerShdw, themeColors) || "rgba(0,0,0,0.3)";
  
  return {
    color,
    blur: emuToPoints(blurRad),
    dist: emuToPoints(dist),
    dir,
  };
}

/** Parse outline/border with dash support */
function parseOutline(
  spPr: Element,
  themeColors: Map<string, string>
): OutlineData | null {
  const ln = getFirstByLocal(spPr, "ln");
  if (!ln) return null;

  const noFill = getFirstByLocal(ln, "noFill");
  if (noFill) return null;

  const w = parseInt(ln.getAttribute("w") || "0");
  if (w <= 0) return null;
  
  const color = parseColor(ln, themeColors) || "#000000";
  
  // Parse dash type
  const prstDash = getFirstByLocal(ln, "prstDash");
  let dashType: OutlineData["dashType"] = "solid";
  if (prstDash) {
    const val = prstDash.getAttribute("val") || "solid";
    if (val === "dash" || val === "lgDash" || val === "sysDash") dashType = "dash";
    else if (val === "dot" || val === "sysDot") dashType = "dot";
    else if (val === "dashDot" || val === "lgDashDot") dashType = "dashDot";
  }

  return { color, width: emuToPoints(w), dashType };
}

/** Parse text body properties */
function parseBodyProps(txBody: Element): TextBodyProps {
  const bodyPr = getFirstByLocal(txBody, "bodyPr");
  if (!bodyPr) return {};
  
  return {
    anchor: (bodyPr.getAttribute("anchor") as TextBodyProps["anchor"]) || "t",
    anchorCtr: bodyPr.getAttribute("anchorCtr") === "1",
    lIns: parseInt(bodyPr.getAttribute("lIns") || String(DEFAULT_TEXT_INSET)),
    rIns: parseInt(bodyPr.getAttribute("rIns") || String(DEFAULT_TEXT_INSET)),
    tIns: parseInt(bodyPr.getAttribute("tIns") || String(DEFAULT_TEXT_INSET / 2)),
    bIns: parseInt(bodyPr.getAttribute("bIns") || String(DEFAULT_TEXT_INSET / 2)),
    wrap: bodyPr.getAttribute("wrap") === "none" ? "none" : "square",
    autoFit: bodyPr.hasAttribute("noAutofit") ? "none" : 
             getFirstByLocal(bodyPr, "spAutoFit") ? "shape" : "normal",
  };
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

// ── Slide Layout/Master Background Parser ──

async function parseLayoutBackground(
  zip: JSZip,
  layoutPath: string,
  themeColors: Map<string, string>
): Promise<BackgroundData | undefined> {
  const layoutXml = await readZipText(zip, layoutPath);
  if (!layoutXml) return undefined;
  
  const doc = parseXml(layoutXml);
  const relsPath = layoutPath.replace(".xml", ".xml.rels").replace("slideLayouts/", "slideLayouts/_rels/");
  const relsXml = await readZipText(zip, relsPath);
  const relDoc = relsXml ? parseXml(relsXml) : null;
  
  // Check for background in cSld element
  const cSld = getFirstByLocal(doc, "cSld");
  if (!cSld) return undefined;
  
  const bgEl = getFirstByLocal(cSld, "bg");
  if (!bgEl) return undefined;
  
  const bgPr = getFirstByLocal(bgEl, "bgPr");
  if (bgPr) {
    const fill = parseFill(bgPr, themeColors);
    if (fill && fill.type === "solid") {
      return { type: "solid", color: fill.color };
    } else if (fill && fill.type === "gradient") {
      return { type: "gradient", gradientStops: fill.gradientStops };
    }
    
    // Background image
    const blipFill = getFirstByLocal(bgPr, "blipFill");
    if (blipFill && relDoc) {
      const blip = getFirstByLocal(blipFill, "blip");
      const embedId = blip?.getAttributeNS(NS.r, "embed") || blip?.getAttribute("r:embed");
      if (embedId) {
        const target = resolveRel(relDoc, embedId);
        if (target) {
          const basePath = layoutPath.substring(0, layoutPath.lastIndexOf("/"));
          const imgPath = normalizePath(basePath, target);
          const mime = getMimeFromExt(imgPath);
          const dataUrl = await readZipBase64(zip, imgPath, mime);
          if (dataUrl) {
            return { type: "image", imageData: dataUrl };
          }
        }
      }
    }
  }
  
  return undefined;
}

async function parseSlideMasterBackground(
  zip: JSZip,
  masterPath: string,
  themeColors: Map<string, string>
): Promise<BackgroundData | undefined> {
  const masterXml = await readZipText(zip, masterPath);
  if (!masterXml) return undefined;
  
  const doc = parseXml(masterXml);
  const relsPath = masterPath.replace(".xml", ".xml.rels").replace("slideMasters/", "slideMasters/_rels/");
  const relsXml = await readZipText(zip, relsPath);
  const relDoc = relsXml ? parseXml(relsXml) : null;
  
  const cSld = getFirstByLocal(doc, "cSld");
  if (!cSld) return undefined;
  
  const bgEl = getFirstByLocal(cSld, "bg");
  if (!bgEl) return undefined;
  
  const bgPr = getFirstByLocal(bgEl, "bgPr");
  if (bgPr) {
    const fill = parseFill(bgPr, themeColors);
    if (fill && fill.type === "solid") {
      return { type: "solid", color: fill.color };
    } else if (fill && fill.type === "gradient") {
      return { type: "gradient", gradientStops: fill.gradientStops };
    }
    
    // Background image
    const blipFill = getFirstByLocal(bgPr, "blipFill");
    if (blipFill && relDoc) {
      const blip = getFirstByLocal(blipFill, "blip");
      const embedId = blip?.getAttributeNS(NS.r, "embed") || blip?.getAttribute("r:embed");
      if (embedId) {
        const target = resolveRel(relDoc, embedId);
        if (target) {
          const basePath = masterPath.substring(0, masterPath.lastIndexOf("/"));
          const imgPath = normalizePath(basePath, target);
          const mime = getMimeFromExt(imgPath);
          const dataUrl = await readZipBase64(zip, imgPath, mime);
          if (dataUrl) {
            return { type: "image", imageData: dataUrl };
          }
        }
      }
    }
  }
  
  // Check bgRef for theme background
  const bgRef = getFirstByLocal(bgEl, "bgRef");
  if (bgRef) {
    const color = parseColor(bgRef, themeColors);
    if (color) {
      return { type: "solid", color };
    }
  }
  
  return undefined;
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
  // First try slide's own background
  const cSld = getFirstByLocal(doc, "cSld");
  const bgEl = cSld ? getFirstByLocal(cSld, "bg") : getFirstByLocal(doc, "bg");
  
  if (bgEl) {
    const bgPr = getFirstByLocal(bgEl, "bgPr");
    if (bgPr) {
      const bgFill = parseFill(bgPr, themeColors);
      if (bgFill && bgFill.type === "solid") {
        slide.background = { type: "solid", color: bgFill.color };
      } else if (bgFill && bgFill.type === "gradient") {
        slide.background = {
          type: "gradient",
          gradientStops: bgFill.gradientStops,
        };
      }
      // Check for background image
      const blipFill = getFirstByLocal(bgPr, "blipFill");
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
    
    // Check bgRef for theme-based background
    const bgRef = getFirstByLocal(bgEl, "bgRef");
    if (bgRef && !slide.background) {
      const color = parseColor(bgRef, themeColors);
      if (color) {
        slide.background = { type: "solid", color };
      }
    }
  }
  
  // If no background found, try to get from slide layout
  if (!slide.background && relDoc) {
    const relEls = relDoc.getElementsByTagName("Relationship");
    for (let i = 0; i < relEls.length; i++) {
      const type = relEls[i].getAttribute("Type") || "";
      if (type.includes("slideLayout")) {
        const target = relEls[i].getAttribute("Target");
        if (target) {
          const layoutPath = normalizePath("ppt/slides", target);
          const layoutBg = await parseLayoutBackground(zip, layoutPath, themeColors);
          if (layoutBg) {
            slide.background = layoutBg;
            break;
          }
          
          // If layout has no bg, try slide master
          const layoutRelsPath = layoutPath.replace(".xml", ".xml.rels").replace("slideLayouts/", "slideLayouts/_rels/");
          const layoutRelsXml = await readZipText(zip, layoutRelsPath);
          if (layoutRelsXml) {
            const layoutRelDoc = parseXml(layoutRelsXml);
            const layoutRelEls = layoutRelDoc.getElementsByTagName("Relationship");
            for (let j = 0; j < layoutRelEls.length; j++) {
              const layoutRelType = layoutRelEls[j].getAttribute("Type") || "";
              if (layoutRelType.includes("slideMaster")) {
                const masterTarget = layoutRelEls[j].getAttribute("Target");
                if (masterTarget) {
                  const layoutDir = layoutPath.substring(0, layoutPath.lastIndexOf("/"));
                  const masterPath = normalizePath(layoutDir, masterTarget);
                  const masterBg = await parseSlideMasterBackground(zip, masterPath, themeColors);
                  if (masterBg) {
                    slide.background = masterBg;
                  }
                }
                break;
              }
            }
          }
        }
        break;
      }
    }
  }
  
  // Default to white if still no background
  if (!slide.background) {
    slide.background = { type: "solid", color: "#FFFFFF" };
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
  
  // Process connector shapes (cxnSp)
  for (const cxnSp of getElementsByLocal(spTree, "cxnSp")) {
    const element = await parseConnector(cxnSp, themeColors);
    if (element) slide.elements.push(element);
  }

  // Process group shapes (grpSp) — flatten children with transform
  for (const grpSp of getElementsByLocal(spTree, "grpSp")) {
    // Only handle direct children of spTree
    if (grpSp.parentElement?.localName !== "spTree") continue;
    
    const groupElements = await parseGroupShape(grpSp, themeColors, zip, relDoc);
    slide.elements.push(...groupElements);
  }
  
  // Process tables (graphicFrame with a:tbl)
  for (const graphicFrame of getElementsByLocal(spTree, "graphicFrame")) {
    if (graphicFrame.parentElement?.localName !== "spTree") continue;
    const element = await parseTable(graphicFrame, themeColors);
    if (element) slide.elements.push(element);
  }

  return slide;
}

/** Parse a connector shape */
async function parseConnector(
  cxnSp: Element,
  themeColors: Map<string, string>
): Promise<SlideElement | null> {
  const spPr = getFirstByLocal(cxnSp, "spPr");
  if (!spPr) return null;

  const pos = parsePosition(spPr);
  if (!pos) return null;

  const { rotation, flipH, flipV } = parseTransform(spPr);
  const outline = parseOutline(spPr, themeColors);
  
  // Connectors are typically lines
  const prstGeom = getFirstByLocal(spPr, "prstGeom");
  const shapeType = prstGeom?.getAttribute("prst") || "line";

  return {
    type: "shape",
    position: pos,
    rotation,
    flipH,
    flipV,
    shapeType,
    outline: outline || undefined,
    fill: { type: "none" },
  };
}

/** Parse group shape and flatten children with correct transforms */
async function parseGroupShape(
  grpSp: Element,
  themeColors: Map<string, string>,
  zip: JSZip,
  relDoc: Document | null
): Promise<SlideElement[]> {
  const elements: SlideElement[] = [];
  
  // Get group transform
  const grpSpPr = getFirstByLocal(grpSp, "grpSpPr");
  const grpXfrm = grpSpPr ? getFirstByLocal(grpSpPr, "xfrm") : null;
  
  // Group offset and extent
  let grpOffX = 0, grpOffY = 0;
  let grpExtCx = 1, grpExtCy = 1;
  // Child coordinate system
  let chOffX = 0, chOffY = 0;
  let chExtCx = 1, chExtCy = 1;
  
  if (grpXfrm) {
    const off = getFirstByLocal(grpXfrm, "off");
    const ext = getFirstByLocal(grpXfrm, "ext");
    const chOff = getFirstByLocal(grpXfrm, "chOff");
    const chExt = getFirstByLocal(grpXfrm, "chExt");
    
    if (off) {
      grpOffX = parseInt(off.getAttribute("x") || "0");
      grpOffY = parseInt(off.getAttribute("y") || "0");
    }
    if (ext) {
      grpExtCx = parseInt(ext.getAttribute("cx") || "1");
      grpExtCy = parseInt(ext.getAttribute("cy") || "1");
    }
    if (chOff) {
      chOffX = parseInt(chOff.getAttribute("x") || "0");
      chOffY = parseInt(chOff.getAttribute("y") || "0");
    }
    if (chExt) {
      chExtCx = parseInt(chExt.getAttribute("cx") || "1") || 1;
      chExtCy = parseInt(chExt.getAttribute("cy") || "1") || 1;
    }
  }
  
  // Calculate scale factors
  const scaleX = grpExtCx / chExtCx;
  const scaleY = grpExtCy / chExtCy;
  
  // Process direct child shapes
  for (const sp of Array.from(grpSp.children).filter(el => el.localName === "sp")) {
    const element = await parseShape(sp as Element, themeColors, zip, relDoc);
    if (element) {
      // Transform position relative to group
      element.position = {
        x: grpOffX + (element.position.x - chOffX) * scaleX,
        y: grpOffY + (element.position.y - chOffY) * scaleY,
        width: element.position.width * scaleX,
        height: element.position.height * scaleY,
      };
      elements.push(element);
    }
  }
  
  // Process direct child pictures
  for (const pic of Array.from(grpSp.children).filter(el => el.localName === "pic")) {
    const element = await parsePicture(pic as Element, zip, relDoc, themeColors);
    if (element) {
      element.position = {
        x: grpOffX + (element.position.x - chOffX) * scaleX,
        y: grpOffY + (element.position.y - chOffY) * scaleY,
        width: element.position.width * scaleX,
        height: element.position.height * scaleY,
      };
      elements.push(element);
    }
  }
  
  return elements;
}

/** Parse a table from graphicFrame */
async function parseTable(
  graphicFrame: Element,
  themeColors: Map<string, string>
): Promise<SlideElement | null> {
  // Get position from xfrm
  const xfrm = getFirstByLocal(graphicFrame, "xfrm");
  if (!xfrm) return null;
  
  const off = getFirstByLocal(xfrm, "off");
  const ext = getFirstByLocal(xfrm, "ext");
  if (!off || !ext) return null;
  
  const pos = {
    x: parseInt(off.getAttribute("x") || "0"),
    y: parseInt(off.getAttribute("y") || "0"),
    width: parseInt(ext.getAttribute("cx") || "0"),
    height: parseInt(ext.getAttribute("cy") || "0"),
  };
  
  // Find the table element
  const tbl = getFirstByLocal(graphicFrame, "tbl");
  if (!tbl) return null;
  
  // Parse table grid (column widths)
  const tblGrid = getFirstByLocal(tbl, "tblGrid");
  const gridCols: number[] = [];
  if (tblGrid) {
    for (const gridCol of getElementsByLocal(tblGrid, "gridCol")) {
      const w = parseInt(gridCol.getAttribute("w") || "0");
      gridCols.push(w);
    }
  }
  
  // Parse rows
  const rows: TableRowData[] = [];
  for (const tr of getElementsByLocal(tbl, "tr")) {
    if (tr.parentElement !== tbl) continue;
    
    const height = parseInt(tr.getAttribute("h") || "0");
    const cells: TableCellData[] = [];
    
    for (const tc of getElementsByLocal(tr, "tc")) {
      if (tc.parentElement !== tr) continue;
      
      // Parse cell properties
      const tcPr = getFirstByLocal(tc, "tcPr");
      const fill = tcPr ? parseFill(tcPr, themeColors) : undefined;
      
      // Parse cell borders
      const borders: TableCellData["borders"] = {};
      if (tcPr) {
        const lnL = getFirstByLocal(tcPr, "lnL");
        const lnR = getFirstByLocal(tcPr, "lnR");
        const lnT = getFirstByLocal(tcPr, "lnT");
        const lnB = getFirstByLocal(tcPr, "lnB");
        
        if (lnL) borders.left = parseCellBorder(lnL, themeColors);
        if (lnR) borders.right = parseCellBorder(lnR, themeColors);
        if (lnT) borders.top = parseCellBorder(lnT, themeColors);
        if (lnB) borders.bottom = parseCellBorder(lnB, themeColors);
      }
      
      // Parse cell text
      const txBody = getFirstByLocal(tc, "txBody");
      const paragraphs = txBody ? parseParagraphs(txBody, themeColors) : [];
      
      // Grid span and row span
      const gridSpan = parseInt(tc.getAttribute("gridSpan") || "1");
      const rowSpan = parseInt(tc.getAttribute("rowSpan") || "1");
      
      cells.push({
        paragraphs,
        fill,
        borders,
        gridSpan: gridSpan > 1 ? gridSpan : undefined,
        rowSpan: rowSpan > 1 ? rowSpan : undefined,
      });
    }
    
    rows.push({ height, cells });
  }
  
  return {
    type: "table",
    position: pos,
    table: { rows, gridCols },
  };
}

/** Parse cell border */
function parseCellBorder(
  ln: Element,
  themeColors: Map<string, string>
): OutlineData | undefined {
  const w = parseInt(ln.getAttribute("w") || "0");
  if (w <= 0) return undefined;
  
  const noFill = getFirstByLocal(ln, "noFill");
  if (noFill) return undefined;
  
  const color = parseColor(ln, themeColors) || "#000000";
  
  return {
    color,
    width: emuToPoints(w),
    dashType: "solid",
  };
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

  const { rotation, flipH, flipV } = parseTransform(spPr);
  const fill = parseFill(spPr, themeColors);
  const outline = parseOutline(spPr, themeColors);
  const cornerRadius = parseCornerRadius(spPr);
  
  // Parse shadow from effect list
  const effectLst = getFirstByLocal(spPr, "effectLst");
  const shadow = parseShadow(effectLst, themeColors);

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
          const crop = parseImageCrop(blipFill);
          return {
            type: "image",
            position: pos,
            rotation,
            flipH,
            flipV,
            imageData: dataUrl,
            imageCrop: crop,
            shadow,
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
  const bodyProps = txBody ? parseBodyProps(txBody) : undefined;

  const hasText = paragraphs && paragraphs.some((p) => p.runs.some((r) => r.text.trim()));

  return {
    type: hasText ? "text" : "shape",
    position: pos,
    rotation,
    flipH,
    flipV,
    paragraphs: hasText ? paragraphs : undefined,
    bodyProps,
    shapeType,
    fill,
    outline: outline || undefined,
    cornerRadius,
    shadow,
  };
}

/** Parse image crop information */
function parseImageCrop(blipFill: Element): SlideElement["imageCrop"] | undefined {
  const srcRect = getFirstByLocal(blipFill, "srcRect");
  if (!srcRect) return undefined;
  
  const l = parseInt(srcRect.getAttribute("l") || "0") / 1000;
  const r = parseInt(srcRect.getAttribute("r") || "0") / 1000;
  const t = parseInt(srcRect.getAttribute("t") || "0") / 1000;
  const b = parseInt(srcRect.getAttribute("b") || "0") / 1000;
  
  if (l === 0 && r === 0 && t === 0 && b === 0) return undefined;
  return { l, r, t, b };
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

  const { rotation, flipH, flipV } = parseTransform(spPr);
  
  // Parse shadow
  const effectLst = getFirstByLocal(spPr, "effectLst");
  const shadow = parseShadow(effectLst, themeColors);

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

  const crop = parseImageCrop(blipFill);

  return {
    type: "image",
    position: pos,
    rotation,
    flipH,
    flipV,
    imageData: dataUrl,
    imageCrop: crop,
    shadow,
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

/** Parse rotation and flip from spPr */
function parseTransform(spPr: Element): { rotation?: number; flipH?: boolean; flipV?: boolean } {
  const xfrm = getFirstByLocal(spPr, "xfrm");
  if (!xfrm) return {};
  
  const rot = xfrm.getAttribute("rot");
  const flipH = xfrm.getAttribute("flipH") === "1";
  const flipV = xfrm.getAttribute("flipV") === "1";
  
  return {
    rotation: rot ? parseInt(rot) / 60000 : undefined,
    flipH: flipH || undefined,
    flipV: flipV || undefined,
  };
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
      
      // Indentation
      const indent = pPr.getAttribute("indent");
      if (indent) para.indent = emuToPoints(parseInt(indent));
      
      const marL = pPr.getAttribute("marL");
      if (marL) para.marginLeft = emuToPoints(parseInt(marL));
      
      // Default tab size
      const defTabSz = pPr.getAttribute("defTabSz");
      if (defTabSz) para.defTabSz = emuToPoints(parseInt(defTabSz));

      // Bullet
      const buChar = getFirstByLocal(pPr, "buChar");
      if (buChar) {
        para.bulletChar = buChar.getAttribute("char") || "•";
      }
      const buAutoNum = getFirstByLocal(pPr, "buAutoNum");
      if (buAutoNum) {
        const type = buAutoNum.getAttribute("type") || "arabicPeriod";
        if (type.includes("alpha")) para.bulletChar = "a.";
        else if (type.includes("roman")) para.bulletChar = "i.";
        else para.bulletChar = "1.";
      }
      
      // Bullet color
      const buClr = getFirstByLocal(pPr, "buClr");
      if (buClr) {
        para.bulletColor = parseColor(buClr, themeColors);
      }
      
      // Bullet size (percentage)
      const buSzPct = getFirstByLocal(pPr, "buSzPct");
      if (buSzPct) {
        para.bulletSize = parseInt(buSzPct.getAttribute("val") || "100000") / 1000;
      }

      // Spacing before
      const spcBef = getFirstByLocal(pPr, "spcBef");
      if (spcBef) {
        const pts = getFirstByLocal(spcBef, "spcPts");
        const pct = getFirstByLocal(spcBef, "spcPct");
        if (pts) para.spaceBefore = parseInt(pts.getAttribute("val") || "0") / 100;
        else if (pct) para.spaceBefore = parseInt(pct.getAttribute("val") || "0") / 1000;
      }
      
      // Spacing after
      const spcAft = getFirstByLocal(pPr, "spcAft");
      if (spcAft) {
        const pts = getFirstByLocal(spcAft, "spcPts");
        const pct = getFirstByLocal(spcAft, "spcPct");
        if (pts) para.spaceAfter = parseInt(pts.getAttribute("val") || "0") / 100;
        else if (pct) para.spaceAfter = parseInt(pct.getAttribute("val") || "0") / 1000;
      }
      
      // Line spacing
      const lnSpc = getFirstByLocal(pPr, "lnSpc");
      if (lnSpc) {
        const pct = getFirstByLocal(lnSpc, "spcPct");
        if (pct) para.lineSpacing = parseInt(pct.getAttribute("val") || "100000") / 1000;
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
    
    // Fields (like slide numbers, dates)
    for (const fld of getElementsByLocal(p, "fld")) {
      if (fld.parentElement !== p) continue;
      const tEl = getFirstByLocal(fld, "t");
      if (tEl) {
        para.runs.push({ text: tEl.textContent || "" });
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
    run.underline = rPr.getAttribute("u") === "sng" || rPr.getAttribute("u") === "heavy" || rPr.getAttribute("u") === "dbl";
    run.strike = rPr.getAttribute("strike") === "sngStrike" || rPr.getAttribute("strike") === "dblStrike";

    const sz = rPr.getAttribute("sz");
    if (sz) run.fontSize = parseInt(sz) / 100; // hundredths of a point → points

    // Font - try multiple sources
    const latin = getFirstByLocal(rPr, "latin");
    const cs = getFirstByLocal(rPr, "cs"); // complex script
    const ea = getFirstByLocal(rPr, "ea"); // east asian
    
    if (latin) run.fontFamily = getFontStack(latin.getAttribute("typeface") || undefined);
    else if (cs) run.fontFamily = getFontStack(cs.getAttribute("typeface") || undefined);
    else if (ea) run.fontFamily = getFontStack(ea.getAttribute("typeface") || undefined);

    // Color
    const solidFill = getFirstByLocal(rPr, "solidFill");
    if (solidFill) {
      run.color = parseColor(solidFill, themeColors);
    }
    
    // Character spacing (tracking)
    const spc = rPr.getAttribute("spc");
    if (spc) run.letterSpacing = parseInt(spc) / 100; // hundredths of a point
    
    // Baseline (superscript/subscript)
    const baseline = rPr.getAttribute("baseline");
    if (baseline) run.baseline = parseInt(baseline) / 1000; // percentage
    
    // Caps
    const cap = rPr.getAttribute("cap");
    if (cap === "all") run.caps = "all";
    else if (cap === "small") run.caps = "small";
    
    // Highlight
    const highlight = getFirstByLocal(rPr, "highlight");
    if (highlight) {
      run.highlight = parseColor(highlight, themeColors);
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

interface PreparedPresentationContext {
  zip: JSZip;
  themeColors: Map<string, string>;
  slideWidth: number;
  slideHeight: number;
  slideCount: number;
}

async function preparePresentationContext(
  arrayBuffer: ArrayBuffer
): Promise<PreparedPresentationContext> {
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

  return {
    zip,
    themeColors,
    slideWidth,
    slideHeight,
    slideCount,
  };
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new Error("PPT parse aborted");
  }
}

export async function parsePptx(arrayBuffer: ArrayBuffer): Promise<PresentationData> {
  const { zip, themeColors, slideWidth, slideHeight, slideCount } =
    await preparePresentationContext(arrayBuffer);

  // ── Parse each slide ──
  const slides: SlideData[] = [];
  for (let i = 1; i <= slideCount; i++) {
    const slide = await parseSlide(zip, i, themeColors);
    slides.push(slide);
  }

  return { slideWidth, slideHeight, slides };
}

export async function parsePptxProgressive(
  arrayBuffer: ArrayBuffer,
  options: ParsePptxProgressiveOptions = {}
): Promise<PresentationData> {
  const { onMeta, onSlide, signal } = options;
  const requestedConcurrency = options.concurrency ?? 2;
  const concurrency = Math.max(1, Math.min(6, requestedConcurrency));

  throwIfAborted(signal);

  const { zip, themeColors, slideWidth, slideHeight, slideCount } =
    await preparePresentationContext(arrayBuffer);

  throwIfAborted(signal);

  onMeta?.({ slideWidth, slideHeight, slideCount });

  if (slideCount === 0) {
    return { slideWidth, slideHeight, slides: [] };
  }

  const slides: SlideData[] = new Array(slideCount);

  // Parse the first slide immediately so the UI can render quickly.
  const firstSlide = await parseSlide(zip, 1, themeColors);
  throwIfAborted(signal);
  slides[0] = firstSlide;
  onSlide?.({ index: 0, slide: firstSlide });

  if (slideCount > 1) {
    let nextSlideIndex = 2;
    const workerCount = Math.min(concurrency, slideCount - 1);

    const workers = Array.from({ length: workerCount }, async () => {
      while (true) {
        throwIfAborted(signal);

        const slideNumber = nextSlideIndex;
        nextSlideIndex += 1;
        if (slideNumber > slideCount) return;

        const parsedSlide = await parseSlide(zip, slideNumber, themeColors);
        throwIfAborted(signal);

        slides[slideNumber - 1] = parsedSlide;
        onSlide?.({ index: slideNumber - 1, slide: parsedSlide });
      }
    });

    await Promise.all(workers);
  }

  throwIfAborted(signal);

  return { slideWidth, slideHeight, slides };
}
