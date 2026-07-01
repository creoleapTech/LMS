const { JSDOM } = require("jsdom");
const JSZip = require("jszip");
const { readFileSync } = require("fs");

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
globalThis.DOMParser = dom.window.DOMParser;

const EMU_PER_POINT = 12700;

const NS = {
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  rel: "http://schemas.openxmlformats.org/package/2006/relationships",
};

function parseXml(xmlStr) {
  return new DOMParser().parseFromString(xmlStr, "application/xml");
}

function getElementsByLocal(parent, localName) {
  return Array.from(parent.getElementsByTagName("*")).filter(el => el.localName === localName);
}

function getFirstByLocal(parent, localName) {
  return getElementsByLocal(parent, localName)[0] || null;
}

function getDirectChildByLocal(parent, localName) {
  return Array.from(parent.children).filter(el => el.localName === localName)[0] || null;
}

async function readZipText(zip, path) {
  const file = zip.file(path);
  if (!file) return null;
  return file.async("text");
}

async function readZipBase64(zip, path, mimeType) {
  const file = zip.file(path);
  if (!file) return null;
  const b64 = await file.async("base64");
  return `data:${mimeType};base64,${b64}`;
}

function parseColor(el, themeColors) {
  if (!el) return undefined;
  const srgb = getFirstByLocal(el, "srgbClr");
  if (srgb) {
    const baseColor = "#" + (srgb.getAttribute("val") || "000000");
    if (srgb.children.length > 0) return applyColorModifiers(baseColor, srgb);
    return baseColor;
  }
  const scheme = getFirstByLocal(el, "schemeClr");
  if (scheme) {
    const mapped = themeColors.get(scheme.getAttribute("val") || "");
    if (mapped) {
      if (scheme.children.length > 0) return applyColorModifiers(mapped, scheme);
      return mapped;
    }
  }
  const prstClr = getFirstByLocal(el, "prstClr");
  if (prstClr) {
    const map = { black: "#000000", white: "#FFFFFF", red: "#FF0000", green: "#00FF00", blue: "#0000FF", yellow: "#FFFF00", cyan: "#00FFFF", magenta: "#FF00FF" };
    return map[prstClr.getAttribute("val") || ""] || "#000000";
  }
  return undefined;
}

function applyColorModifiers(baseHex, modifiers) {
  let hex = baseHex.replace("#", "");
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);

  const lumModEl = getFirstByLocal(modifiers, "lumMod");
  const lumOffEl = getFirstByLocal(modifiers, "lumOff");
  if (lumModEl || lumOffEl) {
    const lumMod = lumModEl ? parseInt(lumModEl.getAttribute("val") || "100000") / 100000 : 1;
    const lumOff = lumOffEl ? parseInt(lumOffEl.getAttribute("val") || "0") / 100000 : 0;
    const hsl = rgbToHsl(r, g, b);
    hsl.l = Math.min(1, Math.max(0, hsl.l * lumMod + lumOff));
    const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    r = rgb.r; g = rgb.g; b = rgb.b;
  }
  const tintEl = getFirstByLocal(modifiers, "tint");
  if (tintEl) {
    const tint = parseInt(tintEl.getAttribute("val") || "100000") / 100000;
    r = Math.round(r + (255 - r) * (1 - tint));
    g = Math.round(g + (255 - g) * (1 - tint));
    b = Math.round(b + (255 - b) * (1 - tint));
  }
  const shadeEl = getFirstByLocal(modifiers, "shade");
  if (shadeEl) {
    const shade = parseInt(shadeEl.getAttribute("val") || "100000") / 100000;
    r = Math.round(r * shade); g = Math.round(g * shade); b = Math.round(b * shade);
  }
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h, s, l };
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function parseThemeColors(themeXml) {
  const colors = new Map();
  const doc = parseXml(themeXml);
  const clrScheme = getFirstByLocal(doc, "clrScheme");
  if (!clrScheme) return colors;
  for (const xmlTag of ["dk1", "dk2", "lt1", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"]) {
    const el = getFirstByLocal(clrScheme, xmlTag);
    if (el) {
      const srgb = getFirstByLocal(el, "srgbClr");
      const sysClr = getFirstByLocal(el, "sysClr");
      if (srgb) colors.set(xmlTag, "#" + (srgb.getAttribute("val") || "000000"));
      else if (sysClr) colors.set(xmlTag, "#" + (sysClr.getAttribute("lastClr") || "000000"));
    }
  }
  if (colors.has("dk1")) colors.set("tx1", colors.get("dk1"));
  if (colors.has("lt1")) colors.set("bg1", colors.get("lt1"));
  return colors;
}

function resolveRel(rels, rId) {
  for (const rel of rels.getElementsByTagName("Relationship")) {
    if (rel.getAttribute("Id") === rId) return rel.getAttribute("Target");
  }
  return null;
}

function getMimeFromExt(filePath) {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  return { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", bmp: "image/bmp", emf: "image/emf", wmf: "image/wmf" }[ext] || "image/png";
}

async function testPptx(filePath) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`PPTX Parser Verification Test`);
  console.log(`${"=".repeat(60)}`);
  console.log(`File: ${filePath}`);

  const buffer = readFileSync(filePath);
  console.log(`File size: ${(buffer.length / 1024).toFixed(1)} KB`);

  const startTime = performance.now();
  const zip = await JSZip.loadAsync(buffer);

  const themeXml = await readZipText(zip, "ppt/theme/theme1.xml");
  const themeColors = themeXml ? parseThemeColors(themeXml) : new Map();
  console.log(`Theme colors loaded: ${themeColors.size}`);

  const presXml = await readZipText(zip, "ppt/presentation.xml");
  let slideWidth = 9144000, slideHeight = 6858000, slideCount = 0;

  if (presXml) {
    const presDoc = parseXml(presXml);
    const sldSz = getFirstByLocal(presDoc, "sldSz");
    if (sldSz) {
      slideWidth = parseInt(sldSz.getAttribute("cx") || "9144000");
      slideHeight = parseInt(sldSz.getAttribute("cy") || "6858000");
    }
    const sldIdLst = getFirstByLocal(presDoc, "sldIdLst");
    if (sldIdLst) slideCount = getElementsByLocal(sldIdLst, "sldId").length;
  }

  if (slideCount === 0) {
    let i = 1;
    while (zip.file(`ppt/slides/slide${i}.xml`)) i++;
    slideCount = i - 1;
  }

  const elapsed = performance.now() - startTime;
  console.log(`Parse time (headers): ${elapsed.toFixed(1)}ms`);
  console.log(`Slide dimensions: ${(slideWidth / 914400).toFixed(2)}" x ${(slideHeight / 914400).toFixed(2)}" (${slideWidth} x ${slideHeight} EMU)`);
  console.log(`Total slides: ${slideCount}`);
  console.log(`Aspect ratio: ${(slideWidth / slideHeight).toFixed(4)}`);

  let totalElements = 0;
  let totalTextElements = 0;
  let totalImageElements = 0;
  let totalTableElements = 0;
  let totalTextContent = 0;
  let issues = [];

  for (let si = 1; si <= slideCount; si++) {
    const slidePath = `ppt/slides/slide${si}.xml`;
    const relsPath = `ppt/slides/_rels/slide${si}.xml.rels`;
    const slideXml = await readZipText(zip, slidePath);
    if (!slideXml) {
      issues.push(`Slide ${si}: XML not found`);
      continue;
    }

    const doc = parseXml(slideXml);
    const relsXml = await readZipText(zip, relsPath);
    const relDoc = relsXml ? parseXml(relsXml) : null;
    const relMap = {};
    if (relDoc) {
      for (const rel of relDoc.getElementsByTagName("Relationship")) {
        const id = rel.getAttribute("Id");
        const target = rel.getAttribute("Target");
        if (id && target) relMap[id] = target;
      }
    }

    const spTree = getFirstByLocal(doc, "spTree");
    const sps = spTree ? getElementsByLocal(spTree, "sp") : [];
    const pics = spTree ? getElementsByLocal(spTree, "pic") : [];
    const graphicFrames = spTree ? getElementsByLocal(spTree, "graphicFrame") : [];
    const cxnSps = spTree ? getElementsByLocal(spTree, "cxnSp") : [];
    const grpSps = spTree ? getElementsByLocal(spTree, "grpSp") : [];

    console.log(`\n--- Slide ${si} ---`);
    console.log(`  Shapes: ${sps.length}, Pictures: ${pics.length}, Tables: ${graphicFrames.length}, Connectors: ${cxnSps.length}, Groups: ${grpSps.length}`);

    // Check background
    const cSld = getFirstByLocal(doc, "cSld");
    const bgEl = cSld ? getFirstByLocal(cSld, "bg") : null;
    let bgDesc = "default white";
    if (bgEl) {
      const bgPr = getFirstByLocal(bgEl, "bgPr");
      if (bgPr) {
        const solidFill = getFirstByLocal(bgPr, "solidFill");
        if (solidFill) {
          const color = parseColor(solidFill, themeColors);
          bgDesc = `solid ${color}`;
        }
        const gradFill = getFirstByLocal(bgPr, "gradFill");
        if (gradFill) {
          const stops = getElementsByLocal(gradFill, "gs");
          bgDesc = `gradient (${stops.length} stops)`;
        }
        const blipFill = getFirstByLocal(bgPr, "blipFill");
        if (blipFill) {
          const blip = getFirstByLocal(blipFill, "blip");
          const embedId = blip?.getAttributeNS(NS.r, "embed") || blip?.getAttribute("r:embed");
          if (embedId && relMap[embedId]) {
            bgDesc = `image → ${relMap[embedId]}`;
          } else {
            bgDesc = "image (unresolved)";
          }
        }
      }
    }
    console.log(`  Background: ${bgDesc}`);

    for (const sp of sps) {
      const spPr = getFirstByLocal(sp, "spPr");
      if (!spPr) continue;
      const xfrm = getFirstByLocal(spPr, "xfrm");
      if (!xfrm) continue;
      const off = getFirstByLocal(xfrm, "off");
      const ext = getFirstByLocal(xfrm, "ext");
      if (!off || !ext) continue;

      const x = parseInt(off.getAttribute("x") || "0");
      const y = parseInt(off.getAttribute("y") || "0");
      const w = parseInt(ext.getAttribute("cx") || "0");
      const h = parseInt(ext.getAttribute("cy") || "0");

      const prstGeom = getFirstByLocal(spPr, "prstGeom");
      const shapeType = prstGeom?.getAttribute("prst") || "rect";

      // Check for image fill in spPr
      const blipFillSpPr = getFirstByLocal(spPr, "blipFill");
      if (blipFillSpPr) {
        const blip = getFirstByLocal(blipFillSpPr, "blip");
        const embedId = blip?.getAttributeNS(NS.r, "embed") || blip?.getAttribute("r:embed");
        if (embedId && relMap[embedId]) {
          const ext2 = relMap[embedId].split(".").pop()?.toLowerCase();
          const isVector = ext2 === "emf" || ext2 === "wmf";
          console.log(`  [IMG] ${isVector ? "VECTOR" : "RASTER"} shape="${shapeType}" at (${(x / 914400).toFixed(2)}", ${(y / 914400).toFixed(2)}") size=${(w / 914400).toFixed(2)}"x${(h / 914400).toFixed(2)}" → ${relMap[embedId]}${isVector ? " ⚠ UNSUPPORTED IN BROWSER" : ""}`);
          if (isVector) issues.push(`Slide ${si}: Vector image ${relMap[embedId]} (EMF/WMF not renderable in browser)`);
          totalImageElements++;
          totalElements++;
          continue;
        }
      }

      // Check text
      const txBody = getFirstByLocal(sp, "txBody");
      const paragraphs = [];
      if (txBody) {
        for (const p of getElementsByLocal(txBody, "p")) {
          if (p.parentElement !== txBody) continue;
          const runs = [];
          for (const r of getElementsByLocal(p, "r")) {
            const rPr = getFirstByLocal(r, "rPr");
            const tEl = getFirstByLocal(r, "t");
            if (tEl) {
              const text = tEl.textContent || "";
              const sz = rPr?.getAttribute("sz");
              const fontEl = rPr ? (getFirstByLocal(rPr, "latin") || getFirstByLocal(rPr, "cs")) : null;
              const font = fontEl?.getAttribute("typeface");
              const colorEl = rPr ? getFirstByLocal(rPr, "solidFill") : null;
              const color = colorEl ? parseColor(colorEl, themeColors) : undefined;
              const bold = rPr?.getAttribute("b") === "1";
              const italic = rPr?.getAttribute("i") === "1";
              runs.push({
                text,
                fontSize: sz ? parseInt(sz) / 100 : undefined,
                fontFamily: font || undefined,
                color,
                bold,
                italic,
              });
            }
          }
          const text = runs.map(r => r.text).join("");
          if (text.trim()) paragraphs.push({ text, runs });
        }
      }

      if (paragraphs.length > 0) {
        const sampleText = paragraphs.map(p => p.text).join(" | ").substring(0, 120);
        const fmt = [];
        const firstRun = paragraphs[0]?.runs[0];
        if (firstRun) {
          if (firstRun.bold) fmt.push("bold");
          if (firstRun.italic) fmt.push("italic");
          if (firstRun.color) fmt.push(`color=${firstRun.color}`);
          if (firstRun.fontSize) fmt.push(`${firstRun.fontSize}pt`);
          if (firstRun.fontFamily) fmt.push(firstRun.fontFamily.split(",")[0].replace(/'/g, ""));
        }
        console.log(`  [TXT] shape="${shapeType}"${fmt.length ? " " + fmt.join(" ") : ""} at (${(x / 914400).toFixed(2)}", ${(y / 914400).toFixed(2)}") size=${(w / 914400).toFixed(2)}"x${(h / 914400).toFixed(2)}"`);
        console.log(`    → "${sampleText}"`);
        totalTextElements++;
        totalTextContent += paragraphs.reduce((sum, p) => sum + p.text.length, 0);
      } else {
        const solidFill = getFirstByLocal(spPr, "solidFill");
        let fillDesc = "";
        if (solidFill) {
          const color = parseColor(solidFill, themeColors);
          fillDesc = ` fill=${color}`;
        }
        const ln = getFirstByLocal(spPr, "ln");
        let lnDesc = "";
        if (ln) {
          const w2 = parseInt(ln.getAttribute("w") || "0");
          if (w2 > 0) {
            const lnFill = getFirstByLocal(ln, "solidFill");
            const lnColor = lnFill ? parseColor(lnFill, themeColors) : "default";
            lnDesc = ` outline=${lnColor} ${w2 / 12700}pt`;
          }
        }
        console.log(`  [SHP] shape="${shapeType}"${fillDesc}${lnDesc} at (${(x / 914400).toFixed(2)}", ${(y / 914400).toFixed(2)}") size=${(w / 914400).toFixed(2)}"x${(h / 914400).toFixed(2)}"`);
      }
      totalElements++;
    }

    for (const pic of pics) {
      const spPr = getFirstByLocal(pic, "spPr");
      if (!spPr) continue;
      const xfrm = getFirstByLocal(spPr, "xfrm");
      const off = xfrm ? getFirstByLocal(xfrm, "off") : null;
      const ext = xfrm ? getFirstByLocal(xfrm, "ext") : null;
      if (!off || !ext) continue;

      const x = parseInt(off.getAttribute("x") || "0");
      const y = parseInt(off.getAttribute("y") || "0");
      const w = parseInt(ext.getAttribute("cx") || "0");
      const h = parseInt(ext.getAttribute("cy") || "0");

      let imgTarget = "unknown";
      const blipFill = getFirstByLocal(pic, "blipFill");
      if (blipFill && relDoc) {
        const blip = getFirstByLocal(blipFill, "blip");
        const embedId = blip?.getAttributeNS(NS.r, "embed") || blip?.getAttribute("r:embed");
        if (embedId && relMap[embedId]) imgTarget = relMap[embedId];
      }

      const ext2 = imgTarget.split(".").pop()?.toLowerCase();
      const isVector = ext2 === "emf" || ext2 === "wmf";
      console.log(`  [PIC] ${isVector ? "VECTOR" : "RASTER"} at (${(x / 914400).toFixed(2)}", ${(y / 914400).toFixed(2)}") size=${(w / 914400).toFixed(2)}"x${(h / 914400).toFixed(2)}" → ${imgTarget}${isVector ? " ⚠ UNSUPPORTED IN BROWSER" : ""}`);
      if (isVector) issues.push(`Slide ${si}: Vector image ${imgTarget} (EMF/WMF not renderable in browser)`);
      totalImageElements++;
      totalElements++;
    }

    for (const gf of graphicFrames) {
      // Check for table
      const tbl = getFirstByLocal(gf, "tbl");
      if (tbl) {
        const rows = getElementsByLocal(tbl, "tr").filter(tr => tr.parentElement === tbl);
        const tblGrid = getFirstByLocal(tbl, "tblGrid");
        const cols = tblGrid ? getElementsByLocal(tblGrid, "gridCol") : [];
        console.log(`  [TBL] ${rows.length} rows x ${cols.length} cols`);

        // Show all rows as sample
        for (let ri = 0; ri < Math.min(rows.length, 3); ri++) {
          const row = rows[ri];
          const cells = getElementsByLocal(row, "tc").filter(tc => tc.parentElement === row);
          const cellTexts = [];
          for (const tc of cells) {
            const txBody = getFirstByLocal(tc, "txBody");
            if (txBody) {
              const texts = [];
              for (const p of getElementsByLocal(txBody, "p")) {
                if (p.parentElement !== txBody) continue;
                for (const r of getElementsByLocal(p, "r")) {
                  const t = getFirstByLocal(r, "t");
                  if (t) texts.push(t.textContent || "");
                }
              }
              cellTexts.push(texts.join("").trim());
            } else {
              cellTexts.push("");
            }
          }
          console.log(`    Row ${ri}: [${cellTexts.join(" | ")}]`);
        }
        if (rows.length > 3) console.log(`    ... and ${rows.length - 3} more rows`);
        totalTableElements++;
      }

      // Check for chart
      const chart = getFirstByLocal(gf, "chart");
      if (chart) {
        console.log(`  [CHART] (embedded chart — not rendered by parser)`);
        issues.push(`Slide ${si}: Embedded chart found — parser does not render charts`);
      }
      totalElements++;
    }

    for (const cxnSp of cxnSps) {
      const spPr = getFirstByLocal(cxnSp, "spPr");
      if (!spPr) continue;
      const xfrm = getFirstByLocal(spPr, "xfrm");
      const off = xfrm ? getFirstByLocal(xfrm, "off") : null;
      const ext = xfrm ? getFirstByLocal(xfrm, "ext") : null;
      if (!off || !ext) continue;

      const x = parseInt(off.getAttribute("x") || "0");
      const y = parseInt(off.getAttribute("y") || "0");
      const w = parseInt(ext.getAttribute("cx") || "0");
      const h = parseInt(ext.getAttribute("cy") || "0");

      const prstGeom = getFirstByLocal(spPr, "prstGeom");
      const shapeType = prstGeom?.getAttribute("prst") || "line";
      console.log(`  [CNX] shape="${shapeType}" at (${(x / 914400).toFixed(2)}", ${(y / 914400).toFixed(2)}") size=${(w / 914400).toFixed(2)}"x${(h / 914400).toFixed(2)}"`);
      totalElements++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Summary`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Slides:        ${slideCount}`);
  console.log(`Elements:      ${totalElements}`);
  console.log(`  Text:        ${totalTextElements} (${totalTextContent} chars)`);
  console.log(`  Images:      ${totalImageElements}`);
  console.log(`  Tables:      ${totalTableElements}`);
  console.log(`Issues found:  ${issues.length}`);

  if (issues.length > 0) {
    console.log(`\n⚠ Issues:`);
    for (const issue of issues) {
      console.log(`  - ${issue}`);
    }
  }

  // Verify images can be extracted
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Image extraction test`);
  console.log(`${"=".repeat(60)}`);

  let imgCount = 0;
  let extractedCount = 0;
  let failedCount = 0;
  const pptMedia = Object.keys(zip.files).filter(f => f.startsWith("ppt/media/"));
  console.log(`Files in ppt/media/: ${pptMedia.length}`);
  for (const f of pptMedia.slice(0, 10)) {
    imgCount++;
    try {
      const data = await readZipBase64(zip, f, getMimeFromExt(f));
      if (data && data.startsWith("data:")) {
        extractedCount++;
        console.log(`  ✓ ${f} → data URL (${(data.length / 1024).toFixed(1)} KB)`);
      } else {
        failedCount++;
        console.log(`  ✗ ${f} → FAILED to extract`);
      }
    } catch (e) {
      failedCount++;
      console.log(`  ✗ ${f} → ERROR: ${e.message}`);
    }
  }
  if (pptMedia.length > 10) console.log(`  ... and ${pptMedia.length - 10} more files`);
  console.log(`Extracted: ${extractedCount}/${imgCount}${failedCount > 0 ? ` (${failedCount} failed)` : ""}`);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Test Complete`);
  console.log(`${"=".repeat(60)}\n`);
}

const filePath = process.argv[2] || "ESP32_Introduction.pptx";
testPptx(filePath).catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
