"use client";

import { useState, useDeferredValue, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Plus, Search, ArrowUpDown, Loader2, Upload, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { _axios } from "@/lib/axios";
import { StudentFormDialog } from "./StudentFormDialog";
import type { IStudent, CreateStudentDTO, UpdateStudentDTO } from "@/types/student";
import type { IClass } from "@/types/class";

const columnHelper = createColumnHelper<IStudent>();

interface Props {
  institutionId: string;
}

export function StudentTable({ institutionId }: Props) {
  const [openForm, setOpenForm] = useState(false);
  const [openBulkUpload, setOpenBulkUpload] = useState(false);
  const [editingStudent, setEditingStudent] = useState<IStudent | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const queryClient = useQueryClient();
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadErrors, setUploadErrors] = useState<any[]>([]);
  const [uploadSummary, setUploadSummary] = useState<any>(null);
  const [previewData, setPreviewData] = useState<{
    rows: any[];
    duplicates: { inFile: number[]; inDatabase: number[] };
    summary: any;
  } | null>(null);
  const [selectedForImport, setSelectedForImport] = useState<Set<number>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);
  const [openRollUpdate, setOpenRollUpdate] = useState(false);
  const [rollUpdateFile, setRollUpdateFile] = useState<File | null>(null);
  const [rollUpdatePreview, setRollUpdatePreview] = useState<any>(null);
  const [rollUpdateLoading, setRollUpdateLoading] = useState(false);
  const [rollUpdateConfirming, setRollUpdateConfirming] = useState(false);
  const [addNotFoundStudents, setAddNotFoundStudents] = useState<Set<number>>(new Set());
  const [ambiguousSelections, setAmbiguousSelections] = useState<Record<number, string>>({});
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Fetch Classes for logic and mapping
  const { data: classes = [] } = useQuery<IClass[]>({
    queryKey: ["classes", institutionId],
    queryFn: async () => {
      const { data } = await _axios.get<{ success: boolean; data: IClass[] }>("/admin/classes", {
        params: { institutionId },
      });
      return data.data;
    },
    enabled: !!institutionId,
  });

  const deferredSearch = useDeferredValue(globalFilter);
  const classFilterValue = columnFilters.find((f) => f.id === "classId")?.value as string | undefined;

  const { data: studentData, isLoading } = useQuery<{ success: boolean; data: IStudent[]; pagination: { total: number; page: number; limit: number; pages: number } }>({
    queryKey: ["students", institutionId, page, pageSize, deferredSearch, classFilterValue],
    queryFn: async () => {
      const { data } = await _axios.get("/admin/students", {
        params: {
          institutionId,
          page,
          limit: pageSize,
          search: deferredSearch || undefined,
          classId: classFilterValue || undefined,
        },
      });
      return data;
    },
    enabled: !!institutionId,
    placeholderData: (previousData) => previousData,
  });

  const students = studentData?.data || [];
  const paginationMeta = studentData?.pagination;

  // Reset to page 1 when search or class filter changes
  useEffect(() => {
    setPage(1);
  }, [deferredSearch, classFilterValue]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateStudentDTO) => {
      const { data: res } = await _axios.post<{ success: boolean; data: IStudent }>("/admin/students", {
        ...data,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", institutionId] });
      queryClient.invalidateQueries({ queryKey: ["classes", institutionId] });
      toast.success("Student added successfully");
      setOpenForm(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to add student");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateStudentDTO }) => {
      const { data: res } = await _axios.patch<{ success: boolean; data: IStudent }>(`/admin/students/${id}`, {
        ...data,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", institutionId] });
      toast.success("Student updated successfully");
      setOpenForm(false);
      setEditingStudent(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to update student");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await _axios.delete<{ success: boolean; message: string }>(`/admin/students/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", institutionId] });
      queryClient.invalidateQueries({ queryKey: ["classes", institutionId] });
      toast.success("Student removed");
      setDeletingId(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to delete student");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data } = await _axios.post<{ success: boolean; message: string; blocked: { id: string; name: string }[] }>("/admin/students/bulk-delete", { ids });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["students", institutionId] });
      queryClient.invalidateQueries({ queryKey: ["classes", institutionId] });
      if (data.blocked?.length > 0) {
        toast.warning(`${data.message}. ${data.blocked.length} student(s) skipped (have assessments).`);
      } else {
        toast.success(data.message);
      }
      setSelectedStudentIds(new Set());
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to delete students");
    },
  });

  const handleCreate = () => {
    setEditingStudent(null);
    setOpenForm(true);
  };

  const handleEdit = (student: IStudent) => {
    setEditingStudent(student);
    setOpenForm(true);
  };

  const handleSave = async (data: CreateStudentDTO) => {
    if (editingStudent) {
      updateMutation.mutate({ id: editingStudent._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", bulkFile);
      formData.append("institutionId", institutionId);

      const res = await _axios.post("/admin/students/bulk-upload", formData, {
        onUploadProgress: (progressEvent: any) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
      });

      const responseData = res.data;

      if (responseData.preview) {
        setPreviewData(responseData);
        const duplicateIds = new Set([
          ...(responseData.duplicates?.inFile || []),
          ...(responseData.duplicates?.inDatabase || []),
        ]);
        const autoSelected = responseData.rows
          .filter((r: any) => !duplicateIds.has(r._rowNumber))
          .map((r: any) => r._rowNumber);
        setSelectedForImport(new Set(autoSelected));
        setUploadSummary(responseData.summary || null);
        setOpenBulkUpload(false);
        toast.warning(`${responseData.summary?.duplicateRows || 0} duplicate rows found. Please review.`);
      } else if (responseData.errors && responseData.errors.length > 0) {
        setUploadErrors(responseData.errors);
        setUploadSummary(responseData.summary || null);
        toast.warning(`Imported with issues: ${responseData.errors.length} errors found.`);
      } else {
        toast.success("All students imported successfully");
        setOpenBulkUpload(false);
        setBulkFile(null);
      }

      queryClient.invalidateQueries({ queryKey: ["students", institutionId] });
      queryClient.invalidateQueries({ queryKey: ["classes", institutionId] });

    } catch (error: any) {
      if (error?.response?.data?.errors) {
        setUploadErrors(error.response.data.errors);
        setUploadSummary(error.response.data.summary || null);
        toast.error("Upload failed with content errors.");
      } else {
        toast.error(error?.response?.data?.message || "Failed to upload students");
      }
      console.error(error?.response?.data);
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmUpload = async () => {
    if (!previewData) return;
    setIsConfirming(true);
    try {
      const selectedRowIds = Array.from(selectedForImport);
      const res = await _axios.post("/admin/students/bulk-upload/commit", {
        institutionId,
        selectedRowIds,
        rows: previewData.rows,
      });

      const responseData = res.data;
      toast.success(`Successfully imported ${responseData.data?.length || 0} students`);
      setPreviewData(null);
      setOpenBulkUpload(false);
      setBulkFile(null);
      queryClient.invalidateQueries({ queryKey: ["students", institutionId] });
      queryClient.invalidateQueries({ queryKey: ["classes", institutionId] });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to import students");
    } finally {
      setIsConfirming(false);
    }
  };

  const toggleDuplicateRow = (rowId: number) => {
    setSelectedForImport((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const handleRollUpdateUpload = async () => {
    if (!rollUpdateFile) return;
    setRollUpdateLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", rollUpdateFile);
      formData.append("institutionId", institutionId);
      const res = await _axios.post("/admin/students/bulk-update-roll-numbers", formData);
      const data = res.data;

      if (data.preview) {
        setRollUpdatePreview(data);
        const notFoundIndices = data.notFound.map((_: any, i: number) => i);
        setAddNotFoundStudents(new Set(notFoundIndices));
        setAmbiguousSelections({});
      } else {
        toast.success(data.message || "Roll numbers updated");
        setOpenRollUpdate(false);
        setRollUpdateFile(null);
        setRollUpdatePreview(null);
        queryClient.invalidateQueries({ queryKey: ["students", institutionId] });
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to process roll number update");
    } finally {
      setRollUpdateLoading(false);
    }
  };

  const handleRollUpdateConfirm = async () => {
    if (!rollUpdatePreview) return;
    setRollUpdateConfirming(true);
    try {
      const matched = rollUpdatePreview.matched.map((m: any) => ({
        studentId: m.studentId,
        rollNumber: m.rollNumber,
      }));
      const addNotFound = rollUpdatePreview.notFound
        .filter((_: any, i: number) => addNotFoundStudents.has(i))
        .map((n: any) => ({ name: n.name, grade: n.grade, section: n.section, rollNumber: n.rollNumber }));
      const resolveAmbiguous = Object.entries(ambiguousSelections)
        .filter(([_, studentId]) => studentId)
        .map(([row, studentId]) => {
          const amb = rollUpdatePreview.ambiguous.find((a: any) => a.row === Number(row));
          return { studentId, rollNumber: amb?.rollNumber || "" };
        });

      const res = await _axios.post("/admin/students/bulk-update-roll-numbers/commit", {
        institutionId,
        matched,
        addNotFound,
        resolveAmbiguous,
      });

      toast.success(res.data.message);
      setOpenRollUpdate(false);
      setRollUpdateFile(null);
      setRollUpdatePreview(null);
      queryClient.invalidateQueries({ queryKey: ["students", institutionId] });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to confirm roll number update");
    } finally {
      setRollUpdateConfirming(false);
    }
  };

  const downloadRollUpdateTemplate = async () => {
    try {
      const response = await _axios.get("/admin/students/bulk-update-roll-numbers/template", {
        params: { institutionId },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "update_roll_numbers_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error("Failed to download template");
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await _axios.get("/admin/students/template", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "student_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error("Failed to download template");
    }
  };

  // Build unique class options for filter
  const classOptions = classes
    .filter((c) => c.isActive)
    .map((c) => ({ value: c._id, label: `${c.grade}-${c.section}`, grade: Number(c.grade) || 0, section: c.section }))
    .sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.section.localeCompare(b.section);
    });

  const columns = [
    columnHelper.display({
      id: "select",
      header: () => (
        <input
          type="checkbox"
          checked={students.length > 0 && students.every((s) => selectedStudentIds.has(s._id))}
          onChange={() => {
            if (students.every((s) => selectedStudentIds.has(s._id))) {
              setSelectedStudentIds(new Set());
            } else {
              setSelectedStudentIds(new Set(students.map((s) => s._id)));
            }
          }}
          className="h-4 w-4"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selectedStudentIds.has(row.original._id)}
          onChange={() => {
            setSelectedStudentIds((prev) => {
              const next = new Set(prev);
              if (next.has(row.original._id)) next.delete(row.original._id); else next.add(row.original._id);
              return next;
            });
          }}
          className="h-4 w-4"
        />
      ),
    }),
    columnHelper.accessor("name", {
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Name <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: info => <span className="font-semibold">{info.getValue()}</span>,
    }),
    columnHelper.accessor("classId", {
      id: "classId",
      header: "Class",
      cell: info => {
        const classData = info.getValue() as any;
        return classData ? (
          <Badge variant="outline">Class {classData.grade?.toString() || ""}</Badge>
        ) : "-";
      },
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const classData = row.getValue(columnId) as any;
        return classData?._id === filterValue;
      },
    }),
    columnHelper.accessor("rollNumber", {
      header: "Roll Number",
      cell: info => <span className="font-mono text-xs">{info.getValue() || "-"}</span>,
    }),
    columnHelper.display({
      id: "section",
      header: "Section",
      cell: ({ row }) => {
        const classData = row.original.classId as any;
        return classData ? (
          <Badge variant="outline">{classData.section}</Badge>
        ) : "-";
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeletingId(row.original._id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: students,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: paginationMeta?.pages ?? 1,
    state: {
      sorting,
      pagination: {
        pageIndex: page - 1,
        pageSize,
      },
    },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const newState = typeof updater === 'function' ? updater({ pageIndex: page - 1, pageSize }) : updater;
      setPage(newState.pageIndex + 1);
      setPageSize(newState.pageSize);
    },
  });

  const setClassFilter = (value: string) => {
    setColumnFilters((prev) => {
      const without = prev.filter((f) => f.id !== "classId");
      if (!value) return without;
      return [...without, { id: "classId", value }];
    });
  };

  return (
    <>
      <div className="flex flex-col gap-6 p-5 sm:p-8 max-w-screen-2xl mx-auto">
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpenBulkUpload(true)} className="rounded-xl">
            <Upload className="mr-2 h-4 w-4" /> Bulk Upload
          </Button>
          <Button variant="outline" onClick={() => setOpenRollUpdate(true)} className="rounded-xl">
            <Upload className="mr-2 h-4 w-4" /> Update Roll Numbers
          </Button>
          {selectedStudentIds.size > 0 && (
            <Button
              variant="destructive"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedStudentIds))}
              disabled={bulkDeleteMutation.isPending}
              className="rounded-xl"
            >
              {bulkDeleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete {selectedStudentIds.size} Selected
            </Button>
          )}
          <Button onClick={handleCreate} className="bg-brand-color hover:bg-brand-color/90 rounded-xl shadow-lg shadow-indigo-500/30">
            <Plus className="mr-2 h-4 w-4" /> Add Student
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search students..."
                value={globalFilter ?? ""}
                onChange={e => setGlobalFilter(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
            <Select value={classFilterValue || "all"} onValueChange={(v) => setClassFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-44 rounded-xl">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classOptions.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isLoading && (
              <span className="text-sm text-muted-foreground whitespace-nowrap ml-auto">
                {students.length} of {paginationMeta?.total ?? 0} students
              </span>
            )}
          </div>
        </Card>

        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="neo-table-wrapper overflow-hidden">
            <div className="overflow-x-auto">
            <Table className="min-w-[700px]">
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
                      No students found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page</span>
                <Select
                  value={String(table.getState().pagination.pageSize)}
                  onValueChange={(v) => table.setPageSize(Number(v))}
                >
                  <SelectTrigger className="w-[70px] h-8 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <StudentFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        student={editingStudent}
        institutionId={institutionId}
        classes={classes}
        onSave={handleSave}
      />

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Student?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this student? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && deleteMutation.mutate(deletingId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Resolution Dialog */}
      <Dialog open={!!previewData} onOpenChange={(open) => { if (!open) { setPreviewData(null); setOpenBulkUpload(false); } }}>
        <DialogContent className="max-w-5xl flex flex-col max-h-[90vh] p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Duplicate Names Found</DialogTitle>
            <DialogDescription>
              Some students have the same name in the same class. Select which ones to keep.
              Duplicates will be assigned different roll numbers.
            </DialogDescription>
          </DialogHeader>

          {previewData && (
            <div className="flex flex-col min-h-0 flex-1 px-6">
              {uploadSummary && (
                <div className="flex gap-4 text-sm font-medium mb-3 shrink-0">
                  <span className="text-muted-foreground">Total: {uploadSummary.totalRows}</span>
                  <span className="text-green-600">Valid: {uploadSummary.validRows}</span>
                  <span className="text-amber-600">Duplicates: {uploadSummary.duplicateRows}</span>
                  <span className="text-red-600">Errors: {uploadSummary.errorRows}</span>
                </div>
              )}

              <div className="border rounded-md overflow-auto min-h-0 flex-1 bg-[var(--neo-bg)] dark:bg-slate-900">
                <Table>
                  <TableHeader className="sticky top-0 bg-[var(--neo-bg)] dark:bg-slate-900 z-10">
                    <TableRow>
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={previewData.rows.length > 0 && previewData.rows.every((r) => selectedForImport.has(r._rowNumber))}
                          onChange={() => {
                            if (previewData.rows.every((r) => selectedForImport.has(r._rowNumber))) {
                              setSelectedForImport(new Set());
                            } else {
                              setSelectedForImport(new Set(previewData.rows.map((r) => r._rowNumber)));
                            }
                          }}
                          className="h-4 w-4"
                        />
                      </TableHead>
                      <TableHead>Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Roll Number</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...previewData.rows]
                      .sort((a: any, b: any) => {
                        const aDup = previewData.duplicates.inFile.includes(a._rowNumber) || previewData.duplicates.inDatabase.includes(a._rowNumber) ? 0 : 1;
                        const bDup = previewData.duplicates.inFile.includes(b._rowNumber) || previewData.duplicates.inDatabase.includes(b._rowNumber) ? 0 : 1;
                        return aDup - bDup;
                      })
                      .map((row: any) => {
                      const isDuplicate = previewData.duplicates.inFile.includes(row._rowNumber) ||
                        previewData.duplicates.inDatabase.includes(row._rowNumber);
                      const reason = previewData.duplicates.inFile.includes(row._rowNumber)
                        ? "Duplicate in file"
                        : previewData.duplicates.inDatabase.includes(row._rowNumber)
                          ? "Already exists in DB"
                          : null;
                      return (
                        <TableRow key={row._rowNumber} className={isDuplicate ? "bg-amber-50 dark:bg-amber-950/20" : ""}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedForImport.has(row._rowNumber)}
                              onChange={() => toggleDuplicateRow(row._rowNumber)}
                              className="h-4 w-4"
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs">{row._rowNumber}</TableCell>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>{row.grade && row.section ? `${row.grade}-${row.section}` : "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{row.rollNumber || "-"}</TableCell>
                          <TableCell>
                            {reason ? (
                              <Badge variant="outline" className="text-amber-600 border-amber-300">{reason}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-600 border-green-300">New</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter className="shrink-0 px-6 py-4 border-t">
            <Button variant="outline" onClick={() => {
              setPreviewData(null);
              setOpenBulkUpload(false);
              setBulkFile(null);
              setUploadErrors([]);
              setUploadSummary(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmUpload}
              disabled={isConfirming || selectedForImport.size === 0}
              className="bg-brand-color"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${selectedForImport.size} Selected`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Roll Numbers Dialog */}
      <Dialog open={openRollUpdate} onOpenChange={(open) => { if (!open) { setRollUpdateFile(null); setRollUpdatePreview(null); } setOpenRollUpdate(open); }}>
        <DialogContent className="max-w-5xl flex flex-col max-h-[90vh] p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Update Roll Numbers</DialogTitle>
            <DialogDescription>
              Upload an Excel file with updated roll numbers for existing students.
            </DialogDescription>
          </DialogHeader>

          {!rollUpdatePreview && (
            <div className="space-y-4 px-6 py-4 overflow-y-auto">
              <div className="bg-muted p-4 rounded-md text-sm">
                <p className="font-semibold mb-2">Instructions:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Download the template which includes all current students.</li>
                  <li>Fill in the <b>new_roll_number</b> column with the school-issued roll numbers.</li>
                  <li>Upload the filled Excel file.</li>
                  <li>Students not found in the database will be shown for review.</li>
                </ol>
                <Button variant="link" className="p-0 h-auto mt-2 text-brand-color" onClick={downloadRollUpdateTemplate}>
                  Download Template
                </Button>
              </div>
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="roll-update-file">Excel File</Label>
                <Input id="roll-update-file" type="file" accept=".xlsx, .xls" disabled={rollUpdateLoading} onChange={(e) => setRollUpdateFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          )}

          {rollUpdatePreview && (
            <div className="flex flex-col min-h-0 flex-1 px-6 overflow-hidden">
              <div className="flex gap-4 text-sm font-medium mb-3 shrink-0">
                <span className="text-green-600">Matched: {rollUpdatePreview.summary.matched}</span>
                {rollUpdatePreview.summary.notFound > 0 && <span className="text-amber-600">Not found: {rollUpdatePreview.summary.notFound}</span>}
                {rollUpdatePreview.summary.ambiguous > 0 && <span className="text-red-600">Ambiguous: {rollUpdatePreview.summary.ambiguous}</span>}
              </div>

              <div className="overflow-auto min-h-0 flex-1 space-y-4">
                {rollUpdatePreview.ambiguous.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2 text-red-600">Multiple students with the same name — select which one to update:</p>
                    <div className="border rounded-md overflow-auto max-h-48">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Roll Number in File</TableHead>
                            <TableHead>Select Student</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rollUpdatePreview.ambiguous.map((a: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{a.name}</TableCell>
                              <TableCell className="font-mono">{a.rollNumber || "-"}</TableCell>
                              <TableCell>
                                <select
                                  className="border rounded px-2 py-1 text-sm w-full"
                                  value={ambiguousSelections[a.row] || ""}
                                  onChange={(e) => setAmbiguousSelections((prev) => ({ ...prev, [a.row]: e.target.value }))}
                                >
                                  <option value="">-- Select --</option>
                                  {a.matches.map((m: any) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} (current roll: {m.rollNumber || "none"}, id: {m.id.slice(0, 8)}...)
                                    </option>
                                  ))}
                                </select>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {rollUpdatePreview.notFound.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2 text-amber-600">Students not found in database (check to add as new):</p>
                    <div className="border rounded-md overflow-auto max-h-48">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead className="w-10">Add</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Class</TableHead>
                            <TableHead>Roll Number</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rollUpdatePreview.notFound.map((n: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell>
                                <input
                                  type="checkbox"
                                  checked={addNotFoundStudents.has(i)}
                                  onChange={() => {
                                    setAddNotFoundStudents((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(i)) next.delete(i); else next.add(i);
                                      return next;
                                    });
                                  }}
                                  className="h-4 w-4"
                                />
                              </TableCell>
                              <TableCell className="font-medium">{n.name}</TableCell>
                              <TableCell>{n.grade}-{n.section}</TableCell>
                              <TableCell className="font-mono">{n.rollNumber || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {rollUpdatePreview.matched.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2 text-green-600">Matched students (will be updated):</p>
                    <div className="border rounded-md overflow-auto max-h-48">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Class</TableHead>
                            <TableHead>New Roll Number</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rollUpdatePreview.matched.map((m: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{m.name}</TableCell>
                              <TableCell>{m.grade}-{m.section}</TableCell>
                              <TableCell className="font-mono">{m.rollNumber || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="shrink-0 px-6 py-4 border-t">
            <Button variant="outline" onClick={() => { setOpenRollUpdate(false); setRollUpdateFile(null); setRollUpdatePreview(null); }}>
              Cancel
            </Button>
            {!rollUpdatePreview ? (
              <Button onClick={handleRollUpdateUpload} disabled={!rollUpdateFile || rollUpdateLoading} className="bg-brand-color">
                {rollUpdateLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : "Upload"}
              </Button>
            ) : (
              <Button onClick={handleRollUpdateConfirm} disabled={rollUpdateConfirming || rollUpdatePreview.ambiguous.some((a: any) => !ambiguousSelections[a.row])} className="bg-brand-color">
                {rollUpdateConfirming ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirming...</> : "Confirm Update"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={openBulkUpload} onOpenChange={(open) => { if (!open) { setPreviewData(null); setUploadErrors([]); setUploadSummary(null); setBulkFile(null); } setOpenBulkUpload(open); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{uploadErrors.length > 0 ? "Upload Report" : "Bulk Upload Students"}</DialogTitle>
            <DialogDescription>
              {uploadErrors.length > 0
                ? "Some rows failed to import. Please review the errors below."
                : "Upload an Excel file to add multiple students."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!uploadErrors.length && (
              <div className="bg-muted p-4 rounded-md text-sm">
                <p className="font-semibold mb-2">Instructions:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Download the template.</li>
                  <li>Fill in student details. <b>Grade</b>, <b>Section</b>, and <b>Name</b> are compulsory.</li>
                  <li>Upload the filled Excel file.</li>
                </ol>
                <Button variant="link" className="p-0 h-auto mt-2 text-brand-color" onClick={downloadTemplate}>
                  Download Template
                </Button>
              </div>
            )}

            {!uploadErrors.length && (
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="picture">Excel File</Label>
                <Input id="picture" type="file" accept=".xlsx, .xls" disabled={isUploading} onChange={(e) => setBulkFile(e.target.files?.[0] || null)} />
              </div>
            )}

            {isUploading && (
              <div className="space-y-2 p-3 bg-muted/50 rounded-lg border border-border">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="flex items-center gap-2 text-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-brand-color" />
                    {uploadProgress < 100 ? "Uploading file..." : "Processing Excel data..."}
                  </span>
                  <span className="font-mono text-brand-color font-bold">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-brand-color h-2.5 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error Report View */}
            {uploadErrors.length > 0 && (
              <div className="space-y-4">
                {uploadSummary && (
                  <div className="flex gap-4 text-sm font-medium">
                    <span className="text-muted-foreground">Total: {uploadSummary.totalRows}</span>
                    <span className="text-green-600">Imported: {uploadSummary.validRows}</span>
                    <span className="text-red-600">Failed: {uploadSummary.errorRows}</span>
                  </div>
                )}

                <div className="border rounded-md max-h-60 overflow-y-auto bg-[var(--neo-bg)] dark:bg-slate-900 p-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Row</TableHead>
                        <TableHead>Error Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploadErrors.map((err: any, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono">{err.row || "-"}</TableCell>
                          <TableCell className="text-destructive text-sm">
                            {Array.isArray(err.errors) ? err.errors.join(", ") : err.errors || err.toString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            {uploadErrors.length > 0 ? (
              <Button onClick={() => {
                setUploadErrors([]);
                setUploadSummary(null);
                setBulkFile(null);
              }}>
                Upload New File
              </Button>
            ) : (
              <>
                <Button variant="outline" disabled={isUploading} onClick={() => setOpenBulkUpload(false)}>Cancel</Button>
                <Button onClick={handleBulkUpload} disabled={!bulkFile || isUploading} className="bg-brand-color">
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading ({uploadProgress}%)
                    </>
                  ) : (
                    "Upload"
                  )}
                </Button>
              </>
            )}
            {uploadErrors.length > 0 && (
              <>
                <Button className="ml-2 bg-destructive/90 hover:bg-destructive" onClick={async () => {
                  try {
                    const res = await _axios.post("/admin/students/error-report", { errors: uploadErrors }, { responseType: 'blob' });
                    const url = window.URL.createObjectURL(new Blob([res.data]));
                    const link = document.createElement("a");
                    link.href = url;
                    link.setAttribute("download", "import_errors.xlsx");
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                  } catch (e) {
                    toast.error("Failed to generate error report");
                  }
                }}>
                  <Upload className="mr-2 h-4 w-4 rotate-180" /> Download Report
                </Button>
                <Button variant="outline" onClick={() => {
                  setOpenBulkUpload(false);
                  setUploadErrors([]);
                  setUploadSummary(null);
                  setBulkFile(null);
                }}>Close</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
