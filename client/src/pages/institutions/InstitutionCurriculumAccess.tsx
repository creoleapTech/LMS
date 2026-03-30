// src/pages/institutions/InstitutionCurriculumAccess.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { BookOpen, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { useAuthStore } from "@/store/userAuthStore";

interface Curriculum {
  _id: string;
  name: string;
}

interface GradeBook {
  _id: string;
  grade: number;
  bookTitle: string;
  subtitle?: string;
  coverImage?: string;
}

interface CurriculumAccess {
  curriculumId: { _id: string; name: string };
  accessibleGradeBooks: GradeBook[];
}

interface Props {
  institutionId: string;
}

export function InstitutionCurriculumAccess({ institutionId }: Props) {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === "super_admin";

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCurriculum, setSelectedCurriculum] = useState<string | null>(null);
  const [selectedGradeBooks, setSelectedGradeBooks] = useState<string[]>([]);

  const queryClient = useQueryClient();

  // Fetch assigned curriculums
  const { data: curriculumAccess = [], isLoading } = useQuery<CurriculumAccess[]>({
    queryKey: ["institution-curriculum-access", institutionId],
    queryFn: async () => {
      const res = await _axios.get(`/admin/institutions/${institutionId}/curriculum-access`);
      return res.data.data;
    },
  });

  // Fetch all curriculums for the "Add" dialog
  const { data: allCurriculums = [] } = useQuery<Curriculum[]>({
    queryKey: ["all-curriculums"],
    queryFn: async () => {
      const res = await _axios.get("/admin/curriculum");
      return res.data.data;
    },
  });

  // Fetch books for selected curriculum in dialog
  const { data: booksForSelectedCurriculum = [] } = useQuery<GradeBook[]>({
    queryKey: ["gradebooks-for-curriculum", selectedCurriculum],
    queryFn: async () => {
      if (!selectedCurriculum) return [];
       const res = await _axios.get(`/admin/curriculum/${selectedCurriculum}/grades`);
      return res.data.data;
    },
    enabled: !!selectedCurriculum,
  });

  // Add / Update curriculum access
  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCurriculum || selectedGradeBooks.length === 0) return;
      await _axios.post(`/admin/institutions/${institutionId}/curriculum-access`, {
        curriculumId: selectedCurriculum,
        gradeBookIds: selectedGradeBooks,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["institution-curriculum-access", institutionId] });
      setIsAddDialogOpen(false);
      setSelectedCurriculum(null);
      setSelectedGradeBooks([]);
      toast.success("Curriculum access added");
    },
  });

  // Remove whole curriculum access
  const removeMutation = useMutation({
    mutationFn: async (curriculumId: string) => {
      await _axios.delete(`/admin/institutions/${institutionId}/curriculum-access/${curriculumId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["institution-curriculum-access", institutionId] });
      toast.success("Curriculum access removed");
    },
  });

  // Toggle single book
  const toggleBookMutation = useMutation({
    mutationFn: async ({ curriculumId, gradeBookId }: { curriculumId: string; gradeBookId: string }) => {
      await _axios.patch(
        `/admin/institutions/${institutionId}/curriculum-access/${curriculumId}/toggle-book`,
        { gradeBookId }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["institution-curriculum-access", institutionId] });
      toast.success("Book access updated");
    },
    onError: () => {
      toast.error("Failed to update book access");
    },
  });

  // Separate component for additional books section
  const AdditionalBooksSection = ({ curriculumId }: { curriculumId: string }) => {
    const { data: allBooks = [] } = useQuery<GradeBook[]>({
      queryKey: ["gradebooks-for-curriculum", curriculumId],
      queryFn: async () => {
         const res = await _axios.get(`/admin/curriculum/${curriculumId}/grades`);
        return res.data.data;
      },
    });

    const accessItem = curriculumAccess.find(item => item.curriculumId._id === curriculumId);
    const enabledIds = accessItem?.accessibleGradeBooks.map((b) => b._id) || [];

    const disabledBooks = allBooks.filter((book) => !enabledIds.includes(book._id));

    if (disabledBooks.length === 0) {
      return (
        <p className="text-sm text-muted-foreground mt-2">All books are enabled for this curriculum.</p>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {disabledBooks.map((book) => (
          <div
            key={book._id}
            className="flex items-center justify-between p-4 border rounded-xl bg-gray-100 dark:bg-gray-900 opacity-70"
          >
            <div>
              <Badge variant="outline" className="mb-1">
                Grade {book.grade}
              </Badge>
              <p className="font-medium">{book.bookTitle}</p>
            </div>
            <Switch
              checked={false}
              onCheckedChange={() =>
                toggleBookMutation.mutate({
                  curriculumId,
                  gradeBookId: book._id,
                })
              }
              disabled={toggleBookMutation.isPending}
            />
          </div>
        ))}
      </div>
    );
  };

  if (!isSuperAdmin) {
    return <p>Only super admin can manage curriculum access.</p>;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent>
            <Loader2 className="h-8 w-8 animate-spin mx-auto my-8" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Add new curriculum button */}
      <div className="flex justify-end">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Assign Curriculum
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle>Assign Curriculum & Select Books</DialogTitle>
            </DialogHeader>

            {/* Curriculum selector */}
            <div className="space-y-4">
              <div>
                <label htmlFor="curriculum-select" className="text-sm font-medium">Curriculum</label>
                <select
                  id="curriculum-select"
                  aria-label="Select curriculum"
                  className="w-full mt-1 rounded-xl border px-3 py-2"
                  value={selectedCurriculum || ""}
                  onChange={(e) => {
                    setSelectedCurriculum(e.target.value);
                    setSelectedGradeBooks([]);
                  }}
                >
                  <option value="">-- Select Curriculum --</option>
                  {allCurriculums.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Grade books for selected curriculum */}
              {selectedCurriculum && (
                <div>
                  <label className="text-sm font-medium">Select Books to Enable</label>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {booksForSelectedCurriculum.map((book) => (
                      <label
                        key={book._id}
                        className="flex items-center space-x-3 p-3 border rounded-xl hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedGradeBooks.includes(book._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedGradeBooks([...selectedGradeBooks, book._id]);
                            } else {
                              setSelectedGradeBooks(selectedGradeBooks.filter((id) => id !== book._id));
                            }
                          }}
                        />
                        <div>
                          <p className="font-medium">
                            Grade {book.grade} - {book.bookTitle}
                          </p>
                          {book.subtitle && <p className="text-sm text-muted-foreground">{book.subtitle}</p>}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  onClick={() => addMutation.mutate()}
                  disabled={addMutation.isPending || !selectedCurriculum || selectedGradeBooks.length === 0}
                  className="rounded-xl"
                >
                  {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Access
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* List of assigned curriculums */}
      {curriculumAccess.length === 0 ? (
        <Card className="text-center py-12 rounded-2xl border-slate-200/80">
          <CardContent>
            <p className="text-muted-foreground mb-4">No curriculum access assigned yet.</p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Assign First Curriculum
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {curriculumAccess.map((access) => (
            <Card key={access.curriculumId._id} className="rounded-2xl border-slate-200/80">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 min-w-0">
                  <BookOpen className="h-5 w-5 shrink-0" />
                  {access.curriculumId.name}
                </CardTitle>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeMutation.mutate(access.curriculumId._id)}
                  disabled={removeMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Access
                </Button>
              </CardHeader>
              <CardContent>
                <h4 className="text-sm font-medium mb-4">Enabled Books</h4>
                {access.accessibleGradeBooks.length === 0 ? (
                  <p className="text-muted-foreground">No books enabled yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {access.accessibleGradeBooks.map((book) => (
                      <div
                        key={book._id}
                        className="flex items-center justify-between p-4 border rounded-xl bg-slate-50 dark:bg-slate-800"
                      >
                        <div>
                          <Badge variant="secondary" className="mb-1">
                            Grade {book.grade}
                          </Badge>
                          <p className="font-medium">{book.bookTitle}</p>
                          {book.subtitle && <p className="text-xs text-muted-foreground">{book.subtitle}</p>}
                        </div>

                        {/* Toggle Switch */}
                        <Switch
                          checked={true}
                          onCheckedChange={() =>
                            toggleBookMutation.mutate({
                              curriculumId: access.curriculumId._id,
                              gradeBookId: book._id,
                            })
                          }
                          disabled={toggleBookMutation.isPending}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Show all available books of this curriculum with switches to enable missing ones */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium mb-3">Add / Enable More Books</h4>
                  <AdditionalBooksSection curriculumId={access.curriculumId._id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}