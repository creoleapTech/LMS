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
import { readFileSync } from "fs";
import { join } from "path";

export interface ReportRow {
  date: string;
  className: string;
  section: string;
  chapterName: string;
  topicName: string;
  remarks: string;
}

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
const LANDSCAPE_LOGO_OFFSET = 6220000;

// Load assets (pre-processed images)
let blueStripeData: Buffer | null = null;
let logoData: Buffer | null = null;
try {
  blueStripeData = readFileSync(join(import.meta.dir, "blue-stripe-clean.png"));
} catch { /* stripe image missing */ }
try {
  logoData = readFileSync(join(import.meta.dir, "creoleap-logo-final.png"));
} catch { /* logo image missing */ }

/** Cover page info field: bold label + normal value, sz=32 (16pt) */
function infoRow(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { before: 80, after: 80, line: 276 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 32, font: "Times New Roman", color: "000000" }),
      new TextRun({ text: value, size: 32, font: "Times New Roman", color: "000000" }),
    ],
  });
}

/** Cover page info field where value is also bold */
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
  // Original EMU: 667512 wide x 10067544 tall → pixels at 9525 EMU/px: ~70 x 1057
  return new ImageRun({
    data: blueStripeData,
    transformation: { width: 70, height: 1057 },
    type: "png",
    floating: {
      horizontalPosition: { relative: "page" as any, offset: 0 },
      verticalPosition: { relative: "page" as any, offset: 0 },
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

  // Blue stripe anchored image (first instance — appears on cover page)
  const stripe1 = makeBlueStripeImage();
  if (stripe1) {
    elements.push(new Paragraph({ children: [stripe1] }));
  }

  // Spacer paragraphs (push title down below the header logo area)
  for (let i = 0; i < 4; i++) {
    elements.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
  }

  // Title: "Monthly Lesson Completion Report" — center, sz=56 (28pt), Times New Roman
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
    })
  );

  // Month Year — center, sz=142 (71pt), dark red/brown
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
    })
  );

  // Empty spacers before info fields
  elements.push(new Paragraph({ spacing: { after: 100 } }));

  // From: CREOLEAP TECHNOLOGIES PVT LTD — bold label + bold value
  elements.push(infoRowBoldValue("From", FROM_ORG));

  // Month
  elements.push(infoRow("Month", `${params.monthName} ${params.year}`));

  // Submitted by: staff name(s)
  elements.push(
    new Paragraph({
      spacing: { before: 80, after: 80 },
      children: [
        new TextRun({ text: "Submitted by: ", bold: true, size: 32, font: "Times New Roman", color: "000000" }),
        new TextRun({ text: params.staffNames[0] || "", size: 32, font: "Times New Roman", color: "000000" }),
      ],
    })
  );

  // Additional staff names indented
  for (let i = 1; i < params.staffNames.length; i++) {
    elements.push(
      new Paragraph({
        spacing: { after: 60 },
        indent: { left: 1800 },
        children: [
          new TextRun({ text: params.staffNames[i], size: 32, font: "Times New Roman", color: "000000" }),
        ],
      })
    );
  }

  // Spacer before School Information
  elements.push(new Paragraph({ spacing: { after: 400 } }));

  // "School Information" heading — bold, sz=40 (20pt)
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
    })
  );

  // School Name — bold value
  elements.push(infoRowBoldValue("School Name", params.schoolName));

  // Class/Grade
  elements.push(infoRow("Class/Grade", params.classesLabel));

  // Subject/Program
  elements.push(infoRow("Subject/Program", params.subjectLabel));

  // Sessions Planned/Completed
  elements.push(infoRow("No. of Sessions/Periods Planned", String(params.sessionsPlanned)));
  elements.push(infoRow("No. of Sessions/Periods Completed", String(params.sessionsCompleted)));

  return elements;
}

function buildSessionTable(rows: ReportRow[]): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  // Session Summary heading
  elements.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: "Session Summary",
          bold: true,
          size: 32,
          font: "Times New Roman",
        }),
      ],
    })
  );

  const columns = ["Date", "Class", "Section", "Chapter Name", "Topic Name", "Remarks"];
  const widths = [
    { size: 0, type: WidthType.AUTO },
    { size: 0, type: WidthType.AUTO },
    { size: 0, type: WidthType.AUTO },
    { size: 23, type: WidthType.PERCENTAGE },
    { size: 37, type: WidthType.PERCENTAGE },
    { size: 25, type: WidthType.PERCENTAGE },
  ] as const;

  // Header row
  const headerCells = columns.map((col, i) =>
    new TableCell({
      width: widths[i],
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
    })
  );

  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headerCells,
  });

  // Data rows
  const dataRows = rows.map((row) => {
    const values = [
      row.date, row.className, row.section,
      row.chapterName, row.topicName, row.remarks,
    ];

    const cells = values.map((val, i) =>
      new TableCell({
        width: widths[i],
        margins: COMPACT_CELL_MARGINS,
        verticalAlign: VerticalAlign.CENTER,
        borders: ALL_BORDERS,
        children: [
          new Paragraph({
            alignment: i < 3 ? AlignmentType.CENTER : AlignmentType.LEFT,
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({ text: val || "", size: 28, font: "Times New Roman" }),
            ],
          }),
        ],
      })
    );

    return new TableRow({ cantSplit: true, children: cells });
  });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: COMPACT_CELL_MARGINS,
    layout: TableLayoutType.AUTOFIT,
    rows: [headerRow, ...dataRows],
  });

  elements.push(table);
  return elements;
}

function buildHeader(horizontalOffset: number): Header {
  const children: (TextRun | ImageRun)[] = [];

  if (logoData) {
    // Cropped logo (800x209px). Display at ~400 x 105 px
    // Positioned top-right with padding from page edge
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
      })
    );
  }

  return new Header({
    children: [
      new Paragraph({ children }),
    ],
  });
}

export async function generateMonthlyReportDocx(params: ReportParams): Promise<Buffer> {
  const coverElements = buildCoverPage(params);
  const tableElements = buildSessionTable(params.rows);

  const portraitHeader = buildHeader(PORTRAIT_LOGO_OFFSET);
  const landscapeHeader = buildHeader(LANDSCAPE_LOGO_OFFSET);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: PAGE_MARGINS,
          },
        },
        headers: { default: portraitHeader },
        children: coverElements,
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: PAGE_MARGINS,
          },
        },
        headers: { default: landscapeHeader },
        children: tableElements,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
