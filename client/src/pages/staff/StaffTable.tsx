// src/components/staff/StaffTable.tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  getSortedRowModel,
  type SortingState,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Pencil, Trash2, Plus, User, Search, ArrowUpDown, Loader2, KeyRound } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { StaffFormDialog } from "./StaffFormDialog";
import { _axios } from "@/lib/axios";
import type { IStaff, CreateStaffDTO, UpdateStaffDTO } from "@/types/staff";

const columnHelper = createColumnHelper<IStaff>();

interface Props {
  institutionId: string;
  institutionName: string;
}

export function StaffTable({ institutionId, institutionName }: Props) {
  const [openForm, setOpenForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<IStaff | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter states
  const [globalFilter, setGlobalFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sorting, setSorting] = useState<SortingState>([]);

  const queryClient = useQueryClient();

  // Fetch Staff
  const { data: staffs = [], isLoading } = useQuery<IStaff[]>({
    queryKey: ["staff", institutionId],
    queryFn: async () => {
      const { data } = await _axios.get<{ success: boolean; data: IStaff[] }>("/admin/staff", {
        params: { institutionId },
      });
      return data.data;
    },
    enabled: !!institutionId,
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateStaffDTO) => {
      const { data: res } = await _axios.post<{ success: boolean; data: IStaff }>("/admin/staff", {
        ...data,
        institutionId,
      });
      return res.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["staff", institutionId] });
      toast.success("Staff added successfully");

      if (data?.data?.password) {
        // Show the generated password in a persistent toast or dialog
        toast.message("Staff Created", {
          description: `Password: ${data.data.password} (Please copy this now)`,
          duration: 10000,
          action: {
            label: "Copy",
            onClick: () => navigator.clipboard.writeText(data.data.password),
          },
        });
      }

      setOpenForm(false);
      setEditingStaff(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to add staff");
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateStaffDTO }) => {
      const { data: res } = await _axios.patch<{ success: boolean; data: IStaff }>(`/admin/staff/${id}`, {
        ...data,
        institutionId,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", institutionId] });
      toast.success("Staff updated successfully");
      setOpenForm(false);
      setEditingStaff(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to update staff");
    },
  });

  // Reset Password Mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await _axios.patch<{ success: boolean; data: any }>(`/admin/staff/${id}/reset-password`);
      return data.data;
    },
    onSuccess: (data: any) => {
      if (data?.newPassword) {
        toast.message("Password Reset Successful", {
          description: `New Password: ${data.newPassword} (Please copy this now)`,
          duration: 10000,
          action: {
            label: "Copy",
            onClick: () => navigator.clipboard.writeText(data.newPassword),
          },
        });
      } else {
        toast.success("Password reset successfully");
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to reset password");
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await _axios.delete<{ success: boolean; message: string }>(`/admin/staff/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", institutionId] });
      toast.success("Staff removed");
      setDeletingId(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to delete staff");
    },
  });

  const handleEdit = useCallback((staff: IStaff) => {
    setEditingStaff(staff);
    setOpenForm(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditingStaff(null);
    setOpenForm(true);
  }, []);

  const handleSave = async (data: CreateStaffDTO) => {
    if (editingStaff) {
      updateMutation.mutate({ id: editingStaff._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (deletingId) {
      deleteMutation.mutate(deletingId);
    }
  };

  const handleResetPassword = (id: string) => {
    if (window.confirm("Are you sure you want to reset the password for this staff member? This will generate a new random password.")) {
      resetPasswordMutation.mutate(id);
    }
  };

  // Extract unique subjects for filter - reusing "departmentFilter" logic for subjects maybe?
  // Since we don't have "department", filtering by subjects might be complex as it's an array.
  // For now let's just stick to Role filter or simplify.

  const columns = [
    columnHelper.accessor("name", {
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Name <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
    }),
    columnHelper.accessor("email", { header: "Email" }),
    columnHelper.accessor("mobileNumber", { header: "Mobile" }),
    columnHelper.accessor("type", {
      header: "Role",
      cell: info => <Badge variant="secondary" className="capitalize">{info.getValue()}</Badge>,
    }),
    columnHelper.accessor("subjects", {
      header: "Subjects",
      cell: info => {
        const subjects = info.getValue();
        return subjects && subjects.length > 0 ? subjects.join(", ") : <span className="text-muted-foreground">-</span>;
      },
    }),
    columnHelper.accessor("joiningDate", {
      header: "Joined On",
      cell: info => new Date(info.getValue()).toLocaleDateString("en-IN"),
    }),
    columnHelper.display({
      id: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={row.original.isActive}
            onCheckedChange={(val) => updateMutation.mutate({ id: row.original._id, data: { isActive: val } as any })}
          />
          <span className="text-xs text-muted-foreground w-12">{row.original.isActive ? "Active" : "Inactive"}</span>
        </div>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleResetPassword(row.original._id)}>
            <KeyRound className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeletingId(row.original._id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    }),
  ];

  const filteredData = useMemo(() => {
    let filtered = staffs;

    if (typeFilter !== "all") {
      filtered = filtered.filter(s => s.type === typeFilter);
    }
    // Simple subject filter? Or maybe remove department filter for now since it's subjects[]
    // If we want to filter by subject, we'd need a multi-select or check if array includes.

    return filtered;
  }, [staffs, typeFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      globalFilter,
      sorting,
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    globalFilterFn: "includesString",
  });

  return (
    <>
      <div className="container mx-auto py-2 px-4 max-w-7xl">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <User className="h-8 w-8" />
                Staff Members
              </h1>
              <p className="text-muted-foreground">Managing staff for <strong>{institutionName}</strong></p>
            </div>
            <Button onClick={handleCreate} className="bg-brand-color hover:bg-brand-color/90">
              <Plus className="mr-2 h-4 w-4" /> Add Staff
            </Button>
          </div>

          {/* Filters Card */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search name, email, mobile..."
                  value={globalFilter ?? ""}
                  onChange={e => setGlobalFilter(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>

              {/* Removed Department Filter for now as it's not strictly in schema as a single field */}
              {/* Could replace with something else later */}

              <Button
                variant="outline"
                onClick={() => {
                  setGlobalFilter("");
                  setTypeFilter("all");
                }}
              >
                Clear Filters
              </Button>
            </div>
          </Card>

          {/* Results Count & Table */}
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="text-sm text-muted-foreground">
                Showing {table.getRowModel().rows.length} of {staffs.length} staff members
              </div>

              <div className="rounded-md border bg-card">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map(headerGroup => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map(header => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.length ? (
                      table.getRowModel().rows.map(row => (
                        <TableRow key={row.id}>
                          {row.getVisibleCells().map(cell => (
                            <TableCell key={cell.id}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                          No staff found matching your filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <StaffFormDialog open={openForm} onOpenChange={setOpenForm} staff={editingStaff} onSave={handleSave} />

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Staff?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this staff member? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
