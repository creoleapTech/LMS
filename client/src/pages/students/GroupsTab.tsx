"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Plus, Search, Loader2, UsersRound, X, ChevronDown, ChevronUp, Crown } from "lucide-react";
import { toast } from "sonner";
import { _axios } from "@/lib/axios";
import { useAuthStore } from "@/store/userAuthStore";
import { GroupFormDialog } from "./GroupFormDialog";
import type { IGroup, CreateGroupDTO, UpdateGroupDTO } from "@/types/group";
import type { IClass } from "@/types/class";
import { getGroupClassLabel, getGroupLeaderId } from "@/types/group";

interface Props {
  institutionId: string;
}

export function GroupsTab({ institutionId }: Props) {
  const queryClient = useQueryClient();
  const userRole = useAuthStore((s) => s.user?.role);
  const canEdit = userRole === "super_admin" || userRole === "admin" || userRole === "teacher";

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [openForm, setOpenForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<IGroup | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Classes for filter + form
  const { data: classes = [] } = useQuery<IClass[]>({
    queryKey: ["classes", institutionId],
    queryFn: async () => {
      const { data } = await _axios.get<{ success: boolean; data: IClass[] }>("/admin/classes", {
        params: { institutionId, limit: 100 },
      });
      return data.data ?? [];
    },
    enabled: !!institutionId,
    staleTime: 2 * 60 * 1000,
  });

  // Groups
  const {
    data: groupsResponse,
    isLoading,
  } = useQuery<{ success: boolean; data: IGroup[]; pagination: { total: number } }>({
    queryKey: ["groups", institutionId, classFilter, search],
    queryFn: async () => {
      const { data } = await _axios.get("/admin/groups", {
        params: {
          institutionId,
          classId: classFilter !== "all" ? classFilter : undefined,
          search: search.trim() || undefined,
          limit: 100,
        },
      });
      return data;
    },
    enabled: !!institutionId,
    placeholderData: (prev) => prev,
  });

  const groups = useMemo(() => groupsResponse?.data ?? [], [groupsResponse]);
  const total = groupsResponse?.pagination?.total ?? groups.length;

  const classOptions = useMemo(
    () =>
      [...classes]
        .filter((c) => c.isActive)
        .map((c) => ({
          value: c._id,
          label: `Grade ${c.grade} – ${c.section}`,
          grade: Number(c.grade) || 0,
          section: c.section,
        }))
        .sort((a, b) => (a.grade !== b.grade ? a.grade - b.grade : a.section.localeCompare(b.section))),
    [classes],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["groups", institutionId] });
    queryClient.invalidateQueries({ queryKey: ["groups-for-class", institutionId] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: CreateGroupDTO) => {
      const { data: res } = await _axios.post("/admin/groups", { ...data, institutionId });
      return res.data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Group created successfully");
      setOpenForm(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || "Failed to create group");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateGroupDTO }) => {
      const { data: res } = await _axios.patch(`/admin/groups/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Group updated successfully");
      setOpenForm(false);
      setEditingGroup(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || "Failed to update group");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await _axios.delete(`/admin/groups/${id}`);
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Group deleted");
      setDeletingId(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || "Failed to delete group");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ groupId, studentId }: { groupId: string; studentId: string }) => {
      const { data } = await _axios.delete(`/admin/groups/${groupId}/members/${studentId}`);
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Student removed from group");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || "Failed to remove student");
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { data } = await _axios.patch(`/admin/groups/${id}`, { isActive: isActive ? 1 : 0 });
      return data;
    },
    onSuccess: () => invalidate(),
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || "Failed to update status");
    },
  });

  const setLeaderMutation = useMutation({
    mutationFn: async ({ groupId, studentId }: { groupId: string; studentId: string }) => {
      const { data } = await _axios.patch(`/admin/groups/${groupId}/leader`, { studentId });
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Group leader assigned");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || "Failed to assign leader");
    },
  });

  const clearLeaderMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const { data } = await _axios.delete(`/admin/groups/${groupId}/leader`);
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Group leader removed");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || "Failed to remove leader");
    },
  });

  const handleCreate = () => {
    setEditingGroup(null);
    setOpenForm(true);
  };

  const handleEdit = (group: IGroup) => {
    setEditingGroup(group);
    setOpenForm(true);
  };

  const handleSave = async (data: CreateGroupDTO) => {
    if (editingGroup) {
      await updateMutation.mutateAsync({
        id: editingGroup._id,
        data: { name: data.name, description: data.description, studentIds: data.studentIds, leaderId: data.leaderId ?? null },
      });
    } else {
      await createMutation.mutateAsync({ ...data, leaderId: data.leaderId || undefined });
    }
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <div className="flex flex-col gap-6 p-5 sm:p-8 max-w-screen-2xl mx-auto">
        <div className="flex justify-end">
          {canEdit && (
            <Button
              onClick={handleCreate}
              className="bg-brand-color hover:bg-brand-color/90 rounded-xl shadow-lg shadow-indigo-500/30"
            >
              <Plus className="mr-2 h-4 w-4" /> Add Group
            </Button>
          )}
        </div>

        <Card className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search groups..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-52 rounded-xl">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classOptions.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground whitespace-nowrap ml-auto">Total: {total}</span>
          </div>
        </Card>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed rounded-2xl">
            <UsersRound className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-medium">No groups yet</p>
            <p className="text-sm mt-1">
              {canEdit
                ? "Create a group inside a class-section and assign students to it."
                : "No groups have been created for this filter."}
            </p>
            {canEdit && (
              <Button onClick={handleCreate} variant="outline" className="mt-4 rounded-xl">
                <Plus className="mr-2 h-4 w-4" /> Create your first group
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {groups.map((group) => {
              const isOpen = expanded.has(group._id);
              const members = group.members ?? [];
              const visibleMembers = isOpen ? members : members.slice(0, 4);
              const leaderId = getGroupLeaderId(group);
              const leader = group.leader ?? members.find((m) => m._id === leaderId) ?? null;
              return (
                <Card key={group._id} className="p-5 flex flex-col gap-3 rounded-2xl">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700 font-bold shrink-0">
                          <UsersRound className="h-4 w-4" />
                        </div>
                        <h3 className="font-semibold text-base truncate" title={group.name}>
                          {group.name}
                        </h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <Badge variant="outline">{getGroupClassLabel(group) || "Class"}</Badge>
                        <Badge variant="secondary">
                          {group.memberCount ?? members.length} student{(group.memberCount ?? members.length) === 1 ? "" : "s"}
                        </Badge>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(group)} title="Edit group">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeletingId(group._id)}
                          title="Delete group"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {group.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2" title={group.description}>
                      {group.description}
                    </p>
                  )}

                  {leader && (
                    <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                      <Crown className="h-4 w-4 text-amber-500 fill-amber-200 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 leading-none">
                          Group Leader
                        </p>
                        <p className="text-sm font-semibold truncate mt-0.5" title={leader.name}>
                          {leader.name}
                        </p>
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => clearLeaderMutation.mutate(group._id)}
                          disabled={clearLeaderMutation.isPending}
                          className="p-1 rounded-md text-amber-500 hover:bg-amber-100 hover:text-amber-700 transition-colors shrink-0"
                          title="Remove leader"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={!!group.isActive}
                      disabled={!canEdit}
                      onCheckedChange={(val) => toggleStatusMutation.mutate({ id: group._id, isActive: val })}
                    />
                    <span className="text-muted-foreground text-xs w-14">{group.isActive ? "Active" : "Archived"}</span>
                    {members.length > 4 && (
                      <button
                        onClick={() => toggleExpanded(group._id)}
                        className="ml-auto text-xs font-medium text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        {isOpen ? (
                          <>
                            Show less <ChevronUp className="h-3 w-3" />
                          </>
                        ) : (
                          <>
                            +{members.length - 4} more <ChevronDown className="h-3 w-3" />
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="border-t pt-3 space-y-1.5">
                    {visibleMembers.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">No students assigned yet.</p>
                    ) : (
                      visibleMembers.map((m) => {
                        const isLeader = !!leaderId && m._id === leaderId;
                        return (
                          <div key={m._id} className="flex items-center gap-2 text-sm group/member">
                            <div
                              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isLeader ? "bg-amber-100 text-amber-700 ring-1 ring-amber-400" : "bg-indigo-100 text-indigo-700"}`}
                            >
                              {(m.name || "?").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-[13px] leading-tight flex items-center gap-1">
                                <span className="truncate">{m.name}</span>
                                {isLeader && <Crown className="h-3 w-3 text-amber-500 fill-amber-200 shrink-0" />}
                              </p>
                              {m.rollNumber && (
                                <p className="truncate text-[11px] text-muted-foreground font-mono leading-tight">{m.rollNumber}</p>
                              )}
                            </div>
                            {canEdit && !isLeader && (
                              <button
                                onClick={() => setLeaderMutation.mutate({ groupId: group._id, studentId: m._id })}
                                className="opacity-0 group-hover/member:opacity-100 hover:opacity-100 focus:opacity-100 transition-opacity p-1 rounded-md hover:bg-amber-50 text-muted-foreground hover:text-amber-600"
                                title={`Make ${m.name} leader`}
                              >
                                <Crown className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => removeMemberMutation.mutate({ groupId: group._id, studentId: m._id })}
                                className="opacity-0 group-hover/member:opacity-100 hover:opacity-100 focus:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-50 text-muted-foreground hover:text-destructive"
                                title={`Remove ${m.name}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <GroupFormDialog
        open={openForm}
        onOpenChange={(open) => {
          setOpenForm(open);
          if (!open) setEditingGroup(null);
        }}
        group={editingGroup}
        institutionId={institutionId}
        classes={classes}
        defaultClassId={classFilter !== "all" ? classFilter : undefined}
        onSave={handleSave}
      />

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this group? Students will remain in their class-section; only the group will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
