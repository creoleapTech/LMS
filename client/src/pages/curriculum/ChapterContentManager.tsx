// src/components/curriculum/ChapterContentManager.tsx
"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Video,
  FileText,
  FileDown,
  Activity,
  HelpCircle,
  Upload,
  X,
  Trash2,
  Eye,
  GripVertical,
  Pencil,
  Plus,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Config } from "@/lib/config";
import { useAuthStore } from "@/store/userAuthStore";
import { RichTextEditor } from "@/components/editors/RichTextEditor";
import { RichTextViewer } from "@/components/editors/RichTextViewer";
import { YouTubePlayer } from "@/components/viewers/YouTubePlayer";
import { PptViewer } from "@/components/viewers/PptViewer";
import type { Question } from "@/components/quiz/types";
import { QuizBuilder } from "@/components/quiz/QuizBuilder";
import { QuizViewer } from "@/components/quiz/QuizViewer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  chapterId: string;
  chapterNumber: number;
}

type ContentType = "video" | "youtube" | "ppt" | "pdf" | "activity" | "quiz" | "text";

const DEFAULT_CONTENT_TYPE: ContentType = "text";

interface ContentItem {
  id: string;
  title: string;
  type: ContentType;
  fileUrl?: string;
  videoUrl?: string;
  youtubeUrl?: string;
  textContent?: string;
  questions?: any[];
  isFree: boolean;
  order: number;
}

// ---------------------------------------------------------------------------
// Edit Content Dialog
// ---------------------------------------------------------------------------

interface EditContentDialogProps {
  item: ContentItem;
  onClose: () => void;
  onSaved: () => void;
}

function EditContentDialog({ item, onClose, onSaved }: EditContentDialogProps) {
  const [title, setTitle] = useState(item.title);
  const [youtubeUrl, setYoutubeUrl] = useState(item.youtubeUrl || "");
  const [textContent, setTextContent] = useState(item.textContent || "");
  const [questions, setQuestions] = useState<Question[]>(item.questions || []);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const isFileBased = ["video", "ppt", "pdf", "activity"].includes(item.type);

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Title cannot be empty"); return; }
    setSaving(true);
    try {
      if (isFileBased && newFile) {
        const fd = new FormData();
        fd.append("title", title.trim());
        fd.append("file", newFile);
        await _axios.patch(`/admin/curriculum/content/${item.id}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else if (item.type === "quiz") {
        await _axios.patch(`/admin/curriculum/content/${item.id}`, {
          title: title.trim(),
          questions: JSON.stringify(questions),
        });
      } else if (item.type === "youtube") {
        await _axios.patch(`/admin/curriculum/content/${item.id}`, {
          title: title.trim(),
          youtubeUrl: youtubeUrl.trim(),
        });
      } else if (item.type === "text") {
        await _axios.patch(`/admin/curriculum/content/${item.id}`, {
          title: title.trim(),
          textContent,
        });
      } else {
        await _axios.patch(`/admin/curriculum/content/${item.id}`, { title: title.trim() });
      }
      toast.success("Content updated");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update content");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-0" showCloseButton={false}>
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-xl">
                {getContentTypeIcon(item.type)}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Edit Content</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground uppercase tracking-wide">{item.type}</DialogDescription>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Content title" />
          </div>

          {/* YouTube URL */}
          {item.type === "youtube" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">YouTube URL</label>
              <Input
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              {youtubeUrl && (
                <div className="mt-2 rounded-xl overflow-hidden">
                  <YouTubePlayer videoUrl={youtubeUrl} />
                </div>
              )}
            </div>
          )}

          {/* Rich text */}
          {item.type === "text" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Content</label>
              <RichTextEditor content={textContent} onChange={setTextContent} />
            </div>
          )}

          {/* Quiz */}
          {item.type === "quiz" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Quiz Questions</label>
              <QuizBuilder questions={questions} onChange={setQuestions} />
            </div>
          )}

          {/* File replacement */}
          {isFileBased && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Replace File <span className="text-muted-foreground font-normal">(optional)</span></label>
              {newFile ? (
                <div className="flex items-center gap-3 border rounded-xl p-3">
                  <FileText className="h-6 w-6 text-indigo-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{newFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(newFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setNewFile(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-3">Upload a new file to replace the existing one</p>
                  <input
                    type="file"
                    id="edit-file-upload"
                    className="hidden"
                    accept=".mp4,.pdf,.ppt,.pptx,.doc,.docx,.zip,.webm"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 100 * 1024 * 1024) { toast.error("File must be under 100MB"); return; }
                      setNewFile(f);
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("edit-file-upload")?.click()}>
                    Choose File
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Content-type icon map
// ---------------------------------------------------------------------------

const contentTypeIcons: Record<ContentType, typeof Video> = {
  video: Video,
  youtube: Video,
  ppt: FileText,
  pdf: FileDown,
  activity: Activity,
  quiz: HelpCircle,
  text: FileText,
};

const EMPTY_CONTENTS: ContentItem[] = [];

function getContentTypeIcon(contentType: ContentType) {
  const IconComponent = contentTypeIcons[contentType] ?? FileText;
  return <IconComponent className="h-5 w-5 text-blue-600" />;
}

// ---------------------------------------------------------------------------
// SortableContentItem
// ---------------------------------------------------------------------------

interface SortableContentItemProps {
  item: ContentItem;
  chapterNumber: number;
  isSuperAdmin: boolean;
  onView: (item: ContentItem) => void;
  onDelete: (id: string) => void;
  onOpenEditDialog: (item: ContentItem) => void;
}

function SortableContentItem({
  item,
  chapterNumber,
  isSuperAdmin,
  onView,
  onDelete,
  onOpenEditDialog,
}: SortableContentItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasPreviewable =
    item.fileUrl || item.videoUrl || item.youtubeUrl || item.textContent || item.questions?.length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {isSuperAdmin && (
          <button
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground shrink-0"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        )}

        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-xl shrink-0">
          {getContentTypeIcon(item.type)}
        </div>

        <Badge variant="secondary" className="text-xs font-mono shrink-0">
          {chapterNumber}.{item.order}
        </Badge>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium truncate">{item.title}</h4>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs uppercase">
              {item.type}
            </Badge>
            {item.isFree && (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                Free Preview
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {hasPreviewable && (
          <Button variant="ghost" size="sm" onClick={() => onView(item)}>
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
        )}
        {isSuperAdmin && (
          <>
            <Button variant="ghost" size="sm" onClick={() => onOpenEditDialog(item)} className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm("Delete this content?")) {
                  onDelete(item.id);
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ChapterContentManager({ chapterId, chapterNumber }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === "super_admin";

  // --- Upload form state ---
  const [type, setType] = useState<ContentType | "">(DEFAULT_CONTENT_TYPE);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [textContent, setTextContent] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);

  // --- Add content panel visibility ---
  const [showAddForm, setShowAddForm] = useState(false);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [viewingContent, setViewingContent] = useState<ContentItem | null>(null);
  const [editingContent, setEditingContent] = useState<ContentItem | null>(null);

  // --- DnD sensors ---
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  // ---------------------------------------------------------------------------
  // Queries & Mutations
  // ---------------------------------------------------------------------------

  const { data: contents = EMPTY_CONTENTS, isLoading } = useQuery<ContentItem[]>({
    queryKey: ["chapter-content", chapterId],
    queryFn: async () => {
      const res = await _axios.get(`/admin/curriculum/chapter/${chapterId}/content`);
      return res.data.data || [];
    },
  });

  useEffect(() => {
    setContentItems(contents);
  }, [contents]);

  // Always enter a chapter in "add content" mode with a default type selected.
  useEffect(() => {
    setViewingContent(null);
    setEditingContent(null);
    setType(DEFAULT_CONTENT_TYPE);
    setTitle("");
    setFile(null);
    setYoutubeUrl("");
    setTextContent("");
    setQuestions([]);
    setShowAddForm(false);
  }, [chapterId]);

  // Upload / create content
  const uploadMutation = useMutation({
    mutationFn: async (payload: FormData | Record<string, any>) => {
      if (payload instanceof FormData) {
        return (await _axios.post(`/admin/curriculum/chapter/${chapterId}/content`, payload)).data;
      }
      return (await _axios.post(`/admin/curriculum/chapter/${chapterId}/content`, payload)).data;
    },
    onSuccess: () => {
      toast.success("Content added successfully!");
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["chapter-content", chapterId] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Upload failed");
    },
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await _axios.delete(`/admin/curriculum/content/${id}`);
    },
    onSuccess: () => {
      toast.success("Content deleted");
      queryClient.invalidateQueries({ queryKey: ["chapter-content", chapterId] });
    },
  });

  // Reorder
  const reorderMutation = useMutation({
    mutationFn: async (reordered: ContentItem[]) => {
      const orderData = reordered.map((item, index) => ({
        contentId: item.id,
        order: index + 1,
      }));
      await _axios.post(`/admin/curriculum/chapter/${chapterId}/content/reorder`, {
        order: orderData,
      });
    },
    onSuccess: () => {
      toast.success("Content reordered successfully");
      queryClient.invalidateQueries({ queryKey: ["chapter-content", chapterId] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to reorder content");
      queryClient.invalidateQueries({ queryKey: ["chapter-content", chapterId] });
    },
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function resetForm() {
    setType(DEFAULT_CONTENT_TYPE);
    setTitle("");
    setFile(null);
    setYoutubeUrl("");
    setTextContent("");
    setQuestions([]);
    setShowAddForm(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    const maxSize = 100 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast.error("File size must be less than 100MB");
      return;
    }
    setFile(selectedFile);
  }

  function handleUpload() {
    if (!type) {
      toast.error("Please select a content type");
      return;
    }

    const nextOrder = contentItems.length + 1;
    const resolvedTitle = title.trim() || `${chapterNumber}.${nextOrder}`;

    if (type === "youtube") {
      if (!youtubeUrl.trim()) {
        toast.error("Please enter a YouTube URL");
        return;
      }
      uploadMutation.mutate({
        type,
        title: resolvedTitle,
        youtubeUrl: youtubeUrl.trim(),
        isFree: false,
      });
      return;
    }

    if (type === "text") {
      if (!textContent.trim()) {
        toast.error("Please enter some text content");
        return;
      }
      uploadMutation.mutate({
        type,
        title: resolvedTitle,
        textContent,
        isFree: false,
      });
      return;
    }

    if (type === "quiz") {
      if (questions.length === 0) {
        toast.error("Please add at least one question");
        return;
      }
      uploadMutation.mutate({
        type,
        title: resolvedTitle,
        questions: JSON.stringify(questions),
        isFree: false,
      });
      return;
    }

    // File-based types: video, ppt, pdf, activity
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    formData.append("title", resolvedTitle);
    formData.append("isFree", "false");
    uploadMutation.mutate(formData);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setContentItems((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      const newOrder = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
        ...item,
        order: idx + 1,
      }));
      reorderMutation.mutate(newOrder);
      return newOrder;
    });
  }

  function getFileUrl(item: ContentItem) {
    const path = item.videoUrl || item.fileUrl || "";
    return path ? `${Config.imgUrl}${path}` : "";
  }

  // ---------------------------------------------------------------------------
  // Render: Content preview / viewer
  // ---------------------------------------------------------------------------

  if (viewingContent) {
    const fileUrl = getFileUrl(viewingContent);

    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setViewingContent(null)}>
          &larr; Back to Content List
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{viewingContent.title}</CardTitle>
              <Badge variant="outline" className="uppercase">
                {viewingContent.type}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Video */}
            {viewingContent.type === "video" && viewingContent.videoUrl && (
              <div className="space-y-4">
                <video
                  controls
                  className="w-full max-w-4xl rounded-lg shadow-lg"
                  src={fileUrl}
                >
                  Your browser does not support the video tag.
                </video>
                <p className="text-sm text-muted-foreground">
                  Video content - Use player controls to watch
                </p>
              </div>
            )}

            {/* YouTube */}
            {viewingContent.type === "youtube" && viewingContent.youtubeUrl && (
              <div className="space-y-4">
                <YouTubePlayer
                  videoUrl={viewingContent.youtubeUrl}
                  className="w-full max-w-4xl rounded-lg shadow-lg"
                />
                <p className="text-sm text-muted-foreground">
                  YouTube video - Use player controls to watch
                </p>
              </div>
            )}

            {/* PDF */}
            {viewingContent.type === "pdf" && viewingContent.fileUrl && (
              <div className="space-y-4">
                <iframe
                  src={fileUrl}
                  className="w-full h-[50vh] sm:h-[500px] md:h-[700px] border rounded-lg shadow-lg"
                  title={viewingContent.title}
                />
                <p className="text-sm text-muted-foreground">
                  PDF document - Scroll to read, use browser zoom if needed
                </p>
              </div>
            )}

            {/* PPT */}
            {viewingContent.type === "ppt" && viewingContent.fileUrl && (
              <div className="w-full max-w-5xl mx-auto">
                <PptViewer storageKey={viewingContent.fileUrl} title={viewingContent.title} />
              </div>
            )}

            {/* Activity */}
            {viewingContent.type === "activity" && viewingContent.fileUrl && (
              <div className="space-y-4">
                <iframe
                  src={`https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`}
                  className="w-full h-[50vh] sm:h-[500px] md:h-[700px] border rounded-lg shadow-lg"
                  title={viewingContent.title}
                />
                <p className="text-sm text-muted-foreground">
                  Activity document - View content in the viewer above
                </p>
              </div>
            )}

            {/* Rich Text */}
            {viewingContent.type === "text" && viewingContent.textContent && (
              <div className="space-y-4">
                <RichTextViewer
                  content={viewingContent.textContent}
                  className="border rounded-lg p-6"
                />
                <p className="text-sm text-muted-foreground">
                  Rich text / notes content
                </p>
              </div>
            )}

            {/* Quiz */}
            {viewingContent.type === "quiz" && viewingContent.questions && (
              <div className="space-y-4">
                <QuizViewer questions={viewingContent.questions} readOnly />
                <p className="text-sm text-muted-foreground">
                  Quiz - Review questions and answers above
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Main list + upload form
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Edit content dialog */}
      {editingContent && (
        <EditContentDialog
          item={editingContent}
          onClose={() => setEditingContent(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["chapter-content", chapterId] })}
        />
      )}
      {/* Content list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>Existing Content</CardTitle>
          {isSuperAdmin && (
            <Button
              variant="outline"
              className="gap-2 rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
              onClick={() => setShowAddForm((v) => !v)}
            >
              <Plus className="h-4 w-4" />
              Add Content
              <ChevronDown className={`h-4 w-4 transition-transform ${showAddForm ? "rotate-180" : ""}`} />
            </Button>
          )}
        </CardHeader>

        {/* Collapsible add form */}
        {isSuperAdmin && showAddForm && (
          <div className="px-6 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Content Type</label>
                <Select
                  value={type}
                  onValueChange={(value: string) => {
                    setType(value as ContentType);
                    setFile(null);
                    setYoutubeUrl("");
                    setTextContent("");
                    setQuestions([]);
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select content type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video Lecture</SelectItem>
                    <SelectItem value="youtube">YouTube Video</SelectItem>
                    <SelectItem value="ppt">PPT Slides</SelectItem>
                    <SelectItem value="pdf">PDF Notes</SelectItem>
                    <SelectItem value="activity">Activity Sheet</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="text">Rich Text / Notes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Title <span className="text-muted-foreground font-normal">(optional — auto-generated if left blank)</span>
                </label>
                <Input
                  placeholder={`e.g. ${chapterNumber}.${contentItems.length + 1} Introduction`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              {type === "youtube" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">YouTube URL</label>
                  <Input
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              )}

              {type === "text" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Content</label>
                  <RichTextEditor
                    content={textContent}
                    onChange={setTextContent}
                    placeholder="Write your notes or rich text content here..."
                  />
                </div>
              )}

              {type === "quiz" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quiz Questions</label>
                  <QuizBuilder questions={questions} onChange={setQuestions} />
                </div>
              )}

              {type !== "" && type !== "youtube" && type !== "text" && type !== "quiz" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">File</label>
                  {!file ? (
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-2xl p-8 text-center">
                      <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-lg mb-2">Drop your file here or click to browse</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Supports: MP4, PDF, PPT, DOC, ZIP (Max 100MB)
                      </p>
                      <input
                        type="file"
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-upload"
                        aria-label="Upload file"
                        accept=".mp4,.pdf,.ppt,.pptx,.doc,.docx,.zip,.webm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById("file-upload")?.click()}
                      >
                        Choose File
                      </Button>
                    </div>
                  ) : (
                    <div className="border rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-blue-600" />
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {type !== "" && (
                <div className="flex gap-3">
                  <Button onClick={handleUpload} disabled={uploadMutation.isPending} className="flex-1" size="lg">
                    {uploadMutation.isPending ? "Uploading..." : "Upload Content"}
                  </Button>
                  <Button variant="outline" size="lg" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <CardContent className="pt-4">
          {isLoading ? (
            <div className="text-center py-8">Loading content...</div>
          ) : contentItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No content added yet.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={contentItems.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {contentItems.map((item) => (
                    <SortableContentItem
                      key={item.id}
                      item={item}
                      chapterNumber={chapterNumber}
                      isSuperAdmin={!!isSuperAdmin}
                      onView={setViewingContent}
                      onDelete={(id) => deleteMutation.mutate(id)}
                      onOpenEditDialog={setEditingContent}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
