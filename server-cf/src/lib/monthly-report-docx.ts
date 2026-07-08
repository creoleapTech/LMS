import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ShadingType,
  VerticalAlign,
  BorderStyle,
  HeadingLevel,
  TableLayoutType,
  ImageRun,
  Header,
  PageOrientation,
  SectionType,
} from "docx";

// Assets are imported as static modules (bundled by wrangler)
import blueStripePng from "../assets/monthly-report-design.jpeg";
import logoPng from "../assets/creoleap-logo-final.png";

export interface ReportRow {
  date: string;
  className: string;
  section: string;
  chapterName: string;
  topicName: string;
  remarks: string;
}

export interface ReportTable {
  title: string;
  columns: string[];
  rows: string[][];
}

export interface ContentBlock {
  type: "heading" | "paragraph";
  text: string;
  format?: "plain" | "bullet" | "number";
  bold?: boolean;
}

export type BodyItem =
  | { kind: "table"; table: ReportTable; keepOnSamePage?: boolean }
  | { kind: "content"; content: ContentBlock; keepOnSamePage?: boolean };

export interface ReportParams {
  monthName: string;
  year: number;
  staffNames: string[];
  schoolName: string;
  classesLabel: string;
  subjectLabel: string;
  sessionsPlanned: number;
  sessionsCompleted: number;
  rows: ReportRow[];
  sessionColumns?: string[];
  bodyItems?: BodyItem[];
  signatureData?: ArrayBuffer | null;
  signatureImageType?: "png" | "jpg";
  submittedOn?: string;
  staffId?: string | null;
}

const FROM_ORG = "CREOLEAP TECHNOLOGIES PVT LTD";
const TITLE_COLOR = "660000";
const HEADER_BLUE = "4FA3D1";
const BORDER_SINGLE = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
const ALL_BORDERS = { top: BORDER_SINGLE, bottom: BORDER_SINGLE, left: BORDER_SINGLE, right: BORDER_SINGLE };
const COMPACT_CELL_MARGINS = {
  top: 40,
  bottom: 40,
  left: 80,
  right: 80,
  marginUnitType: WidthType.DXA,
};
const PAGE_MARGINS = { top: 1440, bottom: 1440, left: 1440, right: 480 };
const PORTRAIT_LOGO_OFFSET = 3750000;
const PAGE_WIDTH_DXA = 11906;
const CONTENT_WIDTH_DXA = PAGE_WIDTH_DXA - PAGE_MARGINS.left - PAGE_MARGINS.right;
const SESSION_SUMMARY_FIXED_WIDTHS = [1060, 620, 1220, 1300];
const SESSION_TABLE_FONT_SIZE = 20;
const SESSION_CELL_MARGINS = {
  top: 40,
  bottom: 40,
  left: 20,
  right: 20,
  marginUnitType: WidthType.DXA,
};

// Load assets as ArrayBuffer at module level
let blueStripeData: ArrayBuffer | null = null;
let logoData: ArrayBuffer | null = null;

async function resolvePngAsset(asset: string | ArrayBuffer): Promise<ArrayBuffer | null> {
  if (asset instanceof ArrayBuffer) {
    return asset;
  }

  if (typeof asset === "string") {
    const res = await fetch(asset);
    return await res.arrayBuffer();
  }

  return null;
}

async function loadAssets() {
  try {
    blueStripeData = await resolvePngAsset(blueStripePng);
  } catch { /* stripe image missing */ }
  try {
    logoData = await resolvePngAsset(logoPng);
  } catch { /* logo image missing */ }
}

function infoRow(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { before: 80, after: 80, line: 276 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 24, font: "Times New Roman", color: "000000" }),
      new TextRun({ text: value, size: 24, font: "Times New Roman", color: "000000" }),
    ],
  });
}

function infoRowBoldValue(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { before: 80, after: 80, line: 276 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 24, font: "Times New Roman", color: "000000" }),
      new TextRun({ text: value, bold: true, size: 24, font: "Times New Roman", color: "000000" }),
    ],
  });
}

function makeBlueStripeImage(): ImageRun | null {
  if (!blueStripeData) return null;
  return new ImageRun({
    data: blueStripeData,
    transformation: { width: 105, height: 1600 },
    type: "jpg",
    floating: {
      horizontalPosition: { align: "left" as any },
      verticalPosition: { align: "top" as any },
      wrap: { type: "square" as any, side: "bothSides" as any },
      allowOverlap: true,
      behindDocument: false,
      lockAnchor: false,
      layoutInCell: true,
    },
  });
}

function buildCoverPage(params: ReportParams): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  for (let i = 0; i < 4; i++) {
    elements.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
  }

  elements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "Monthly Lesson Completion Report",
          bold: true,
          size: 56,
          font: "Times New Roman",
        }),
      ],
    }),
  );

  elements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: `${params.monthName} ${params.year}`,
          bold: true,
          size: 142,
          font: "Times New Roman",
          color: TITLE_COLOR,
        }),
      ],
    }),
  );

  elements.push(new Paragraph({ spacing: { after: 100 } }));
  elements.push(infoRowBoldValue("From", FROM_ORG));
  elements.push(infoRow("Month", `${params.monthName} ${params.year}`));

  elements.push(
    new Paragraph({
      spacing: { before: 80, after: 80 },
      children: [
        new TextRun({ text: "Submitted by: ", bold: true, size: 24, font: "Times New Roman", color: "000000" }),
        new TextRun({ text: params.staffNames[0] || "", size: 24, font: "Times New Roman", color: "000000" }),
      ],
    }),
  );

  for (let i = 1; i < params.staffNames.length; i++) {
    elements.push(
      new Paragraph({
        spacing: { after: 60 },
        indent: { left: 1800 },
        children: [
          new TextRun({ text: params.staffNames[i], size: 24, font: "Times New Roman", color: "000000" }),
        ],
      }),
    );
  }

  elements.push(new Paragraph({ spacing: { after: 400 } }));

  elements.push(
    new Paragraph({
      spacing: { before: 240, after: 120 },
      children: [
        new TextRun({
          text: "School Information",
          bold: true,
          size: 24,
          font: "Times New Roman",
          color: "000000",
        }),
      ],
    }),
  );

  elements.push(infoRowBoldValue("School Name", params.schoolName));
  elements.push(infoRow("Class/Grade", params.classesLabel));
  elements.push(infoRow("Subject/Program", params.subjectLabel));
  elements.push(infoRow("No. of Sessions/Periods Planned", String(params.sessionsPlanned)));
  elements.push(infoRow("No. of Sessions/Periods Completed", String(params.sessionsCompleted)));

  return elements;
}

function buildStyledTable(
  title: string,
  columns: string[],
  dataRows: string[][],
  pageBreakBefore = false,
  columnWidths?: number[],
  cellMargins = COMPACT_CELL_MARGINS,
  fontSize = 24,
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  elements.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 300 },
      pageBreakBefore,
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 24,
          font: "Times New Roman",
          color: "000000",
        }),
      ],
    }),
  );

  const colCount = columns.length;
  const fixedWidths = columnWidths && columnWidths.length === colCount
    ? columnWidths
    : undefined;
  const widths = Array.from({ length: colCount }, (_, i) => {
    if (colCount <= 2) return { size: 0, type: WidthType.AUTO };
    if (fixedWidths) return { size: fixedWidths[i], type: WidthType.DXA };
    const pct = Math.floor(100 / colCount);
    return { size: pct, type: WidthType.PERCENTAGE };
  });

  const headerCells = columns.map((col, i) =>
    new TableCell({
      width: widths[i] as any,
      margins: cellMargins,
      shading: { type: ShadingType.SOLID, color: HEADER_BLUE, fill: HEADER_BLUE },
      verticalAlign: VerticalAlign.CENTER,
      borders: ALL_BORDERS,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({
              text: col,
              bold: true,
              size: fontSize,
              font: "Times New Roman",
              color: "FFFFFF",
            }),
          ],
        }),
      ],
    }),
  );

  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headerCells,
  });

  const rows = dataRows.map((row) => {
    const cells = row.map((val, i) =>
      new TableCell({
        width: widths[i] as any,
        margins: cellMargins,
        verticalAlign: VerticalAlign.TOP,
        borders: ALL_BORDERS,
        children: [
          new Paragraph({
            alignment: i < 2 ? AlignmentType.CENTER : AlignmentType.LEFT,
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({ text: val || "", size: fontSize, font: "Times New Roman" }),
            ],
          }),
        ],
      }),
    );

    return new TableRow({ cantSplit: true, children: cells });
  });

  const table = new Table({
    columnWidths: fixedWidths,
    width: fixedWidths
      ? { size: fixedWidths.reduce((sum, width) => sum + width, 0), type: WidthType.DXA }
      : { size: 100, type: WidthType.PERCENTAGE },
    margins: cellMargins,
    layout: fixedWidths ? TableLayoutType.FIXED : TableLayoutType.AUTOFIT,
    rows: [headerRow, ...rows],
  });

  elements.push(table);
  return elements;
}

function buildSessionTable(
  rows: ReportRow[],
  columnNames?: string[],
): (Paragraph | Table)[] {
  const columns = columnNames?.length === 5
    ? columnNames
    : ["Date", "Class", "Chapter", "Topic", "Remarks"];

  const dataRows = rows.map((row) => {
    const classSection = row.section ? `${row.className}${row.section}` : row.className;
    return [row.date, classSection, row.chapterName, row.topicName, row.remarks];
  });

  const fixedTotal = SESSION_SUMMARY_FIXED_WIDTHS.reduce((sum, width) => sum + width, 0);
  const remarksWidth = Math.max(3600, CONTENT_WIDTH_DXA - fixedTotal);
  return buildStyledTable("Session Summary", columns, dataRows, false, [
    ...SESSION_SUMMARY_FIXED_WIDTHS,
    remarksWidth,
  ], SESSION_CELL_MARGINS, SESSION_TABLE_FONT_SIZE);
}

function buildHeader(horizontalOffset: number): Header {
  const children: (TextRun | ImageRun)[] = [];

  const stripe = makeBlueStripeImage();
  if (stripe) {
    children.push(stripe);
  }

  if (logoData) {
    children.push(
      new ImageRun({
        data: logoData,
        transformation: { width: 380, height: 100 },
        type: "png",
        floating: {
          horizontalPosition: { relative: "page" as any, offset: horizontalOffset },
          verticalPosition: { relative: "page" as any, offset: 0 },
          wrap: { type: "square" as any, side: "bothSides" as any },
          allowOverlap: true,
          behindDocument: false,
          lockAnchor: false,
          layoutInCell: true,
        },
      }),
    );
  }

  return new Header({
    children: [new Paragraph({ children })],
  });
}

function buildSignatureSection(params: ReportParams): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBorders = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };
  const signatureCellMargins = { top: 0, bottom: 0, left: 0, right: 0, marginUnitType: WidthType.DXA };
  const signatureImageType = params.signatureImageType === "jpg" ? "jpg" : "png";

  elements.push(
    new Paragraph({
      spacing: { before: 60, after: 60 },
      children: [
        new TextRun({
          text: `Submitted on: ${params.submittedOn || ""}`,
          bold: true,
          size: 24,
          font: "Times New Roman",
          color: "000000",
        }),
      ],
    }),
  );

  const blankParagraph = () => new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [],
  });

  const signatureImageParagraph = params.signatureData
    ? new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 0 },
        children: [
          new ImageRun({
            data: params.signatureData,
            transformation: { width: 270, height: 90 },
            type: signatureImageType,
          }),
        ],
      })
    : blankParagraph();

  const sigTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: noBorders.top,
      bottom: noBorders.bottom,
      left: noBorders.left,
      right: noBorders.right,
      insideHorizontal: noBorders.top,
      insideVertical: noBorders.left,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            margins: signatureCellMargins,
            borders: noBorders,
            children: [blankParagraph()],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            margins: signatureCellMargins,
            borders: noBorders,
            children: [signatureImageParagraph],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            margins: signatureCellMargins,
            borders: noBorders,
            children: [
              new Paragraph({
                spacing: { before: 40, after: 0 },
                children: [
                  new TextRun({
                    text: "Principal's Signature",
                    size: 24,
                    font: "Times New Roman",
                    color: "000000",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            margins: signatureCellMargins,
            borders: noBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 40, after: 0 },
                children: [
                  new TextRun({
                    text: "Trainer's Signature",
                    size: 24,
                    font: "Times New Roman",
                    color: "000000",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  elements.push(sigTable);
  return elements;
}

function parseInlineBold(text: string, baseBold: boolean): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index), bold: baseBold, size: 24, font: "Times New Roman" }));
    }
    runs.push(new TextRun({ text: match[1], bold: true, size: 24, font: "Times New Roman" }));
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex), bold: baseBold, size: 24, font: "Times New Roman" }));
  }
  if (runs.length === 0) {
    runs.push(new TextRun({ text, bold: baseBold, size: 24, font: "Times New Roman" }));
  }
  return runs;
}

// Parse HTML text from Tiptap editor into TextRun[]
function parseHtmlInlineRuns(html: string): TextRun[] {
  const runs: TextRun[] = [];
  // Split by HTML tags, keeping the tags as separators
  const parts = html.split(/(<[^>]+>)/);
  let inBold = false;
  let inItalic = false;
  let inStrikethrough = false;

  for (const part of parts) {
    if (part === "<strong>" || part === "<b>") { inBold = true; continue; }
    if (part === "</strong>" || part === "</b>") { inBold = false; continue; }
    if (part === "<em>" || part === "<i>") { inItalic = true; continue; }
    if (part === "</em>" || part === "</i>") { inItalic = false; continue; }
    if (part === "<s>" || part === "<strike>" || part === "<del>") { inStrikethrough = true; continue; }
    if (part === "</s>" || part === "</strike>" || part === "</del>") { inStrikethrough = false; continue; }
    if (part.startsWith("<")) continue; // skip any other tags
    if (!part) continue;

    // Decode common HTML entities
    const decoded = part
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"');

    if (decoded) {
      runs.push(new TextRun({
        text: decoded,
        bold: inBold,
        italics: inItalic,
        strike: inStrikethrough,
        size: 24,
        font: "Times New Roman",
      }));
    }
  }

  if (runs.length === 0) {
    // Strip any remaining tags and return plain text
    const plain = html.replace(/<[^>]+>/g, "").trim();
    runs.push(new TextRun({ text: plain, size: 24, font: "Times New Roman" }));
  }
  return runs;
}

export async function generateMonthlyReportDocx(params: ReportParams): Promise<Uint8Array> {
  await loadAssets();

  const coverElements = buildCoverPage(params);
  const tableElements = buildSessionTable(params.rows, params.sessionColumns);

  // Build body items (tables & content blocks) after the session table
  const bodyElements: (Paragraph | Table)[] = [];
  if (params.bodyItems && params.bodyItems.length > 0) {
    for (let bi = 0; bi < params.bodyItems.length; bi++) {
      const item = params.bodyItems[bi];
      const nextItem = bi + 1 < params.bodyItems.length ? params.bodyItems[bi + 1] : null;
      const pageBreakBefore = !item.keepOnSamePage;
      // If next item wants to stay on same page, this item should keepNext
      const keepNext = !!nextItem?.keepOnSamePage;
      if (item.kind === "table" && item.table) {
        bodyElements.push(...buildStyledTable(item.table.title, item.table.columns, item.table.rows, pageBreakBefore));
      } else if (item.kind === "content" && item.content) {
        if (item.content.type === "heading") {
          bodyElements.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              keepNext,
              spacing: { before: 300, after: 120 },
              pageBreakBefore,
              children: [
                new TextRun({
                  text: item.content.text,
                  bold: true,
                  size: 24,
                  font: "Times New Roman",
                  color: "000000",
                }),
              ],
            }),
          );
        } else {
          const text = item.content.text;
          const isHtml = text.startsWith("<");

          if (isHtml) {
            // Tiptap HTML — parse structure
            const ulMatch = text.match(/^<ul>(.*)<\/ul>$/s);
            const olMatch = text.match(/^<ol>(.*)<\/ol>$/s);

            if (ulMatch || olMatch) {
              // List: extract <li> contents
              const listHtml = ulMatch ? ulMatch[1] : olMatch![1];
              const liItems = listHtml.match(/<li>(.*?)<\/li>/gs) || [];
              for (let li = 0; li < liItems.length; li++) {
                const inner = liItems[li].replace(/^<li>/, "").replace(/<\/li>$/, "");
                bodyElements.push(
                  new Paragraph({
                    bullet: ulMatch ? { level: 0 } : undefined,
                    numbering: olMatch ? { reference: "report-numbering", level: 0 } : undefined,
                    spacing: { before: li === 0 ? 80 : 40, after: li === liItems.length - 1 ? 80 : 40, line: 276 },
                    pageBreakBefore: li === 0 ? pageBreakBefore : false,
                    alignment: AlignmentType.JUSTIFIED,
                    children: parseHtmlInlineRuns(inner),
                  }),
                );
              }
            } else {
              // Paragraph(s): split by </p><p> or just render as one
              const pContents = text.match(/<p>(.*?)<\/p>/gs) || [text];
              for (let pi = 0; pi < pContents.length; pi++) {
                const inner = pContents[pi].replace(/^<p>/, "").replace(/<\/p>$/, "");
                const isLast = pi === pContents.length - 1;
                bodyElements.push(
                  new Paragraph({
                    spacing: { before: pi === 0 ? 80 : 40, after: isLast ? 80 : 40, line: 276 },
                    pageBreakBefore: pi === 0 ? pageBreakBefore : false,
                    alignment: AlignmentType.JUSTIFIED,
                    children: parseHtmlInlineRuns(inner),
                  }),
                );
              }
            }
          } else {
            // Legacy plain text
            const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
            const lines = normalized.split("\n").filter(l => l.trim());
            const isList = item.content.format === "bullet" || item.content.format === "number";
            const isBold = !!item.content.bold;

            if (isList && lines.length > 0) {
              for (let li = 0; li < lines.length; li++) {
                const isFirst = li === 0;
                const isLast = li === lines.length - 1;
                let itemText = lines[li].trim();
                if (item.content.format === "bullet") {
                  itemText = itemText.replace(/^[•●◦▪➢►‣⁃\-*]\s*/, "");
                } else if (item.content.format === "number") {
                  itemText = itemText.replace(/^\d+[.)]\s*/, "");
                }
                bodyElements.push(
                  new Paragraph({
                    numbering: item.content.format === "number"
                      ? { reference: "report-numbering", level: 0 }
                      : undefined,
                    bullet: item.content.format === "bullet" ? { level: 0 } : undefined,
                    spacing: { before: isFirst ? 80 : 40, after: isLast ? 80 : 40, line: 276 },
                    pageBreakBefore: isFirst ? pageBreakBefore : false,
                    alignment: AlignmentType.JUSTIFIED,
                    children: parseInlineBold(itemText, isBold),
                  }),
                );
              }
            } else {
              bodyElements.push(
                new Paragraph({
                  spacing: { before: 80, after: 80, line: 276 },
                  pageBreakBefore,
                  alignment: AlignmentType.JUSTIFIED,
                  children: parseInlineBold(text, isBold),
                }),
              );
            }
          }
        }
      }
    }
  }

  const header = buildHeader(PORTRAIT_LOGO_OFFSET);
  const signatureElements = buildSignatureSection(params);

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "report-numbering",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11909,
              height: 16834,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: PAGE_MARGINS,
          },
        },
        headers: { default: header },
        children: coverElements,
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: {
              width: 11909,
              height: 16834,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: PAGE_MARGINS,
          },
        },
        headers: { default: header },
        children: [...tableElements, ...bodyElements, ...signatureElements],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}
