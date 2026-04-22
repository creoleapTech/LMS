import DOMPurify from "dompurify";

interface RichTextViewerProps {
  content: string;
  className?: string;
}

export function RichTextViewer({ content, className = "" }: RichTextViewerProps) {
  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr",
      "strong", "em", "u", "s", "blockquote", "pre", "code",
      "ul", "ol", "li", "a", "img", "table", "thead", "tbody",
      "tr", "th", "td", "span", "div",
    ],
    ALLOWED_ATTR: [
      "href", "target", "rel", "src", "alt", "width", "height",
      "class", "style", "colspan", "rowspan",
    ],
    // Allow width style on img for resized images
    FORCE_BODY: false,
  });

  return (
    <div
      className={`prose prose-sm max-w-none dark:prose-invert ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
