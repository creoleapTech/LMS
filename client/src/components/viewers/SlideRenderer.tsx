import { memo, useMemo } from "react";
import type {
  SlideData,
  SlideElement,
  ParagraphData,
  TextRunData,
  FillData,
  BackgroundData,
  ShadowData,
  OutlineData,
  TableData,
  TableRowData,
  TableCellData,
} from "@/lib/pptx-parser";

const EMU_PER_POINT = 12700;

function pct(emu: number, slideEmu: number) {
  return (emu / slideEmu) * 100;
}

/** Convert pt to cqw (container query width) units for proper scaling.
 *  1pt at native size = (1 / slideWidthPt) * 100 cqw */
function ptToCqw(pt: number, slideWidthEmu: number): string {
  const slideWidthPt = slideWidthEmu / EMU_PER_POINT;
  return `${(pt / slideWidthPt) * 100}cqw`;
}

/** Convert EMU to cqw */
function emuToCqw(emu: number, slideWidthEmu: number): string {
  return `${(emu / slideWidthEmu) * 100}cqw`;
}

/** Build CSS background from fill data */
function fillToCss(fill?: FillData): React.CSSProperties {
  if (!fill || fill.type === "none") return {};
  if (fill.type === "solid" && fill.color) {
    return { backgroundColor: fill.color };
  }
  if (fill.type === "gradient" && fill.gradientStops?.length) {
    const angle = fill.gradientAngle ?? 0;
    const stops = [...fill.gradientStops]
      .sort((a, b) => a.position - b.position)
      .map((s) => `${s.color} ${s.position}%`)
      .join(", ");
    
    if (fill.gradientType === "radial") {
      return { background: `radial-gradient(ellipse at center, ${stops})` };
    }
    return { background: `linear-gradient(${90 - angle}deg, ${stops})` };
  }
  return {};
}

/** Build CSS background for slide */
function bgToCss(bg?: BackgroundData): React.CSSProperties {
  if (!bg) return { backgroundColor: "#ffffff" };
  if (bg.type === "solid" && bg.color) return { backgroundColor: bg.color };
  if (bg.type === "gradient" && bg.gradientStops?.length) {
    const stops = [...bg.gradientStops]
      .sort((a, b) => a.position - b.position)
      .map((s) => `${s.color} ${s.position}%`)
      .join(", ");
    return { background: `linear-gradient(180deg, ${stops})` };
  }
  if (bg.type === "image" && bg.imageData) {
    return {
      backgroundImage: `url(${bg.imageData})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  return { backgroundColor: "#ffffff" };
}

/** Map OOXML preset geometry to CSS border-radius */
function shapeToRadius(shapeType?: string, cornerRadius?: number): string | undefined {
  if (shapeType === "ellipse" || shapeType === "oval") return "50%";
  if (shapeType === "roundRect" || shapeType === "snipRndRect") {
    return `${cornerRadius ?? 10}%`;
  }
  return undefined;
}

/** Build CSS box-shadow from shadow data */
function shadowToCss(shadow?: ShadowData): string | undefined {
  if (!shadow) return undefined;
  
  // Calculate x and y offsets from distance and direction
  const dirRad = (shadow.dir * Math.PI) / 180;
  const offsetX = Math.cos(dirRad) * shadow.dist;
  const offsetY = Math.sin(dirRad) * shadow.dist;
  
  return `${offsetX}pt ${offsetY}pt ${shadow.blur}pt ${shadow.color}`;
}

/** Build CSS border from outline data */
function outlineToCss(outline?: OutlineData, slideWidth?: number): React.CSSProperties {
  if (!outline || outline.width <= 0) return {};
  
  let borderStyle = "solid";
  if (outline.dashType === "dash") borderStyle = "dashed";
  else if (outline.dashType === "dot") borderStyle = "dotted";
  
  const width = slideWidth ? emuToCqw(outline.width * EMU_PER_POINT, slideWidth) : `${outline.width}pt`;
  
  return {
    borderWidth: width,
    borderStyle,
    borderColor: outline.color,
  };
}

// ── Text Rendering ─────────────────────────────────────────────────

function RenderRun({ run, slideWidth }: { run: TextRunData; slideWidth: number }) {
  if (run.text === "\n") return <br />;

  const style: React.CSSProperties = {
    fontWeight: run.bold ? 700 : undefined,
    fontStyle: run.italic ? "italic" : undefined,
    textDecoration: run.underline 
      ? (run.strike ? "underline line-through" : "underline") 
      : (run.strike ? "line-through" : undefined),
    fontSize: run.fontSize ? ptToCqw(run.fontSize, slideWidth) : undefined,
    fontFamily: run.fontFamily || undefined,
    color: run.color || undefined,
    letterSpacing: run.letterSpacing ? ptToCqw(run.letterSpacing, slideWidth) : undefined,
    backgroundColor: run.highlight || undefined,
    textTransform: run.caps === "all" ? "uppercase" : (run.caps === "small" ? "uppercase" : undefined),
    fontVariant: run.caps === "small" ? "small-caps" : undefined,
    verticalAlign: run.baseline 
      ? (run.baseline > 0 ? "super" : "sub")
      : undefined,
    ...(run.baseline && Math.abs(run.baseline) > 0 ? {
      fontSize: run.fontSize 
        ? ptToCqw(run.fontSize * 0.7, slideWidth) 
        : "0.7em",
    } : {}),
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };

  return <span style={style}>{run.text}</span>;
}

function RenderParagraph({ 
  para, 
  slideWidth,
  isFirst,
  isLast,
}: { 
  para: ParagraphData; 
  slideWidth: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  // Calculate line height from lineSpacing (100 = normal)
  const lineHeight = para.lineSpacing ? para.lineSpacing / 100 : 1.2;
  
  const style: React.CSSProperties = {
    textAlign: para.alignment || "left",
    margin: 0,
    paddingTop: !isFirst && para.spaceBefore ? ptToCqw(para.spaceBefore, slideWidth) : undefined,
    paddingBottom: !isLast && para.spaceAfter ? ptToCqw(para.spaceAfter, slideWidth) : undefined,
    paddingLeft: para.marginLeft ? ptToCqw(para.marginLeft, slideWidth) : 
                 (para.level ? ptToCqw((para.level + 1) * 18, slideWidth) : undefined),
    textIndent: para.indent ? ptToCqw(para.indent, slideWidth) : undefined,
    lineHeight,
    minHeight: "1em",
  };

  const isEmpty = para.runs.length === 0 || para.runs.every((r) => !r.text.trim());

  // Bullet styling
  const bulletStyle: React.CSSProperties = para.bulletChar ? {
    display: "inline-block",
    marginRight: ptToCqw(6, slideWidth),
    color: para.bulletColor || "inherit",
    fontSize: para.bulletSize ? `${para.bulletSize}%` : undefined,
    minWidth: ptToCqw(12, slideWidth),
  } : {};

  return (
    <div style={style}>
      {para.bulletChar && !isEmpty && (
        <span style={bulletStyle}>{para.bulletChar}</span>
      )}
      {para.runs.map((run, i) => (
        <RenderRun key={i} run={run} slideWidth={slideWidth} />
      ))}
      {isEmpty && <span>&nbsp;</span>}
    </div>
  );
}

// ── Table Rendering ────────────────────────────────────────────────

function RenderTable({
  table,
  slideWidth,
  baseStyle,
}: {
  table: TableData;
  slideWidth: number;
  baseStyle: React.CSSProperties;
}) {
  // Calculate total table dimensions
  const totalGridWidth = table.gridCols.reduce((sum, w) => sum + w, 0);
  const totalRowHeight = table.rows.reduce((sum, r) => sum + r.height, 0);
  
  return (
    <div style={{ ...baseStyle, overflow: "visible" }}>
      <table 
        style={{
          width: "100%",
          height: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        <colgroup>
          {table.gridCols.map((w, i) => (
            <col key={i} style={{ width: `${(w / totalGridWidth) * 100}%` }} />
          ))}
        </colgroup>
        <tbody>
          {table.rows.map((row, rowIdx) => (
            <RenderTableRow 
              key={rowIdx}
              row={row}
              rowHeight={(row.height / totalRowHeight) * 100}
              slideWidth={slideWidth}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RenderTableRow({
  row,
  rowHeight,
  slideWidth,
}: {
  row: TableRowData;
  rowHeight: number;
  slideWidth: number;
}) {
  return (
    <tr style={{ height: `${rowHeight}%` }}>
      {row.cells.map((cell, cellIdx) => (
        <RenderTableCell 
          key={cellIdx} 
          cell={cell}
          slideWidth={slideWidth}
        />
      ))}
    </tr>
  );
}

function RenderTableCell({
  cell,
  slideWidth,
}: {
  cell: TableCellData;
  slideWidth: number;
}) {
  const fillCss = fillToCss(cell.fill);
  
  // Build border styles
  const borderStyle: React.CSSProperties = {};
  if (cell.borders) {
    if (cell.borders.left) {
      borderStyle.borderLeft = `${cell.borders.left.width}pt solid ${cell.borders.left.color}`;
    }
    if (cell.borders.right) {
      borderStyle.borderRight = `${cell.borders.right.width}pt solid ${cell.borders.right.color}`;
    }
    if (cell.borders.top) {
      borderStyle.borderTop = `${cell.borders.top.width}pt solid ${cell.borders.top.color}`;
    }
    if (cell.borders.bottom) {
      borderStyle.borderBottom = `${cell.borders.bottom.width}pt solid ${cell.borders.bottom.color}`;
    }
  }
  
  const cellStyle: React.CSSProperties = {
    ...fillCss,
    ...borderStyle,
    padding: ptToCqw(2, slideWidth),
    verticalAlign: "top",
    overflow: "hidden",
  };
  
  return (
    <td 
      style={cellStyle}
      colSpan={cell.gridSpan}
      rowSpan={cell.rowSpan}
    >
      {cell.paragraphs.map((para, i) => (
        <RenderParagraph 
          key={i} 
          para={para} 
          slideWidth={slideWidth}
          isFirst={i === 0}
          isLast={i === cell.paragraphs.length - 1}
        />
      ))}
    </td>
  );
}

// ── Element Rendering ──────────────────────────────────────────────

function RenderElement({
  element,
  slideWidth,
  slideHeight,
}: {
  element: SlideElement;
  slideWidth: number;
  slideHeight: number;
}) {
  const { position, rotation, flipH, flipV } = element;

  // Build transform string
  const transforms: string[] = [];
  if (rotation) transforms.push(`rotate(${rotation}deg)`);
  if (flipH) transforms.push("scaleX(-1)");
  if (flipV) transforms.push("scaleY(-1)");
  
  // Only apply shadow if element has a visible fill or is an image
  const hasFill = element.fill && element.fill.type !== "none";
  const hasOutline = element.outline && element.outline.width > 0;
  const isImage = element.type === "image";
  const shouldShowShadow = (hasFill || hasOutline || isImage) && element.shadow;
  
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: `${pct(position.x, slideWidth)}%`,
    top: `${pct(position.y, slideHeight)}%`,
    width: `${pct(position.width, slideWidth)}%`,
    height: `${pct(position.height, slideHeight)}%`,
    transform: transforms.length > 0 ? transforms.join(" ") : undefined,
    transformOrigin: "center center",
    overflow: "hidden",
    boxShadow: shouldShowShadow ? shadowToCss(element.shadow) : undefined,
  };

  if (element.type === "image" && element.imageData) {
    // Handle image cropping
    const crop = element.imageCrop;
    const imgStyle: React.CSSProperties = {
      width: crop ? `${100 + crop.l + crop.r}%` : "100%",
      height: crop ? `${100 + crop.t + crop.b}%` : "100%",
      objectFit: "cover",
      objectPosition: crop ? `${-crop.l}% ${-crop.t}%` : "center",
      pointerEvents: "none",
      marginLeft: crop ? `${-crop.l}%` : undefined,
      marginTop: crop ? `${-crop.t}%` : undefined,
    };
    
    return (
      <div style={baseStyle}>
        <img
          src={element.imageData}
          alt=""
          draggable={false}
          style={imgStyle}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    );
  }

  // Table rendering
  if (element.type === "table" && element.table) {
    return (
      <RenderTable 
        table={element.table} 
        slideWidth={slideWidth}
        baseStyle={baseStyle}
      />
    );
  }

  // Text or shape
  const fillCss = fillToCss(element.fill);
  const borderRadius = shapeToRadius(element.shapeType, element.cornerRadius);
  const outlineCss = outlineToCss(element.outline, slideWidth);
  
  // Text body properties for positioning
  const bodyProps = element.bodyProps || {};
  const lIns = bodyProps.lIns ?? 91440; // default ~7.2pt
  const rIns = bodyProps.rIns ?? 91440;
  const tIns = bodyProps.tIns ?? 45720; // default ~3.6pt
  const bIns = bodyProps.bIns ?? 45720;
  
  // Vertical alignment
  let justifyContent = "flex-start";
  if (bodyProps.anchor === "ctr") justifyContent = "center";
  else if (bodyProps.anchor === "b") justifyContent = "flex-end";
  
  // Horizontal alignment of text box content
  let alignItems = "stretch";
  if (bodyProps.anchorCtr) alignItems = "center";

  const shapeStyle: React.CSSProperties = {
    ...baseStyle,
    ...fillCss,
    ...outlineCss,
    borderRadius,
    padding: element.paragraphs 
      ? `${emuToCqw(tIns, slideWidth)} ${emuToCqw(rIns, slideWidth)} ${emuToCqw(bIns, slideWidth)} ${emuToCqw(lIns, slideWidth)}`
      : undefined,
    display: "flex",
    flexDirection: "column",
    justifyContent,
    alignItems,
    boxSizing: "border-box",
    wordWrap: "break-word",
    overflowWrap: "break-word",
    whiteSpace: bodyProps.wrap === "none" ? "nowrap" : undefined,
  };

  return (
    <div style={shapeStyle}>
      {element.paragraphs && (
        <div style={{ width: "100%" }}>
          {element.paragraphs.map((para, i) => (
            <RenderParagraph 
              key={i} 
              para={para} 
              slideWidth={slideWidth}
              isFirst={i === 0}
              isLast={i === element.paragraphs!.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Slide Renderer ─────────────────────────────────────────────────

interface SlideRendererProps {
  slide: SlideData;
  slideWidth: number;
  slideHeight: number;
}

export const SlideRenderer = memo(function SlideRenderer({
  slide,
  slideWidth,
  slideHeight,
}: SlideRendererProps) {
  const bgStyle = bgToCss(slide.background);
  const aspectRatio = slideWidth / slideHeight;

  // Default font size: ~18pt equivalent scaled to container (common PPT default)
  const defaultFontSize = ptToCqw(18, slideWidth);
  
  // Sort elements by their position to handle z-order (elements later in array are on top)
  const sortedElements = useMemo(() => {
    // Keep original order - PPT elements are already in z-order
    return slide.elements;
  }, [slide.elements]);

  return (
    <div
      style={{
        containerType: "inline-size",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: `${aspectRatio}`,
          ...bgStyle,
          overflow: "hidden",
          borderRadius: "4px",
          fontSize: defaultFontSize,
          fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif",
          lineHeight: 1.2,
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          textRendering: "optimizeLegibility",
        }}
      >
        {sortedElements.map((el, i) => (
          <RenderElement
            key={i}
            element={el}
            slideWidth={slideWidth}
            slideHeight={slideHeight}
          />
        ))}
      </div>
    </div>
  );
});
