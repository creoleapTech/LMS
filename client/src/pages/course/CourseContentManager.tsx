"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BookOpen, FileText, Video, File, Youtube, Plus, Pencil, Trash2,
  GripVertical, ChevronRight, Eye,
  AlignLeft, ListChecks, Hash,
} from "lucide-react";
import { toast } from "sonner";

type ContentType = "text" | "video" | "youtube" | "pdf" | "file";

interface ContentItem {
  id: string;
  title: string;
  type: ContentType;
  url?: string;
  textContent?: string;
  order: number;
}

interface Chapter {
  id: string;
  title: string;
  chapterNumber: number;
  description?: string;
  learningObjectives?: string;
  content: ContentItem[];
}

interface Props {
  courseId: string;
}

const emptyChapters: Chapter[] = [
  {
    id: "ch1", title: "Introduction & Overview", chapterNumber: 1,
    description: "Getting started with the course fundamentals",
    content: [
      { id: "c1", title: "Welcome Video", type: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", order: 1 },
      { id: "c2", title: "Course Handbook", type: "pdf", url: "#", order: 2 },
    ],
  },
  {
    id: "ch2", title: "Core Concepts", chapterNumber: 2,
    description: "Deep dive into essential topics",
    learningObjectives: "Understand the fundamental principles and apply them",
    content: [
      { id: "c3", title: "Lecture Notes", type: "text", textContent: "This is the core concepts lecture content.", order: 1 },
      { id: "c4", title: "Tutorial Video", type: "video", url: "#", order: 2 },
    ],
  },
];

const typeIcons: Record<ContentType, any> = {
  text: FileText, video: Video, youtube: Youtube, pdf: File, file: File,
};

const typeColors: Record<ContentType, string> = {
  text: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  video: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  youtube: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  pdf: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  file: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function CourseContentManager({ courseId: _courseId }: Props) {
  const [chapters, setChapters] = useState(emptyChapters);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [chapterDialogOpen, setChapterDialogOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterNumber, setChapterNumber] = useState(1);
  const [chapterDesc, setChapterDesc] = useState("");
  const [chapterObjectives, setChapterObjectives] = useState("");
  const [deletingChapterId, setDeletingChapterId] = useState<string | null>(null);

  const [contentDialogOpen, setContentDialogOpen] = useState(false);
  const [contentChapterId, setContentChapterId] = useState("");
  const [editingContent, setEditingContent] = useState<ContentItem | null>(null);
  const [contentTitle, setContentTitle] = useState("");
  const [contentType, setContentType] = useState<ContentType>("text");
  const [contentUrl, setContentUrl] = useState("");
  const [contentText, setContentText] = useState("");
  const [deletingContentId, setDeletingContentId] = useState<string | null>(null);

  const toggleChapter = (id: string) => {
    setExpandedChapter(prev => prev === id ? null : id);
  };

  const openNewChapter = () => {
    setEditingChapter(null);
    setChapterTitle("");
    setChapterNumber(chapters.length + 1);
    setChapterDesc("");
    setChapterObjectives("");
    setChapterDialogOpen(true);
  };

  const openEditChapter = (ch: Chapter) => {
    setEditingChapter(ch);
    setChapterTitle(ch.title);
    setChapterNumber(ch.chapterNumber);
    setChapterDesc(ch.description || "");
    setChapterObjectives(ch.learningObjectives || "");
    setChapterDialogOpen(true);
  };

  const saveChapter = () => {
    if (!chapterTitle.trim()) { toast.error("Title is required"); return; }
    if (editingChapter) {
      setChapters(prev => prev.map(ch =>
        ch.id === editingChapter.id
          ? { ...ch, title: chapterTitle, chapterNumber, description: chapterDesc, learningObjectives: chapterObjectives }
          : ch
      ));
      toast.success("Chapter updated");
    } else {
      const newCh: Chapter = {
        id: `ch${Date.now()}`, title: chapterTitle, chapterNumber, description: chapterDesc,
        learningObjectives: chapterObjectives, content: [],
      };
      setChapters(prev => [...prev, newCh]);
      toast.success("Chapter created");
    }
    setChapterDialogOpen(false);
  };

  const openNewContent = (chapterId: string) => {
    setEditingContent(null);
    setContentChapterId(chapterId);
    setContentTitle("");
    setContentType("text");
    setContentUrl("");
    setContentText("");
    setContentDialogOpen(true);
  };

  const openEditContent = (item: ContentItem, chapterId: string) => {
    setEditingContent(item);
    setContentChapterId(chapterId);
    setContentTitle(item.title);
    setContentType(item.type);
    setContentUrl(item.url || "");
    setContentText(item.textContent || "");
    setContentDialogOpen(true);
  };

  const saveContent = () => {
    if (!contentTitle.trim()) { toast.error("Title is required"); return; }
    if (editingContent) {
      setChapters(prev => prev.map(ch =>
        ch.id === contentChapterId
          ? {
              ...ch,
              content: ch.content.map(item =>
                item.id === editingContent.id
                  ? { ...item, title: contentTitle, type: contentType, url: contentUrl, textContent: contentText }
                  : item
              ),
            }
          : ch
      ));
      toast.success("Content updated");
    } else {
      const chapter = chapters.find(ch => ch.id === contentChapterId);
      const newItem: ContentItem = {
        id: `c${Date.now()}`, title: contentTitle, type: contentType,
        url: contentUrl || undefined, textContent: contentText || undefined,
        order: (chapter?.content.length || 0) + 1,
      };
      setChapters(prev => prev.map(ch =>
        ch.id === contentChapterId ? { ...ch, content: [...ch.content, newItem] } : ch
      ));
      toast.success("Content added");
    }
    setContentDialogOpen(false);
  };

  const hasChapters = chapters.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Course Content</h3>
          <p className="text-sm text-muted-foreground">
            {chapters.reduce((sum, ch) => sum + ch.content.length, 0)} items across {chapters.length} chapter{chapters.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" onClick={openNewChapter} className="rounded-xl">
          <Plus className="mr-1.5 h-4 w-4" /> Add Chapter
        </Button>
      </div>

      {!hasChapters ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-xl bg-card">
          <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <h3 className="font-semibold">No chapters yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Create chapters to organize your course content</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={openNewChapter}>
            <Plus className="mr-1.5 h-4 w-4" /> Create First Chapter
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {chapters.map(chapter => (
            <Card key={chapter.id} className="overflow-hidden">
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleChapter(chapter.id)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 shrink-0">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">Ch. {chapter.chapterNumber}</span>
                    <h4 className="font-medium text-sm truncate">{chapter.title}</h4>
                  </div>
                  {chapter.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{chapter.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground">{chapter.content.length} item{chapter.content.length !== 1 ? "s" : ""}</span>
                  <button onClick={(e) => { e.stopPropagation(); openEditChapter(chapter); }} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeletingChapterId(chapter.id); }} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                  {expandedChapter === chapter.id ? <ChevronRight className="h-4 w-4 text-muted-foreground rotate-90 transition-transform" /> : <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />}
                </div>
              </div>

              {expandedChapter === chapter.id && (
                <div className="border-t px-4 py-3 space-y-2 bg-muted/30">
                  {chapter.learningObjectives && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground pb-2 border-b">
                      <ListChecks className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{chapter.learningObjectives}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Content Items</span>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openNewContent(chapter.id)}>
                      <Plus className="h-3 w-3 mr-1" /> Add Content
                    </Button>
                  </div>

                  {chapter.content.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No content items yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {chapter.content.map(item => {
                        const TypeIcon = typeIcons[item.type];
                        return (
                          <div key={item.id} className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 cursor-grab" />
                            <div className={`flex h-7 w-7 items-center justify-center rounded-md ${typeColors[item.type]}`}>
                              <TypeIcon className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.title}</p>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase">{item.type}</Badge>
                                {item.url && <span className="text-[10px] text-muted-foreground truncate">{item.url}</span>}
                              </div>
                            </div>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEditContent(item, chapter.id)} className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted transition-colors">
                                <Eye className="h-3 w-3 text-muted-foreground" />
                              </button>
                              <button onClick={() => setDeletingContentId(item.id)} className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted transition-colors">
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={chapterDialogOpen} onOpenChange={setChapterDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingChapter ? "Edit Chapter" : "Create Chapter"}</DialogTitle>
            <DialogDescription>
              {editingChapter ? "Update chapter details and learning objectives" : "Add a new chapter to organize course content"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Chapter No. <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input type="number" min={1} value={chapterNumber} onChange={e => setChapterNumber(Number(e.target.value))} className="pl-8" />
                </div>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} placeholder="Introduction to Algebra" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <AlignLeft className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-sm font-medium">Description</Label>
              </div>
              <Textarea value={chapterDesc} onChange={e => setChapterDesc(e.target.value)} rows={2} placeholder="Brief description of this chapter..." />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-sm font-medium">Learning Objectives</Label>
              </div>
              <Textarea value={chapterObjectives} onChange={e => setChapterObjectives(e.target.value)} rows={2} placeholder="What students will learn..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChapterDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={saveChapter} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
              {editingChapter ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contentDialogOpen} onOpenChange={setContentDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContent ? "Edit Content" : "Add Content"}</DialogTitle>
            <DialogDescription>
              {editingContent ? "Update this content item" : "Add a new content item to the chapter"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input value={contentTitle} onChange={e => setContentTitle(e.target.value)} placeholder="e.g. Lecture Video 1" />
            </div>
            <div className="space-y-1.5">
              <Label>Type <span className="text-destructive">*</span></Label>
              <Select value={contentType} onValueChange={v => setContentType(v as ContentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text / Notes</SelectItem>
                  <SelectItem value="video">Video (Upload)</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="file">Other File</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {contentType !== "text" && (
              <div className="space-y-1.5">
                <Label>URL <span className="text-destructive">*</span></Label>
                <Input value={contentUrl} onChange={e => setContentUrl(e.target.value)} placeholder={contentType === "youtube" ? "https://youtube.com/watch?v=..." : "https://..."} />
              </div>
            )}
            {contentType === "text" && (
              <div className="space-y-1.5">
                <Label>Content</Label>
                <Textarea value={contentText} onChange={e => setContentText(e.target.value)} rows={4} placeholder="Write your content here..." />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContentDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={saveContent} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
              {editingContent ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingChapterId} onOpenChange={() => setDeletingChapterId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chapter?</AlertDialogTitle>
            <AlertDialogDescription>All content within this chapter will also be removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setChapters(prev => prev.filter(ch => ch.id !== deletingChapterId));
              setDeletingChapterId(null);
              if (expandedChapter === deletingChapterId) setExpandedChapter(null);
              toast.success("Chapter deleted");
            }} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingContentId} onOpenChange={() => setDeletingContentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Content?</AlertDialogTitle>
            <AlertDialogDescription>This content item will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setChapters(prev => prev.map(ch => ({
                ...ch,
                content: ch.content.filter(item => item.id !== deletingContentId),
              })));
              setDeletingContentId(null);
              toast.success("Content removed");
            }} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
