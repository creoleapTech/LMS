import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Undo,
  Redo,
  Strikethrough,
} from "lucide-react";

interface ReportBodyEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function ReportBodyEditor({
  content,
  onChange,
  placeholder = "Write here...",
}: ReportBodyEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        code: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none w-full min-h-[60px] focus:outline-none p-3 text-sm text-justify",
      },
    },
  });

  if (!editor) return null;

  const TB = ({
    onClick,
    active,
    title,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <Button
      type="button"
      variant={active ? "default" : "ghost"}
      size="sm"
      className={`h-7 w-7 p-0 shrink-0 ${
        active ? "bg-indigo-600 text-white hover:bg-indigo-700" : ""
      }`}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b bg-slate-50">
        <TB
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </TB>
        <TB
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </TB>
        <TB
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </TB>

        <div className="w-px h-4 bg-slate-200 mx-1 shrink-0" />

        <TB
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List className="h-3.5 w-3.5" />
        </TB>
        <TB
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </TB>

        <div className="w-px h-4 bg-slate-200 mx-1 shrink-0" />

        <TB
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo"
        >
          <Undo className="h-3.5 w-3.5" />
        </TB>
        <TB
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo"
        >
          <Redo className="h-3.5 w-3.5" />
        </TB>
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[50px] [&_.ProseMirror_ul]:my-1 [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ol]:my-1 [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_li]:my-0.5 [&_.ProseMirror_p]:my-1 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-slate-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none"
      />
    </div>
  );
}
