import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Placeholder from "@tiptap/extension-placeholder";
import UnderlineExt from "@tiptap/extension-underline";
import LinkExt from "@tiptap/extension-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ImageIcon,
  Table as TableIcon,
  Link as LinkIcon,
  Unlink,
  Code,
  Undo,
  Redo,
  Quote,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Strikethrough,
} from "lucide-react";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, placeholder = "Start writing..." }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      UnderlineExt,
      LinkExt.configure({ openOnClick: false, HTMLAttributes: { class: "text-blue-600 underline cursor-pointer" } }),
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  // ── Image upload (file → base64) ──────────────────────────────────────────
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Link ──────────────────────────────────────────────────────────────────
  const applyLink = () => {
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url.startsWith("http") ? url : `https://${url}` }).run();
    }
    setShowLinkInput(false);
    setLinkUrl("");
  };

  const openLinkInput = () => {
    const existing = editor.getAttributes("link").href || "";
    setLinkUrl(existing);
    setShowLinkInput((v) => !v);
  };

  // ── Table ─────────────────────────────────────────────────────────────────
  const addTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  // ── Toolbar button ────────────────────────────────────────────────────────
  const TB = ({ onClick, active, title, children }: {
    onClick: () => void; active?: boolean; title: string; children: React.ReactNode;
  }) => (
    <Button
      type="button"
      variant={active ? "default" : "ghost"}
      size="sm"
      className={`h-8 w-8 p-0 shrink-0 ${active ? "bg-indigo-600 text-white hover:bg-indigo-700" : ""}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );

  const Sep = () => <div className="w-px h-6 bg-border mx-1 shrink-0" />;

  return (
    <div className="border rounded-xl overflow-hidden w-full">
      {/* Hidden file input for image upload */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b bg-muted/30">
        {/* Headings */}
        <TB onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
          <Heading1 className="h-4 w-4" />
        </TB>
        <TB onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
          <Heading2 className="h-4 w-4" />
        </TB>
        <TB onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
          <Heading3 className="h-4 w-4" />
        </TB>

        <Sep />

        {/* Inline formatting */}
        <TB onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
          <Bold className="h-4 w-4" />
        </TB>
        <TB onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
          <Italic className="h-4 w-4" />
        </TB>
        <TB onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
          <UnderlineIcon className="h-4 w-4" />
        </TB>
        <TB onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
          <Strikethrough className="h-4 w-4" />
        </TB>
        <TB onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline Code">
          <Code className="h-4 w-4" />
        </TB>

        <Sep />

        {/* Lists & blocks */}
        <TB onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List">
          <List className="h-4 w-4" />
        </TB>
        <TB onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Ordered List">
          <ListOrdered className="h-4 w-4" />
        </TB>
        <TB onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">
          <Quote className="h-4 w-4" />
        </TB>
        <TB onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code Block">
          <Code className="h-4 w-4" />
        </TB>
        <TB onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
          <Minus className="h-4 w-4" />
        </TB>

        <Sep />

        {/* Alignment */}
        <TB onClick={() => editor.chain().focus().setTextAlign?.("left").run()} title="Align Left">
          <AlignLeft className="h-4 w-4" />
        </TB>
        <TB onClick={() => editor.chain().focus().setTextAlign?.("center").run()} title="Align Center">
          <AlignCenter className="h-4 w-4" />
        </TB>
        <TB onClick={() => editor.chain().focus().setTextAlign?.("right").run()} title="Align Right">
          <AlignRight className="h-4 w-4" />
        </TB>

        <Sep />

        {/* Image upload */}
        <TB onClick={() => fileInputRef.current?.click()} title="Upload Image">
          <ImageIcon className="h-4 w-4" />
        </TB>

        {/* Link */}
        <TB onClick={openLinkInput} active={editor.isActive("link")} title="Insert / Edit Link">
          <LinkIcon className="h-4 w-4" />
        </TB>
        {editor.isActive("link") && (
          <TB onClick={() => editor.chain().focus().unsetLink().run()} title="Remove Link">
            <Unlink className="h-4 w-4" />
          </TB>
        )}

        {/* Table */}
        <TB onClick={addTable} title="Insert Table">
          <TableIcon className="h-4 w-4" />
        </TB>

        <Sep />

        {/* Undo / Redo */}
        <TB onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <Undo className="h-4 w-4" />
        </TB>
        <TB onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <Redo className="h-4 w-4" />
        </TB>
      </div>

      {/* Link input bar */}
      {showLinkInput && (
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/20">
          <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            className="h-8 text-sm flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") applyLink();
              if (e.key === "Escape") { setShowLinkInput(false); setLinkUrl(""); }
            }}
          />
          <Button type="button" size="sm" className="h-8 px-3" onClick={applyLink}>
            Apply
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 px-3" onClick={() => { setShowLinkInput(false); setLinkUrl(""); }}>
            Cancel
          </Button>
        </div>
      )}

      {/* Editor area — full width */}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none w-full p-4 min-h-[320px] focus-within:outline-none
          [&_.ProseMirror]:outline-none
          [&_.ProseMirror]:min-h-[300px]
          [&_.ProseMirror]:w-full
          [&_.ProseMirror_img]:max-w-full
          [&_.ProseMirror_img]:rounded-lg
          [&_.ProseMirror_img]:my-2
          [&_.ProseMirror_table]:w-full
          [&_.ProseMirror_table]:border-collapse
          [&_.ProseMirror_td]:border
          [&_.ProseMirror_td]:p-2
          [&_.ProseMirror_th]:border
          [&_.ProseMirror_th]:p-2
          [&_.ProseMirror_th]:bg-muted
          [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground
          [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]
          [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left
          [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none
          [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
      />
    </div>
  );
}
