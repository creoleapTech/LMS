import { memo } from "react";
import type {
  SlideData,
  SlideElement,
  ParagraphData,
  TextRunData,
  FillData,
  BackgroundData,
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

/** Build CSS background from fill data */
function fillToCss(fill?: FillData): React.CSSProperties {
  if (!fill || fill.type === "none") return {};
  if (fill.type === "solid" && fill.color) {
    return { backgroundColor: fill.color };
  }
  if (fill.type === "gradient" && fill.gradientStops?.length) {
    const angle = fill.gradientAngle ?? 0;
    const stops = fill.gradientStops
      .map((s) => `${s.color} ${s.position}%`)
      .join(", ");
    return { background: `linear-gradient(${angle}deg, ${stops})` };
  }
  return {};
}

/** Build CSS background for slide */
function bgToCss(bg?: BackgroundData): React.CSSProperties {
  if (!bg) return { backgroundColor: "#ffffff" };
  if (bg.type === "solid" && bg.color) return { backgroundColor: bg.color };
  if (bg.type === "gradient" && bg.gradientStops?.length) {
    const stops = bg.gradientStops.map((s) => `${s.color} ${s.position}%`).join(", ");
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

// ── Text Rendering ─────────────────────────────────────────────────

function RenderRun({ run, slideWidth }: { run: TextRunData; slideWidth: number }) {
  if (run.text === "\n") return <br />;

  const style: React.CSSProperties = {
    fontWeight: run.bold ? "bold" : undefined,
    fontStyle: run.italic ? "italic" : undefined,
    textDecoration: run.underline ? "underline" : undefined,
    fontSize: run.fontSize ? ptToCqw(run.fontSize, slideWidth) : undefined,
    fontFamily: run.fontFamily || undefined,
    color: run.color || undefined,
  };

  return <span style={style}>{run.text}</span>;
}

function RenderParagraph({ para, slideWidth }: { para: ParagraphData; slideWidth: number }) {
  const style: React.CSSProperties = {
    textAlign: para.alignment || "left",
    margin: 0,
    paddingTop: para.spaceBefore ? ptToCqw(para.spaceBefore, slideWidth) : undefined,
    paddingBottom: para.spaceAfter ? ptToCqw(para.spaceAfter, slideWidth) : undefined,
    paddingLeft: para.level ? ptToCqw(para.level * 18, slideWidth) : undefined,
    lineHeight: 1.3,
    minHeight: "1em",
  };

  const isEmpty = para.runs.length === 0 || para.runs.every((r) => !r.text.trim());

  return (
    <div style={style}>
      {para.bulletChar && !isEmpty && (
        <span style={{ marginRight: ptToCqw(6, slideWidth) }}>{para.bulletChar}</span>
      )}
      {para.runs.map((run, i) => (
        <RenderRun key={i} run={run} slideWidth={slideWidth} />
      ))}
      {isEmpty && <span>&nbsp;</span>}
    </div>
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
  const { position, rotation } = element;

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: `${pct(position.x, slideWidth)}%`,
    top: `${pct(position.y, slideHeight)}%`,
    width: `${pct(position.width, slideWidth)}%`,
    height: `${pct(position.height, slideHeight)}%`,
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
    overflow: "hidden",
  };

  if (element.type === "image" && element.imageData) {
    return (
      <div style={baseStyle}>
        <img
          src={element.imageData}
          alt=""
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            pointerEvents: "none",
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    );
  }

  // Text or shape
  const fillCss = fillToCss(element.fill);
  const borderRadius = shapeToRadius(element.shapeType, element.cornerRadius);
  const borderWidth = element.outline
    ? Math.max(1, element.outline.width)
    : 0;
  const border = element.outline
    ? `${ptToCqw(borderWidth, slideWidth)} solid ${element.outline.color}`
    : undefined;

  const shapeStyle: React.CSSProperties = {
    ...baseStyle,
    ...fillCss,
    borderRadius,
    border,
    padding: element.paragraphs ? ptToCqw(4, slideWidth) + " " + ptToCqw(6, slideWidth) : undefined,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    boxSizing: "border-box",
    wordWrap: "break-word",
    overflowWrap: "break-word",
  };

  return (
    <div style={shapeStyle}>
      {element.paragraphs?.map((para, i) => (
        <RenderParagraph key={i} para={para} slideWidth={slideWidth} />
      ))}
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

  // Default font size: ~14pt equivalent scaled to container
  const defaultFontSize = ptToCqw(14, slideWidth);

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
        }}
      >
        {slide.elements.map((el, i) => (
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
