// src/components/curriculum/GradeBookManager.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { GradeBookFormDialog } from "./GradeBookFormDialog";
import { PremiumGradeBookCard } from "./PremiumGradeBookCard";

interface GradeBook {
  id: string;
  grade: number;
  bookTitle: string;
  subtitle?: string;
  description?: string;
  coverImage?: string;
  isPublished: boolean;
  curriculumId: string;
}

interface Props {
  curriculumId: string;
  onGradeSelect: (gradeBookId: string) => void;
}

import { useAuthStore } from "@/store/userAuthStore";

export function GradeBookManager({ curriculumId, onGradeSelect }: Props) {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === "super_admin";
  const [openForm, setOpenForm] = useState(false);
  const [editingGradeBook, setEditingGradeBook] = useState<GradeBook | null>(null);

  const queryClient = useQueryClient();

  const { data: gradeBooks = [], isLoading, error } = useQuery<GradeBook[]>({
    queryKey: ["gradebooks", curriculumId],
    queryFn: async () => {
      const res = await _axios.get(`/admin/curriculum/${curriculumId}/grades`);
      return res.data.data || [];
    },
    enabled: !!curriculumId,
  });

  const deleteMutation = useMutation({
    mutationFn: (gradeBookId: string) =>
      _axios.delete(`/admin/curriculum/gradebook/${gradeBookId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gradebooks", curriculumId] });
      toast.success("Grade book deleted successfully");
    },
  });

  const handleDelete = (gradeBookId: string) => {
    if (confirm("Are you sure you want to delete this grade book?")) {
      deleteMutation.mutate(gradeBookId);
    }
  };

  const handleEdit = (gradeBook: GradeBook) => {
    setEditingGradeBook(gradeBook);
    setOpenForm(true);
  };

  if (isLoading) return <div className="text-center py-8">Loading grade books...</div>;

  if (error) return <div className="text-center py-8 text-red-500">Error loading grade books</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Grade Books</h3>
        {isSuperAdmin && (
          <Button onClick={() => { setEditingGradeBook(null); setOpenForm(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Grade Book
          </Button>
        )}
      </div>

      {gradeBooks.length === 0 ? (
        <Card className="text-center py-12 rounded-2xl border-slate-200/80">
          <CardContent>
            <p className="text-muted-foreground mb-4">No grade books found</p>
            {isSuperAdmin && (
              <Button onClick={() => { setEditingGradeBook(null); setOpenForm(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Create First Grade Book
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gradeBooks.map((gradeBook) => (
            <PremiumGradeBookCard
              key={gradeBook.id}
              gradeBook={gradeBook}
              onView={() => onGradeSelect(gradeBook.id)}
              onEdit={isSuperAdmin ? () => handleEdit(gradeBook) : undefined}
              onDelete={isSuperAdmin ? () => handleDelete(gradeBook.id) : undefined}
            />
          ))}
        </div>
      )}

      <GradeBookFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        curriculumId={curriculumId}
        gradeBook={editingGradeBook}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["gradebooks", curriculumId] })}
      />
    </div>
  );
}