import { createRequire } from "module";
const require = createRequire(import.meta.url);
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

async function readZipText(zip, path) {
  const file = zip.file(path);
  if (!file) return null;
  return file.async("text");
}

function parseColor(el, themeColors) {
  if (!el) return undefined;
  const srgb = getFirstByLocal(el, "srgbClr");
  if (srgb) return "#" + (srgb.getAttribute("val") || "000000");
  const scheme = getFirstByLocal(el, "schemeClr");
  if (scheme) {
    const mapped = themeColors.get(scheme.getAttribute("val") || "");
    if (mapped) return mapped;
  }
  const prstClr = getFirstByLocal(el, "prstClr");
  if (prstClr) {
    const map = { black: "#000000", white: "#FFFFFF", red: "#FF0000", green: "#00FF00", blue: "#0000FF" };
    return map[prstClr.getAttribute("val") || ""] || "#000000";
  }
  return undefined;
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
  return colors;
}

async function testPptx(filePath) {
  console.log(`\n=== PPTX Parser Test ===`);
  console.log(`File: ${filePath}`);

  const buffer = readFileSync(filePath);
  console.log(`File size: ${(buffer.length / 1024).toFixed(1)} KB`);

  const startTime = performance.now();
  const zip = await JSZip.loadAsync(buffer);

  const themeXml = await readZipText(zip, "ppt/theme/theme1.xml");
  const themeColors = themeXml ? parseThemeColors(themeXml) : new Map();
  console.log(`Theme colors: ${themeColors.size}`);

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
  console.log(`\nParse time: ${elapsed.toFixed(1)}ms`);
  console.log(`Slide dimensions: ${(slideWidth / 914400).toFixed(2)}" x ${(slideHeight / 914400).toFixed(2)}"`);
  console.log(`Total slides: ${slideCount}`);

  for (let si = 1; si <= slideCount; si++) {
    const slidePath = `ppt/slides/slide${si}.xml`;
    const relsPath = `ppt/slides/_rels/slide${si}.xml.rels`;
    const slideXml = await readZipText(zip, slidePath);
    if (!slideXml) continue;

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

    console.log(`\n--- Slide ${si} ---`);
    console.log(`  Shapes: ${sps.length}, Pictures: ${pics.length}, Tables: ${graphicFrames.length}`);

    // Check background
    const cSld = getFirstByLocal(doc, "cSld");
    const bgEl = cSld ? getFirstByLocal(cSld, "bg") : null;
    if (bgEl) {
      const bgPr = getFirstByLocal(bgEl, "bgPr");
      if (bgPr) {
        const solidFill = getFirstByLocal(bgPr, "solidFill");
        if (solidFill) {
          const color = parseColor(solidFill, themeColors);
          console.log(`  Background: solid ${color}`);
        }
        const blipFill = getFirstByLocal(bgPr, "blipFill");
        if (blipFill) console.log(`  Background: image`);
      }
    }

    let elemIdx = 0;
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

      // Check for image fill in spPr
      const blipFillSpPr = getFirstByLocal(spPr, "blipFill");
      if (blipFillSpPr) {
        const blip = getFirstByLocal(blipFillSpPr, "blip");
        const embedId = blip?.getAttributeNS(NS.r, "embed") || blip?.getAttribute("r:embed");
        if (embedId && relMap[embedId]) {
          console.log(`    [${elemIdx}] IMAGE at (${(x / 914400).toFixed(2)}", ${(y / 914400).toFixed(2)}") size=${(w / 914400).toFixed(2)}"x${(h / 914400).toFixed(2)}" → ${relMap[embedId]}`);
          elemIdx++;
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
            const tEl = getFirstByLocal(r, "t");
            if (tEl) runs.push(tEl.textContent || "");
          }
          const text = runs.join("").trim();
          if (text) paragraphs.push(text);
        }
      }

      const prstGeom = getFirstByLocal(spPr, "prstGeom");
      const shapeType = prstGeom?.getAttribute("prst") || "rect";

      if (paragraphs.length > 0) {
        console.log(`    [${elemIdx}] TEXT shape="${shapeType}" at (${(x / 914400).toFixed(2)}", ${(y / 914400).toFixed(2)}") size=${(w / 914400).toFixed(2)}"x${(h / 914400).toFixed(2)}"`);
        for (const text of paragraphs) {
          console.log(`      "${text.substring(0, 100)}${text.length > 100 ? "..." : ""}"`);
        }
      } else {
        // Check fill for shape color info
        const solidFill = getFirstByLocal(spPr, "solidFill");
        const fillInfo = solidFill ? ` fill=${parseColor(solidFill, themeColors) || "?"}` : "";
        const ln = getFirstByLocal(spPr, "ln");
        const lnInfo = ln ? ` outline` : "";
        console.log(`    [${elemIdx}] SHAPE shape="${shapeType}" at (${(x / 914400).toFixed(2)}", ${(y / 914400).toFixed(2)}") size=${(w / 914400).toFixed(2)}"x${(h / 914400).toFixed(2)}"${fillInfo}${lnInfo}`);
      }
      elemIdx++;
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

      const blipFill = getFirstByLocal(pic, "blipFill");
      let imgTarget = "unknown";
      if (blipFill && relDoc) {
        const blip = getFirstByLocal(blipFill, "blip");
        const embedId = blip?.getAttributeNS(NS.r, "embed") || blip?.getAttribute("r:embed");
        if (embedId && relMap[embedId]) imgTarget = relMap[embedId];
      }
      console.log(`    [${elemIdx}] PICTURE at (${(x / 914400).toFixed(2)}", ${(y / 914400).toFixed(2)}") size=${(w / 914400).toFixed(2)}"x${(h / 914400).toFixed(2)}" → ${imgTarget}`);
      elemIdx++;
    }

    for (const gf of graphicFrames) {
      const tbl = getFirstByLocal(gf, "tbl");
      if (!tbl) continue;
      const rows = getElementsByLocal(tbl, "tr").filter(tr => tr.parentElement === tbl);
      const tblGrid = getFirstByLocal(tbl, "tblGrid");
      const cols = tblGrid ? getElementsByLocal(tblGrid, "gridCol") : [];
      console.log(`    [${elemIdx}] TABLE ${rows.length} rows x ${cols.length} cols`);
      
      // Show first row content as sample
      if (rows.length > 0) {
        const firstRowCells = getElementsByLocal(rows[0], "tc").filter(tc => tc.parentElement === rows[0]);
        const cellTexts = [];
        for (const tc of firstRowCells) {
          const txBody = getFirstByLocal(tc, "txBody");
          if (txBody) {
            const texts = [];
            for (const r of getElementsByLocal(txBody, "r")) {
              const t = getFirstByLocal(r, "t");
              if (t) texts.push(t.textContent || "");
            }
            cellTexts.push(texts.join("").trim());
          }
        }
        console.log(`      Header: [${cellTexts.join(" | ")}]`);
      }
      elemIdx++;
    }
  }

  console.log("\n=== Test Complete ===\n");
}

const filePath = process.argv[2] || "ESP32_Introduction.pptx";
testPptx(filePath).catch(console.error);
