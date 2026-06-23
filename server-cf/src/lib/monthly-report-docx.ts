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
const PAGE_MARGINS = { top: 1440, bottom: 1440, left: 1440, right: 1440 };
const PORTRAIT_LOGO_OFFSET = 3750000;

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
      new TextRun({ text: `${label}: `, bold: true, size: 32, font: "Times New Roman", color: "000000" }),
      new TextRun({ text: value, size: 32, font: "Times New Roman", color: "000000" }),
    ],
  });
}

function infoRowBoldValue(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { before: 80, after: 80, line: 276 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 32, font: "Times New Roman", color: "000000" }),
      new TextRun({ text: value, bold: true, size: 32, font: "Times New Roman", color: "000000" }),
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
        new TextRun({ text: "Submitted by: ", bold: true, size: 32, font: "Times New Roman", color: "000000" }),
        new TextRun({ text: params.staffNames[0] || "", size: 32, font: "Times New Roman", color: "000000" }),
      ],
    }),
  );

  for (let i = 1; i < params.staffNames.length; i++) {
    elements.push(
      new Paragraph({
        spacing: { after: 60 },
        indent: { left: 1800 },
        children: [
          new TextRun({ text: params.staffNames[i], size: 32, font: "Times New Roman", color: "000000" }),
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
          size: 40,
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
          size: 32,
          font: "Times New Roman",
          color: "000000",
        }),
      ],
    }),
  );

  const colCount = columns.length;
  const widths = Array.from({ length: colCount }, (_, i) => {
    if (colCount <= 2) return { size: 0, type: WidthType.AUTO };
    return { size: Math.floor(100 / colCount), type: WidthType.PERCENTAGE };
  });

  const headerCells = columns.map((col, i) =>
    new TableCell({
      width: widths[i] as any,
      margins: COMPACT_CELL_MARGINS,
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
              size: 28,
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
        margins: COMPACT_CELL_MARGINS,
        verticalAlign: VerticalAlign.CENTER,
        borders: ALL_BORDERS,
        children: [
          new Paragraph({
            alignment: i < 2 ? AlignmentType.CENTER : AlignmentType.LEFT,
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({ text: val || "", size: 28, font: "Times New Roman" }),
            ],
          }),
        ],
      }),
    );

    return new TableRow({ cantSplit: true, children: cells });
  });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: COMPACT_CELL_MARGINS,
    layout: TableLayoutType.AUTOFIT,
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
    : ["Date", "Class/Section", "Chapter Name", "Topic Name", "Remarks"];

  const dataRows = rows.map((row) => {
    const classSection = row.section ? `${row.className}–${row.section}` : row.className;
    return [row.date, classSection, row.chapterName, row.topicName, row.remarks];
  });

  return buildStyledTable("Session Summary", columns, dataRows);
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
      spacing: { before: 240, after: 240 },
      children: [
        new TextRun({
          text: `Submitted on: ${params.submittedOn || ""}`,
          bold: true,
          size: 28,
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
            transformation: { width: 240, height: 80 },
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
        cantSplit: true,
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
        cantSplit: true,
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

export async function generateMonthlyReportDocx(params: ReportParams): Promise<Uint8Array> {
  await loadAssets();

  const coverElements = buildCoverPage(params);
  const tableElements = buildSessionTable(params.rows, params.sessionColumns);

  // Build body items (tables & content blocks) after the session table
  const bodyElements: (Paragraph | Table)[] = [];
  if (params.bodyItems && params.bodyItems.length > 0) {
    for (const item of params.bodyItems) {
      const pageBreakBefore = !item.keepOnSamePage;
      if (item.kind === "table" && item.table) {
        bodyElements.push(...buildStyledTable(item.table.title, item.table.columns, item.table.rows, pageBreakBefore));
      } else if (item.kind === "content" && item.content) {
        if (item.content.type === "heading") {
          bodyElements.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 120 },
              pageBreakBefore,
              children: [
                new TextRun({
                  text: item.content.text,
                  bold: true,
                  size: 32,
                  font: "Times New Roman",
                  color: "000000",
                }),
              ],
            }),
          );
        } else {
          bodyElements.push(
            new Paragraph({
              spacing: { before: 80, after: 80, line: 276 },
              pageBreakBefore,
              children: [
                new TextRun({
                  text: item.content.text,
                  size: 28,
                  font: "Times New Roman",
                }),
              ],
            }),
          );
        }
      }
    }
  }

  const header = buildHeader(PORTRAIT_LOGO_OFFSET);
  const signatureElements = buildSignatureSection(params);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
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
            size: { orientation: PageOrientation.PORTRAIT },
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
