// src/components/curriculum/CurriculumTable.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2, Plus, Search, Eye } from "lucide-react";
import { CurriculumFormDialog } from "./CurriculumFormDialog";
import { toast } from "sonner";
import { useAuthStore } from "@/store/userAuthStore";

type Curriculum = {
  _id: string;
  name: string;
  level: string[] | string;
  grades: number[];
  isPublished: boolean;
};

interface Props {
  onSelectCurriculum?: (curriculumId: string) => void;
}

export function CurriculumTable({ onSelectCurriculum }: Props = {}) {
  const [openForm, setOpenForm] = useState(false);
  const [editingCurriculum, setEditingCurriculum] = useState<Curriculum | null>(null);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | "Beginner" | "Intermediate" | "Advanced">("all");

  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';


  const { data: curriculums = [] } = useQuery<Curriculum[]>({
    queryKey: ["curriculums", search, levelFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (levelFilter !== "all") params.append("level", levelFilter);
      const res = await _axios.get(`/admin/curriculum?${params}`);
      return res.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => _axios.delete(`/admin/curriculum/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["curriculums"] });
      toast.success("Curriculum deleted");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end items-center">
        {/* <h1 className="text-3xl font-bold">Curriculum Management</h1> */}
        {isSuperAdmin && (
          <Button onClick={() => { setEditingCurriculum(null); setOpenForm(true); }}>
            <Plus className="mr-2 h-4 w-4" /> New Curriculum
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search curriculum..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as any)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="Beginner">Beginner</SelectItem>
            <SelectItem value="Intermediate">Intermediate</SelectItem>
            <SelectItem value="Advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Grades</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {curriculums.map((c) => (
              <TableRow key={c._id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {Array.isArray(c.level) ? c.level.join(", ") : c.level}
                  </Badge>
                </TableCell>
                <TableCell>{c.grades.join(", ")}</TableCell>
                <TableCell>
                  <Badge variant={c.isPublished ? "default" : "secondary"}>
                    {c.isPublished ? "Published" : "Draft"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {onSelectCurriculum && (
                    <Button size="sm" variant="ghost" onClick={() => onSelectCurriculum(c._id)} title="View Grade Books">
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  {isSuperAdmin && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingCurriculum(c); setOpenForm(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(c._id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>

      <CurriculumFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        curriculum={editingCurriculum}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["curriculums"] })}
      />
    </div>
  );
}