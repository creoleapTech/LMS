// src/components/curriculum/ChapterManager.tsx
"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GripVertical, Plus, Edit, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { UnifiedChapterFormDialog } from "./UnifiedChapterFormDialog";
import { PremiumChapterCard } from "./PremiumChapterCard";

interface Chapter {
  _id: string;
  title: string;
  chapterNumber: number;
  order: number;
  description?: string;
}

interface Props {
  gradeBookId: string;
  onChapterSelect: (chapterId: string) => void;
}


function SortableChapter({
  chapter,
  onView,
  onEdit,
  onDelete
}: {
  chapter: Chapter;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chapter._id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <PremiumChapterCard
        chapter={chapter}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        draggable={true}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

import { useAuthStore } from "@/store/userAuthStore";

export function ChapterManager({ gradeBookId, onChapterSelect }: Props) {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === "super_admin";
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);

  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  const { data: chaptersData = [], isLoading, error } = useQuery<Chapter[]>({
    queryKey: ["chapters", gradeBookId],
    queryFn: async () => {
      const res = await _axios.get(`/admin/curriculum/gradebook/${gradeBookId}/chapters`);
      return res.data.data || [];
    },
    enabled: !!gradeBookId,
  });

  useEffect(() => {
    setChapters(chaptersData);
  }, [chaptersData]);

  const reorderMutation = useMutation({
    mutationFn: async (reorderedChapters: Chapter[]) => {
      const orderData = reorderedChapters.map((chapter, index) => ({
        chapterId: chapter._id,
        order: index + 1
      }));

      await _axios.post(`/admin/curriculum/gradebook/${gradeBookId}/chapters/reorder`, {
        order: orderData
      });
    },
    onSuccess: () => {
      toast.success("Chapters reordered successfully");
      queryClient.invalidateQueries({ queryKey: ["chapters", gradeBookId] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to reorder chapters");
      queryClient.invalidateQueries({ queryKey: ["chapters", gradeBookId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (chapterId: string) =>
      _axios.delete(`/admin/curriculum/chapters/${chapterId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters", gradeBookId] });
      toast.success("Chapter deleted successfully");
    },
  });

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    setChapters((items) => {
      const oldIndex = items.findIndex((item) => item._id === active.id);
      const newIndex = items.findIndex((item) => item._id === over.id);

      const newOrder = arrayMove(items, oldIndex, newIndex);
      reorderMutation.mutate(newOrder);

      return newOrder;
    });
  };

  const handleDelete = (chapterId: string) => {
    if (confirm("Are you sure you want to delete this chapter?")) {
      deleteMutation.mutate(chapterId);
    }
  };

  const handleEdit = (chapter: Chapter) => {
    setEditingChapter(chapter);
    setOpenForm(true);
  };

  if (isLoading) return <div className="text-center py-8">Loading chapters...</div>;

  if (error) return <div className="text-center py-8 text-red-500">Error loading chapters</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Chapters</h3>
        {isSuperAdmin && (
          <Button onClick={() => { setEditingChapter(null); setOpenForm(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Chapter
          </Button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={chapters.map((c) => c._id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {chapters.map((chapter) => (
              <SortableChapter
                key={chapter._id}
                chapter={chapter}
                onView={() => onChapterSelect(chapter._id)}
                onEdit={isSuperAdmin ? () => handleEdit(chapter) : undefined as any}
                onDelete={isSuperAdmin ? () => handleDelete(chapter._id) : undefined as any}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {chapters.length === 0 && (
        <Card className="text-center py-12 rounded-2xl border-slate-200/80">
          <p className="text-muted-foreground">No chapters found</p>
          {isSuperAdmin && (
            <Button
              className="mt-4"
              onClick={() => { setEditingChapter(null); setOpenForm(true); }}
            >
              <Plus className="mr-2 h-4 w-4" /> Create First Chapter
            </Button>
          )}
        </Card>
      )}

      <UnifiedChapterFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        gradeBookId={gradeBookId}
        chapter={editingChapter}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["chapters", gradeBookId] })}
      />
    </div>
  );
}
