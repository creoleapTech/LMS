"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, UsersRound, Search, Crown } from "lucide-react";
import { _axios } from "@/lib/axios";
import type { IGroup, CreateGroupDTO } from "@/types/group";
import type { IClass } from "@/types/class";
import type { IStudent } from "@/types/student";
import { getGroupClassId, getGroupLeaderId } from "@/types/group";

const formSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(100, "Group name too long"),
  description: z.string().trim().max(500, "Description too long").optional().or(z.literal("")),
  classId: z.string().min(1, "Class-section is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: IGroup | null;
  institutionId: string;
  classes: IClass[];
  defaultClassId?: string;
  onSave: (data: CreateGroupDTO) => Promise<void>;
}

export function GroupFormDialog({ open, onOpenChange, group, institutionId, classes, defaultClassId, onSave }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "", classId: "" },
  });

  const selectedClassId = watch("classId");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [selectedLeaderId, setSelectedLeaderId] = useState<string>("");
  const [studentSearch, setStudentSearch] = useState("");

  useEffect(() => {
    if (open) {
      if (group) {
        reset({
          name: group.name,
          description: group.description || "",
          classId: getGroupClassId(group),
        });
        setSelectedStudentIds(new Set((group.members ?? []).map((m) => m._id)));
        setSelectedLeaderId(getGroupLeaderId(group));
      } else {
        reset({ name: "", description: "", classId: defaultClassId || "" });
        setSelectedStudentIds(new Set());
        setSelectedLeaderId("");
      }
      setStudentSearch("");
    }
  }, [group, reset, open, defaultClassId]);

  // Students of the selected class-section
  const { data: classStudents = [], isLoading: studentsLoading } = useQuery<IStudent[]>({
    queryKey: ["group-class-students", institutionId, selectedClassId],
    queryFn: async () => {
      const { data } = await _axios.get("/admin/students", {
        params: { institutionId, classId: selectedClassId, limit: 100, page: 1 },
      });
      return data?.data ?? [];
    },
    enabled: open && !!selectedClassId && !!institutionId,
    staleTime: 30 * 1000,
  });

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return classStudents;
    return classStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.rollNumber || "").toLowerCase().includes(q) ||
        (s.admissionNumber || "").toLowerCase().includes(q),
    );
  }, [classStudents, studentSearch]);

  const syncLeaderWithSelection = (next: Set<string>) => {
    // A leader must stay one of the assigned students
    setSelectedLeaderId((prev) => (prev && next.has(prev) ? prev : ""));
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      syncLeaderWithSelection(next);
      return next;
    });
  };

  const toggleAll = () => {
    if (filteredStudents.every((s) => selectedStudentIds.has(s._id))) {
      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        filteredStudents.forEach((s) => next.delete(s._id));
        syncLeaderWithSelection(next);
        return next;
      });
    } else {
      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        filteredStudents.forEach((s) => next.add(s._id));
        return next;
      });
    }
  };

  // Selected students with names (for the leader picker).
  // Falls back to the group's existing members for ids missing from the class list.
  const selectedStudents = useMemo(() => {
    const byId = new Map<string, { _id: string; name: string; rollNumber?: string }>();
    for (const s of classStudents) {
      byId.set(s._id, { _id: s._id, name: s.name, rollNumber: s.rollNumber || s.username });
    }
    for (const m of group?.members ?? []) {
      if (!byId.has(m._id)) byId.set(m._id, { _id: m._id, name: m.name, rollNumber: m.rollNumber });
    }
    return Array.from(selectedStudentIds)
      .map((id) => byId.get(id))
      .filter((s): s is { _id: string; name: string; rollNumber?: string } => !!s)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [classStudents, group, selectedStudentIds]);

  const activeClasses = useMemo(
    () =>
      [...classes]
        .filter((c) => c.isActive)
        .sort((a, b) => {
          const ga = Number(a.grade) || 0;
          const gb = Number(b.grade) || 0;
          if (ga !== gb) return ga - gb;
          return a.section.localeCompare(b.section);
        }),
    [classes],
  );

  const onSubmit = async (values: FormValues) => {
    await onSave({
      name: values.name.trim(),
      description: values.description?.trim() || "",
      classId: values.classId,
      institutionId,
      studentIds: Array.from(selectedStudentIds),
      leaderId: selectedLeaderId || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto rounded-2xl p-0">
        <div className="sticky top-0 z-10 bg-[var(--neo-bg)] border-b border-white/30 px-6 pt-6 pb-4 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 shrink-0">
              <UsersRound className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold leading-tight">
                {group ? "Edit Group" : "Create Group"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                {group
                  ? "Update the group and its assigned students."
                  : "Create a group inside a class-section and assign students."}
              </DialogDescription>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 pt-4 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="group-name" className="text-sm font-medium">
                Group Name <span className="text-destructive">*</span>
              </Label>
              <Input id="group-name" placeholder="e.g. Group A, Red House, Team 1" maxLength={100} {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Class-Section <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedClassId || ""}
                onValueChange={(val) => {
                  setValue("classId", val, { shouldValidate: true });
                  // Clear selection when class changes (students belong to one class only)
                  if (!group || getGroupClassId(group) !== val) {
                    setSelectedStudentIds(new Set());
                    setSelectedLeaderId("");
                  }
                }}
                disabled={!!group}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select class-section" />
                </SelectTrigger>
                <SelectContent>
                  {activeClasses.map((cls) => (
                    <SelectItem key={cls._id} value={cls._id}>
                      Grade {cls.grade} – {cls.section} ({cls.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {group && (
                <p className="text-[11px] text-muted-foreground">Class cannot be changed after creation.</p>
              )}
              {errors.classId && <p className="text-xs text-destructive">{errors.classId.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="group-desc" className="text-sm font-medium">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input id="group-desc" placeholder="Short note about this group" maxLength={500} {...register("description")} />
          </div>

          {/* Student picker */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Assign Students{" "}
                <Badge variant="secondary" className="ml-1">
                  {selectedStudentIds.size} selected
                </Badge>
              </Label>
              {filteredStudents.length > 0 && (
                <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={toggleAll}>
                  {filteredStudents.every((s) => selectedStudentIds.has(s._id)) ? "Deselect all" : "Select all"}
                </Button>
              )}
            </div>

            {!selectedClassId ? (
              <p className="text-sm text-muted-foreground border border-dashed rounded-xl px-4 py-6 text-center">
                Select a class-section first to see its students.
              </p>
            ) : studentsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : classStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground border border-dashed rounded-xl px-4 py-6 text-center">
                No students found in this class-section.
              </p>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search students by name or roll number..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="pl-10 rounded-xl"
                  />
                </div>
                <div className="border rounded-xl max-h-64 overflow-y-auto divide-y">
                  {filteredStudents.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-4 py-6 text-center">No matching students.</p>
                  ) : (
                    filteredStudents.map((s) => {
                      const checked = selectedStudentIds.has(s._id);
                      return (
                        <label
                          key={s._id}
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${checked ? "bg-violet-50/60" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleStudent(s._id)}
                            className="h-4 w-4 accent-violet-600 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{s.name}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">
                              {s.rollNumber || s.username || ""} {s.admissionNumber ? `· ${s.admissionNumber}` : ""}
                            </p>
                          </div>
                          {checked && (
                            <Badge variant="outline" className="text-violet-600 border-violet-300 shrink-0">
                              Added
                            </Badge>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* Group leader picker */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Crown className="h-4 w-4 text-amber-500" />
              Group Leader <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Select
              value={selectedLeaderId || "none"}
              onValueChange={(val) => setSelectedLeaderId(val === "none" ? "" : val)}
              disabled={selectedStudents.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={selectedStudents.length === 0 ? "Assign students first" : "Select a leader"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No leader</SelectItem>
                {selectedStudents.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.name} {s.rollNumber ? `(${s.rollNumber})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              The leader must be one of the assigned students above.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t border-white/20">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {group ? "Update Group" : "Create Group"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
