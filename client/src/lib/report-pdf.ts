import jsPDF from "jspdf";
import type { ReportParams, BodyItem } from "../pages/reports/hooks/useReportEditor";

const FONT = "times";
const FROM_ORG = "CREOLEAP TECHNOLOGIES PVT LTD";
const HEADER_BLUE = [79, 163, 209] as const;
const TITLE_COLOR = [102, 0, 0] as const;
const BLACK = [0, 0, 0] as const;
const WHITE = [255, 255, 255] as const;
const BORDER_GRAY = [153, 153, 153] as const;

// Page dimensions in points (Letter 8.5×11")
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 72; // top/bottom 1440 DXA = 72pt
const LEFT_MARGIN = 72; // DOCX left 1440 DXA = 72pt
// DOCX PAGE_MARGINS = { top: 1440, bottom: 1440, left: 1440, right: 480 }
const CONTENT_W = PAGE_W - 72 - 24; // 516pt (matching DOCX margins exactly)

// DOCX font sizes (half-points → pt): all body text = 24 half-points = 12pt
const BODY_FONT = 12;
// DOCX spacing (twips → pt): 80 twips = 4pt, 300 twips = 15pt
const SPACING_SM = 4; // 80 twips
const SPACING_MD = 6; // 120 twips
const SPACING_LG = 15; // 300 twips
const LINE_HEIGHT = BODY_FONT * (276 / 240); // 12 * 1.15 = 13.8pt

// Table column widths as percentages (matching DOCX fixedWidths)
const COL_PCT = [0.12, 0.08, 0.18, 0.12, 0.50];

// DOCX cell margins: top 40 DXA = 2pt, bottom 40 DXA = 2pt, left 80 DXA = 4pt, right 80 DXA = 4pt
const CELL_PAD_X = 4;
const CELL_PAD_Y = 2;

function ensureSpace(doc: jsPDF, needed: number, y: number): number {
  if (y + needed > PAGE_H - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function drawTable(
  doc: jsPDF,
  columns: string[],
  dataRows: string[][],
  startY: number,
): number {
  const colWidths = COL_PCT.map((w) => w * CONTENT_W);
  const headerHeight = BODY_FONT * 1.15 + CELL_PAD_Y * 2; // ~18.8pt
  let y = startY;

  function ensureSpaceLocal(needed: number) {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  }

  // Header row
  doc.setFont(FONT, "bold");
  doc.setFontSize(BODY_FONT);
  ensureSpaceLocal(headerHeight);

  let x = LEFT_MARGIN;
  for (let i = 0; i < columns.length; i++) {
    doc.setFillColor(...HEADER_BLUE);
    doc.rect(x, y, colWidths[i], headerHeight, "F");
    doc.setDrawColor(...BORDER_GRAY);
    doc.setLineWidth(0.5);
    doc.rect(x, y, colWidths[i], headerHeight, "S");
    doc.setTextColor(...WHITE);
    const textW = doc.getTextWidth(columns[i]);
    doc.text(columns[i], x + (colWidths[i] - textW) / 2, y + CELL_PAD_Y + BODY_FONT * 0.85);
    x += colWidths[i];
  }
  y += headerHeight;

  // Data rows
  doc.setFont(FONT, "normal");
  doc.setFontSize(BODY_FONT);
  doc.setTextColor(...BLACK);

  for (const row of dataRows) {
    let maxLines = 1;
    for (let i = 0; i < Math.min(row.length, colWidths.length); i++) {
      const lines = doc.splitTextToSize(row[i] || "", colWidths[i] - CELL_PAD_X * 2);
      if (lines.length > maxLines) maxLines = lines.length;
    }
    const rowHeight = maxLines * LINE_HEIGHT + CELL_PAD_Y * 2;
    ensureSpaceLocal(rowHeight);

    x = LEFT_MARGIN;
    for (let i = 0; i < Math.min(row.length, colWidths.length); i++) {
      doc.setDrawColor(...BORDER_GRAY);
      doc.setLineWidth(0.5);
      doc.rect(x, y, colWidths[i], rowHeight, "S");

      const cellLines = doc.splitTextToSize(row[i] || "", colWidths[i] - CELL_PAD_X * 2);
      let textY = y + CELL_PAD_Y + BODY_FONT * 0.85;
      for (const line of cellLines) {
        // First 2 columns centered, rest left-aligned (matching DOCX)
        if (i < 2) {
          const tw = doc.getTextWidth(line);
          doc.text(line, x + (colWidths[i] - tw) / 2, textY);
        } else {
          doc.text(line, x + CELL_PAD_X, textY);
        }
        textY += LINE_HEIGHT;
      }
      x += colWidths[i];
    }
    y += rowHeight;
  }

  return y;
}

function parseInlineSegments(text: string): { text: string; bold: boolean }[] {
  // Handle **bold** markdown in plain text
  const segments: { text: string; bold: boolean }[] = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }
  if (segments.length === 0) {
    segments.push({ text, bold: false });
  }
  return segments;
}

function parseHtmlInlineSegments(html: string): { text: string; bold: boolean; italic: boolean; strike: boolean }[] {
  const segments: { text: string; bold: boolean; italic: boolean; strike: boolean }[] = [];
  const parts = html.split(/(<[^>]+>)/);
  let inBold = false;
  let inItalic = false;
  let inStrike = false;

  for (const part of parts) {
    if (part === "<strong>" || part === "<b>") { inBold = true; continue; }
    if (part === "</strong>" || part === "</b>") { inBold = false; continue; }
    if (part === "<em>" || part === "<i>") { inItalic = true; continue; }
    if (part === "</em>" || part === "</i>") { inItalic = false; continue; }
    if (part === "<s>" || part === "<strike>" || part === "<del>") { inStrike = true; continue; }
    if (part === "</s>" || part === "</strike>" || part === "</del>") { inStrike = false; continue; }
    if (part.startsWith("<")) continue;
    if (!part) continue;
    const decoded = part
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"');
    if (decoded) segments.push({ text: decoded, bold: inBold, italic: inItalic, strike: inStrike });
  }

  if (segments.length === 0) {
    const plain = html.replace(/<[^>]+>/g, "").trim();
    if (plain) segments.push({ text: plain, bold: false, italic: false, strike: false });
  }
  return segments;
}

function drawMixedText(
  doc: jsPDF,
  segments: { text: string; bold: boolean }[],
  x: number,
  y: number,
  maxWidth: number,
): number {
  // Draw a line of mixed bold/normal text, wrapping across lines
  let currentX = x;
  let currentY = y;

  for (const seg of segments) {
    if (!seg.text) continue;
    doc.setFont(FONT, seg.bold ? "bold" : "normal");
    doc.setFontSize(BODY_FONT);
    doc.setTextColor(...BLACK);

    const words = seg.text.split(/(\s+)/);
    for (const word of words) {
      if (!word) continue;
      const wordW = doc.getTextWidth(word);
      const remaining = maxWidth - (currentX - x);

      if (wordW > remaining && currentX > x) {
        // Wrap to next line
        currentX = x;
        currentY += LINE_HEIGHT;
        if (currentY + LINE_HEIGHT > PAGE_H - MARGIN) {
          doc.addPage();
          currentY = MARGIN;
        }
        // Skip leading whitespace on new line
        if (/^\s+$/.test(word)) continue;
      }

      if (currentY + LINE_HEIGHT > PAGE_H - MARGIN) {
        doc.addPage();
        currentY = MARGIN;
      }

      doc.text(word, currentX, currentY);
      currentX += wordW;
    }
  }

  return currentY + LINE_HEIGHT;
}

function drawHtmlParagraph(
  doc: jsPDF,
  html: string,
  y: number,
  indent: number = 0,
): number {
  const segments = parseHtmlInlineSegments(html);
  let currentX = LEFT_MARGIN + indent;
  const maxWidth = CONTENT_W - indent;
  let currentY = y;

  for (const seg of segments) {
    if (!seg.text) continue;
    const fontStyle = seg.bold ? "bold" : "normal";
    doc.setFont(FONT, fontStyle);
    doc.setFontSize(BODY_FONT);
    doc.setTextColor(...BLACK);

    const words = seg.text.split(/(\s+)/);
    for (const word of words) {
      if (!word) continue;
      const wordW = doc.getTextWidth(word);
      const remaining = maxWidth - (currentX - LEFT_MARGIN - indent);

      if (wordW > remaining && currentX > LEFT_MARGIN + indent) {
        currentX = LEFT_MARGIN + indent;
        currentY += LINE_HEIGHT;
        if (currentY + LINE_HEIGHT > PAGE_H - MARGIN) {
          doc.addPage();
          currentY = MARGIN;
        }
        if (/^\s+$/.test(word)) continue;
      }

      if (currentY + LINE_HEIGHT > PAGE_H - MARGIN) {
        doc.addPage();
        currentY = MARGIN;
      }

      doc.text(word, currentX, currentY);
      currentX += wordW;
    }
  }

  return currentY + LINE_HEIGHT;
}

function renderBodyItem(doc: jsPDF, item: BodyItem, y: number): number {
  if (item.kind === "table" && item.table) {
    // Table title — DOCX: HEADING_1, bold, size 24 half-points = 12pt, spacing after 300 twips = 15pt
    doc.setFont(FONT, "bold");
    doc.setFontSize(BODY_FONT);
    doc.setTextColor(...BLACK);
    if (y + BODY_FONT > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; }
    doc.text(item.table.title, LEFT_MARGIN, y);
    y += BODY_FONT * 1.15 + SPACING_LG; // title line + 15pt after

    y = drawTable(doc, item.table.columns, item.table.rows, y);
    y += SPACING_SM; // small gap after table
    return y;
  }

  if (item.kind === "content" && item.content) {
    const text = item.content.text;

    if (item.content.type === "heading") {
      // DOCX: HEADING_2, bold, size 24 half-points = 12pt, spacing before 300 twips = 15pt, after 120 twips = 6pt
      if (y + BODY_FONT + SPACING_LG > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; }
      y += SPACING_LG; // 15pt before
      doc.setFont(FONT, "bold");
      doc.setFontSize(BODY_FONT);
      doc.setTextColor(...BLACK);
      doc.text(text, LEFT_MARGIN, y);
      y += BODY_FONT * 1.15 + SPACING_MD; // line + 6pt after
      return y;
    }

    // Paragraph content
    const isHtml = text.startsWith("<");

    if (isHtml) {
      const ulMatch = text.match(/^<ul>(.*)<\/ul>$/s);
      const olMatch = text.match(/^<ol>(.*)<\/ol>$/s);

      if (ulMatch || olMatch) {
        const listHtml = ulMatch ? ulMatch[1] : olMatch![1];
        const liItems = listHtml.match(/<li>(.*?)<\/li>/gs) || [];
        let bulletNum = 1;
        for (let idx = 0; idx < liItems.length; idx++) {
          const inner = liItems[idx].replace(/^<li>/, "").replace(/<\/li>$/, "");
          const prefix = olMatch ? `${bulletNum}. ` : "\u2022 ";
          const liIndent = 12;

          if (idx === 0) y += SPACING_SM; // 4pt before first item
          y = drawHtmlParagraph(doc, prefix + inner, y, liIndent);
          y += SPACING_SM * 0.5; // 2pt between items
          if (olMatch) bulletNum++;
        }
        y += SPACING_SM; // 4pt after last item
      } else {
        // Split by </p><p> or render as one
        const pContents = text.match(/<p>(.*?)<\/p>/gs) || [text];
        for (let pi = 0; pi < pContents.length; pi++) {
          const inner = pContents[pi].replace(/^<p>/, "").replace(/<\/p>$/, "");
          if (pi === 0) y += SPACING_SM; // 4pt before first paragraph
          y = drawHtmlParagraph(doc, inner, y);
          y += SPACING_SM; // 4pt after each paragraph
        }
      }
    } else {
      // Legacy plain text
      const isBold = !!item.content.bold;
      const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const lines = normalized.split("\n").filter((l) => l.trim());
      const isList = item.content.format === "bullet" || item.content.format === "number";

      if (isList && lines.length > 0) {
        let bulletNum = 1;
        for (let idx = 0; idx < lines.length; idx++) {
          let itemText = lines[idx].trim();
          if (item.content.format === "bullet") {
            itemText = itemText.replace(/^[•●◦▪➢►‣⁃\-*]\s*/, "");
          } else if (item.content.format === "number") {
            itemText = itemText.replace(/^\d+[.)]\s*/, "");
          }
          const prefix = item.content.format === "number" ? `${bulletNum}. ` : "\u2022 ";
          const liIndent = 12;
          const segments = parseInlineSegments(prefix + itemText);

          if (idx === 0) y += SPACING_SM;
          // Override bold for each segment if item is bold
          const finalSegments = isBold
            ? segments.map((s) => ({ text: s.text, bold: true }))
            : segments;
          y = drawMixedText(doc, finalSegments, LEFT_MARGIN + liIndent, y, CONTENT_W - liIndent);
          y += SPACING_SM * 0.5;
          if (item.content.format === "number") bulletNum++;
        }
        y += SPACING_SM;
      } else {
        const segments = parseInlineSegments(text);
        const finalSegments = isBold
          ? segments.map((s) => ({ text: s.text, bold: true }))
          : segments;
        if (y + LINE_HEIGHT > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; }
        y += SPACING_SM;
        y = drawMixedText(doc, finalSegments, LEFT_MARGIN, y, CONTENT_W);
        y += SPACING_SM;
      }
    }
  }

  return y;
}

export async function generateReportPdf(
  params: ReportParams,
  signatureUrl?: string | null,
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  doc.setFont(FONT, "normal");

  // ═══════════════════════════════════════════
  // COVER PAGE (DOCX Section 1)
  // ═══════════════════════════════════════════
  let y = MARGIN;

  // 4 blank paragraphs — DOCX: spacing after 200 twips = 10pt each
  y += 10 * 4;

  // Title — DOCX: bold, size 56 half-points = 28pt, centered
  doc.setFont(FONT, "bold");
  doc.setFontSize(28);
  doc.setTextColor(...BLACK);
  const titleText = "Monthly Lesson Completion Report";
  const titleW = doc.getTextWidth(titleText);
  doc.text(titleText, LEFT_MARGIN + (CONTENT_W - titleW) / 2, y);
  y += 28 * 1.15 + 4; // line + 80 twips = 4pt after

  // Month/Year — DOCX: bold, size 142 half-points = 71pt, color #660000, centered
  doc.setFontSize(71);
  doc.setTextColor(...TITLE_COLOR);
  const monthText = `${params.monthName} ${params.year}`;
  const monthW = doc.getTextWidth(monthText);
  doc.text(monthText, LEFT_MARGIN + (CONTENT_W - monthW) / 2, y);
  y += 71 * 1.15 + 20; // line + 400 twips ≈ 20pt

  // From: label — DOCX: bold, size 24 half-points = 12pt
  doc.setFontSize(BODY_FONT);
  doc.setTextColor(...BLACK);
  doc.setFont(FONT, "bold");
  doc.text("From: ", LEFT_MARGIN, y);
  doc.setFont(FONT, "bold");
  doc.text(FROM_ORG, LEFT_MARGIN + doc.getTextWidth("From: "), y);
  y += BODY_FONT * 1.15 + SPACING_SM; // line + 80 twips = 4pt

  // Month: label
  doc.setFont(FONT, "bold");
  doc.text("Month: ", LEFT_MARGIN, y);
  doc.setFont(FONT, "normal");
  doc.text(`${params.monthName} ${params.year}`, LEFT_MARGIN + doc.getTextWidth("Month: "), y);
  y += BODY_FONT * 1.15 + SPACING_SM;

  // Submitted by: label
  doc.setFont(FONT, "bold");
  doc.text("Submitted by: ", LEFT_MARGIN, y);
  doc.setFont(FONT, "normal");
  doc.text(params.staffNames[0] || "", LEFT_MARGIN + doc.getTextWidth("Submitted by: "), y);
  y += BODY_FONT * 1.15 + SPACING_SM * 0.5;

  // Additional staff names — DOCX: indent left 1800 DXA = 90pt
  for (const name of params.staffNames.slice(1)) {
    doc.text(name, LEFT_MARGIN + 90, y);
    y += BODY_FONT * 1.15 + SPACING_SM * 0.5;
  }

  // Spacer — DOCX: spacing after 400 twips = 20pt
  y += 20;

  // School Information heading — DOCX: bold, size 24 half-points = 12pt
  doc.setFont(FONT, "bold");
  doc.setFontSize(BODY_FONT);
  doc.text("School Information", LEFT_MARGIN, y);
  y += BODY_FONT * 1.15 + SPACING_MD; // line + 120 twips = 6pt

  // School info rows
  const infoRows = [
    { label: "School Name", value: params.schoolName, boldVal: true },
    { label: "Class/Grade", value: params.classesLabel, boldVal: false },
    { label: "Subject/Program", value: params.subjectLabel, boldVal: false },
    { label: "No. of Sessions/Periods Planned", value: String(params.sessionsPlanned), boldVal: false },
    { label: "No. of Sessions/Periods Completed", value: String(params.sessionsCompleted), boldVal: false },
  ];

  for (const row of infoRows) {
    doc.setFontSize(BODY_FONT);
    doc.setFont(FONT, "bold");
    doc.text(`${row.label}: `, LEFT_MARGIN, y);
    doc.setFont(FONT, row.boldVal ? "bold" : "normal");
    doc.text(row.value, LEFT_MARGIN + doc.getTextWidth(`${row.label}: `), y);
    y += BODY_FONT * 1.15 + SPACING_SM;
  }

  // ═══════════════════════════════════════════
  // CONTENT PAGES (DOCX Section 2)
  // ═══════════════════════════════════════════
  doc.addPage();
  y = MARGIN;

  // Session Summary heading — DOCX: HEADING_1, bold, size 24 half-points = 12pt
  doc.setFont(FONT, "bold");
  doc.setFontSize(BODY_FONT);
  doc.setTextColor(...BLACK);
  doc.text("Session Summary", LEFT_MARGIN, y);
  y += BODY_FONT * 1.15 + SPACING_LG; // line + 300 twips = 15pt

  // Session table
  const sessionColumns = params.sessionColumns?.length === 5
    ? params.sessionColumns
    : ["Date", "Class", "Chapter", "Topic", "Remarks"];
  y = drawTable(doc, sessionColumns, params.rows.map((r) => {
    const classSection = r.section ? `${r.className}${r.section}` : r.className;
    return [r.date, classSection, r.chapterName, r.topicName, r.remarks];
  }), y);
  y += SPACING_SM;

  // Body items
  if (params.bodyItems && params.bodyItems.length > 0) {
    for (const item of params.bodyItems) {
      y = renderBodyItem(doc, item, y);
    }
  }

  // ═══════════════════════════════════════════
  // SIGNATURE SECTION
  // ═══════════════════════════════════════════
  y += SPACING_SM;
  ensureSpace(doc, 120, y);

  // Submitted on — DOCX: bold, size 24 half-points = 12pt
  doc.setFont(FONT, "bold");
  doc.setFontSize(BODY_FONT);
  doc.setTextColor(...BLACK);
  doc.text(`Submitted on: ${params.submittedOn || ""}`, LEFT_MARGIN, y);
  y += BODY_FONT * 1.15 + 20;

  // Signature image (right-aligned, above labels)
  const halfContentW = CONTENT_W / 2;
  if (signatureUrl) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const dataUrl = canvas.toDataURL("image/png");
              // DOCX signature image: width 270, height 90 (in points)
              doc.addImage(dataUrl, "PNG", LEFT_MARGIN + halfContentW + 40, y, 200, 67);
            }
          } catch { /* signature render failed */ }
          resolve();
        };
        img.onerror = () => resolve();
        img.src = signatureUrl;
      });
    } catch { /* signature load failed */ }
  }

  // Signature labels
  const sigLabelY = y + 80;
  doc.setFont(FONT, "normal");
  doc.setFontSize(BODY_FONT);
  doc.setTextColor(...BLACK);
  doc.text("Principal's Signature", LEFT_MARGIN, sigLabelY);
  doc.text("Trainer's Signature", LEFT_MARGIN + halfContentW + 40, sigLabelY);

  // ═══════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════
  doc.save(`Monthly_Report_${params.monthName}_${params.year}.pdf`);
}
