import jsPDF from "jspdf";
import type { ReportParams, BodyItem } from "../pages/reports/hooks/useReportEditor";

const FONT = "times";
const FROM_ORG = "CREOLEAP TECHNOLOGIES PVT LTD";
const HEADER_BLUE = [79, 163, 209] as const;
const TITLE_COLOR = [102, 0, 0] as const;
const BLACK = [0, 0, 0] as const;
const WHITE = [255, 255, 255] as const;
const BORDER_GRAY = [153, 153, 153] as const;

const PAGE_W = 612; // 8.5in in points
const PAGE_H = 792; // 11in in points
const MARGIN = 72; // 1in in points
const LEFT_MARGIN = 86.25; // 115px * 72/96
const RIGHT_MARGIN = 24; // 32px * 72/96
const CONTENT_W = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN; // ~501.75pt
const COL_W = [0.12, 0.08, 0.18, 0.12, 0.50]; // Date, Class, Chapter, Topic, Remarks

function pt(fontSize: number): number {
  return fontSize;
}

function drawTable(
  doc: jsPDF,
  columns: string[],
  dataRows: string[][],
  startY: number,
): number {
  const colWidths = COL_W.map((w) => w * CONTENT_W);
  const cellPadX = 5;
  const cellPadY = 4;
  const headerFontSize = 10;
  const bodyFontSize = 9;
  const rowLineHeight = bodyFontSize * 1.15;

  let y = startY;

  function ensureSpace(needed: number) {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  }

  // Header row
  doc.setFont(FONT, "bold");
  doc.setFontSize(headerFontSize);
  const headerHeight = headerFontSize * 1.15 + cellPadY * 2;
  ensureSpace(headerHeight);

  let x = LEFT_MARGIN;
  for (let i = 0; i < columns.length; i++) {
    doc.setFillColor(...HEADER_BLUE);
    doc.rect(x, y, colWidths[i], headerHeight, "F");
    doc.setDrawColor(...BORDER_GRAY);
    doc.setLineWidth(0.5);
    doc.rect(x, y, colWidths[i], headerHeight, "S");
    doc.setTextColor(...WHITE);
    doc.text(columns[i], x + cellPadX, y + cellPadY + headerFontSize * 0.85);
    x += colWidths[i];
  }
  y += headerHeight;

  // Data rows
  doc.setFont(FONT, "normal");
  doc.setFontSize(bodyFontSize);
  doc.setTextColor(...BLACK);

  for (const row of dataRows) {
    // Calculate row height based on tallest cell
    let maxLines = 1;
    for (let i = 0; i < row.length; i++) {
      const w = colWidths[i] - cellPadX * 2;
      const lines = doc.splitTextToSize(row[i] || "", w);
      if (lines.length > maxLines) maxLines = lines.length;
    }
    const rowHeight = maxLines * rowLineHeight + cellPadY * 2;
    ensureSpace(rowHeight);

    x = LEFT_MARGIN;
    for (let i = 0; i < row.length; i++) {
      doc.setDrawColor(...BORDER_GRAY);
      doc.setLineWidth(0.5);
      doc.rect(x, y, colWidths[i], rowHeight, "S");

      const cellLines = doc.splitTextToSize(row[i] || "", colWidths[i] - cellPadX * 2);
      let textY = y + cellPadY + bodyFontSize * 0.85;
      for (const line of cellLines) {
        doc.text(line, x + cellPadX, textY);
        textY += rowLineHeight;
      }
      x += colWidths[i];
    }
    y += rowHeight;
  }

  return y;
}

function drawSessionTable(
  doc: jsPDF,
  rows: ReportParams["rows"],
  columns: string[],
  startY: number,
): number {
  const dataRows = rows.map((r) => {
    const classSection = r.section ? `${r.className}${r.section}` : r.className;
    return [r.date, classSection, r.chapterName, r.topicName, r.remarks];
  });
  return drawTable(doc, columns, dataRows, startY);
}

function parseHtmlText(html: string): { text: string; bold: boolean }[] {
  const segments: { text: string; bold: boolean }[] = [];
  const parts = html.split(/(<[^>]+>)/);
  let inBold = false;

  for (const part of parts) {
    if (part === "<strong>" || part === "<b>") { inBold = true; continue; }
    if (part === "</strong>" || part === "</b>") { inBold = false; continue; }
    if (part.startsWith("<")) continue;
    if (!part) continue;
    const decoded = part
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"');
    if (decoded) segments.push({ text: decoded, bold: inBold });
  }

  if (segments.length === 0) {
    const plain = html.replace(/<[^>]+>/g, "").trim();
    if (plain) segments.push({ text: plain, bold: false });
  }
  return segments;
}

function renderBodyItem(
  doc: jsPDF,
  item: BodyItem,
  y: number,
): number {
  if (item.kind === "table" && item.table) {
    // Table title
    doc.setFont(FONT, "bold");
    doc.setFontSize(pt(16));
    doc.setTextColor(...BLACK);
    if (y + 30 > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; }
    doc.text(item.table.title, LEFT_MARGIN, y);
    y += 24;

    y = drawTable(doc, item.table.columns, item.table.rows, y);
    y += 8;
    return y;
  }

  if (item.kind === "content" && item.content) {
    const text = item.content.text;

    if (item.content.type === "heading") {
      if (y + 30 > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; }
      y += 10;
      doc.setFont(FONT, "bold");
      doc.setFontSize(pt(16));
      doc.setTextColor(...BLACK);
      doc.text(text, LEFT_MARGIN, y);
      y += 18;
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
        for (const li of liItems) {
          const inner = li.replace(/^<li>/, "").replace(/<\/li>$/, "");
          const segments = parseHtmlText(inner);
          const fullText = segments.map((s) => s.text).join("");
          const prefix = olMatch ? `${bulletNum}. ` : "\u2022 ";
          const wrapped = doc.splitTextToSize(prefix + fullText, CONTENT_W - 12);

          ensureSpace(doc, wrapped.length * pt(12) * 1.15 + 4, y);
          doc.setFont(FONT, "normal");
          doc.setFontSize(pt(12));
          doc.setTextColor(...BLACK);

          let lineY = y;
          for (const line of wrapped) {
            doc.text(line, LEFT_MARGIN + 12, lineY);
            lineY += pt(12) * 1.15;
          }
          y = lineY;
          if (olMatch) bulletNum++;
        }
        y += 4;
      } else {
        const pContents = text.match(/<p>(.*?)<\/p>/gs) || [text];
        for (const p of pContents) {
          const inner = p.replace(/^<p>/, "").replace(/<\/p>$/, "");
          const segments = parseHtmlText(inner);
          // For now, join and draw as plain text (bold segments handled below)
          const fullText = segments.map((s) => s.text).join("");
          const wrapped = doc.splitTextToSize(fullText, CONTENT_W);

          ensureSpace(doc, wrapped.length * pt(12) * 1.15 + 4, y);
          doc.setFont(FONT, "normal");
          doc.setFontSize(pt(12));
          doc.setTextColor(...BLACK);

          for (const line of wrapped) {
            if (y + pt(12) * 1.15 > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; }
            doc.text(line, LEFT_MARGIN, y);
            y += pt(12) * 1.15;
          }
          y += 4;
        }
      }
    } else {
      // Legacy plain text with optional bold
      const isBold = !!item.content.bold;
      const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const lines = normalized.split("\n").filter((l) => l.trim());
      const isList = item.content.format === "bullet" || item.content.format === "number";

      if (isList && lines.length > 0) {
        let bulletNum = 1;
        for (const line of lines) {
          let itemText = line.trim();
          if (item.content.format === "bullet") {
            itemText = itemText.replace(/^[•●◦▪➢►‣⁃\-*]\s*/, "");
          } else if (item.content.format === "number") {
            itemText = itemText.replace(/^\d+[.)]\s*/, "");
          }
          const prefix = item.content.format === "number" ? `${bulletNum}. ` : "\u2022 ";
          const style: "normal" | "bold" = isBold ? "bold" : "normal";
          const wrapped = doc.splitTextToSize(prefix + itemText, CONTENT_W - 12);

          ensureSpace(doc, wrapped.length * pt(12) * 1.15 + 4, y);
          doc.setFont(FONT, style === "bold" ? "bold" : "normal");
          doc.setFontSize(pt(12));
          doc.setTextColor(...BLACK);

          for (const wLine of wrapped) {
            if (y + pt(12) * 1.15 > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; }
            doc.text(wLine, LEFT_MARGIN + 12, y);
            y += pt(12) * 1.15;
          }
          y += 4;
          if (item.content.format === "number") bulletNum++;
        }
      } else {
        const wrapped = doc.splitTextToSize(text, CONTENT_W);
        ensureSpace(doc, wrapped.length * pt(12) * 1.15 + 4, y);
        doc.setFont(FONT, isBold ? "bold" : "normal");
        doc.setFontSize(pt(12));
        doc.setTextColor(...BLACK);

        for (const line of wrapped) {
          if (y + pt(12) * 1.15 > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; }
          doc.text(line, LEFT_MARGIN, y);
          y += pt(12) * 1.15;
        }
        y += 4;
      }
    }
  }

  return y;
}

function ensureSpace(doc: jsPDF, needed: number, y: number): number {
  if (y + needed > PAGE_H - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

export async function generateReportPdf(
  params: ReportParams,
  signatureUrl?: string | null,
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  doc.setFont(FONT, "normal");

  // ─── Cover Page ───
  let y = MARGIN + 12;

  // 4 blank lines
  y += 12 * 4 * 1.15;

  // Title
  doc.setFont(FONT, "bold");
  doc.setFontSize(pt(28));
  doc.setTextColor(...BLACK);
  const titleLines = doc.splitTextToSize("Monthly Lesson Completion Report", CONTENT_W);
  for (const line of titleLines) {
    const tw = doc.getTextWidth(line);
    doc.text(line, LEFT_MARGIN + (CONTENT_W - tw) / 2, y);
    y += pt(28) * 1.15;
  }
  y += 8;

  // Month/Year
  doc.setFontSize(pt(71));
  doc.setTextColor(...TITLE_COLOR);
  const monthText = `${params.monthName} ${params.year}`;
  const mw = doc.getTextWidth(monthText);
  doc.text(monthText, LEFT_MARGIN + (CONTENT_W - mw) / 2, y);
  y += pt(71) * 1.15 + 20;

  // From
  doc.setFontSize(pt(12));
  doc.setTextColor(...BLACK);
  doc.setFont(FONT, "bold");
  doc.text("From: ", LEFT_MARGIN, y);
  doc.setFont(FONT, "bold");
  doc.text(FROM_ORG, LEFT_MARGIN + doc.getTextWidth("From: "), y);
  y += pt(12) * 1.15 + 8;

  // Month
  doc.setFont(FONT, "bold");
  doc.text("Month: ", LEFT_MARGIN, y);
  doc.setFont(FONT, "normal");
  doc.text(`${params.monthName} ${params.year}`, LEFT_MARGIN + doc.getTextWidth("Month: "), y);
  y += pt(12) * 1.15 + 8;

  // Submitted by
  doc.setFont(FONT, "bold");
  doc.text("Submitted by: ", LEFT_MARGIN, y);
  doc.setFont(FONT, "normal");
  doc.text(params.staffNames[0] || "", LEFT_MARGIN + doc.getTextWidth("Submitted by: "), y);
  y += pt(12) * 1.15 + 4;

  // Additional staff
  for (const name of params.staffNames.slice(1)) {
    doc.text(name, LEFT_MARGIN + 24, y);
    y += pt(12) * 1.15 + 4;
  }
  y += 20;

  // School Information heading
  doc.setFont(FONT, "bold");
  doc.setFontSize(pt(16));
  doc.text("School Information", LEFT_MARGIN, y);
  y += pt(16) * 1.15 + 8;

  // School info rows
  const infoRows = [
    { label: "School Name", value: params.schoolName, boldVal: true },
    { label: "Class/Grade", value: params.classesLabel, boldVal: false },
    { label: "Subject/Program", value: params.subjectLabel, boldVal: false },
    { label: "No. of Sessions/Periods Planned", value: String(params.sessionsPlanned), boldVal: false },
    { label: "No. of Sessions/Periods Completed", value: String(params.sessionsCompleted), boldVal: false },
  ];

  for (const row of infoRows) {
    doc.setFontSize(pt(12));
    doc.setFont(FONT, "bold");
    doc.text(`${row.label}: `, LEFT_MARGIN, y);
    doc.setFont(FONT, row.boldVal ? "bold" : "normal");
    doc.text(row.value, LEFT_MARGIN + doc.getTextWidth(`${row.label}: `), y);
    y += pt(12) * 1.15 + 8;
  }

  // ─── Content Page(s) ───
  doc.addPage();
  y = MARGIN;

  // Session Summary heading
  doc.setFont(FONT, "bold");
  doc.setFontSize(pt(16));
  doc.setTextColor(...BLACK);
  doc.text("Session Summary", LEFT_MARGIN, y);
  y += pt(16) * 1.15 + 8;

  // Session table
  const sessionColumns = params.sessionColumns?.length === 5
    ? params.sessionColumns
    : ["Date", "Class", "Chapter", "Topic", "Remarks"];
  y = drawSessionTable(doc, params.rows, sessionColumns, y);
  y += 12;

  // Body items
  if (params.bodyItems && params.bodyItems.length > 0) {
    for (const item of params.bodyItems) {
      y = renderBodyItem(doc, item, y);
    }
  }

  // ─── Signature Section ───
  y += 12;
  ensureSpace(doc, 100, y);

  // Submitted on
  doc.setFont(FONT, "bold");
  doc.setFontSize(pt(12));
  doc.setTextColor(...BLACK);
  doc.text(`Submitted on: ${params.submittedOn || ""}`, LEFT_MARGIN, y);
  y += pt(12) * 1.15 + 20;

  // Signature labels + image
  const sigLabelY = y + 50;

  // Principal signature label
  doc.setFont(FONT, "normal");
  doc.setFontSize(pt(12));
  doc.text("Principal's Signature", LEFT_MARGIN, sigLabelY);

  // Trainer signature label
  const trainerX = LEFT_MARGIN + CONTENT_W / 2;
  doc.text("Trainer's Signature", trainerX + 40, sigLabelY);

  // Try to draw signature image
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
              const sigW = 180;
              const sigH = 60;
              doc.addImage(dataUrl, "PNG", trainerX + 40, y, sigW, sigH);
            }
          } catch { /* signature render failed */ }
          resolve();
        };
        img.onerror = () => resolve();
        img.src = signatureUrl;
      });
    } catch { /* signature load failed */ }
  }

  // ─── Blue stripe + logo on every page ───
  // (We skip images since we don't have them as data URLs in this context)

  // Save
  doc.save(`Monthly_Report_${params.monthName}_${params.year}.pdf`);
}
