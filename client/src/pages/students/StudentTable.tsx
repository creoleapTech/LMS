"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Pencil, Trash2, Plus, GraduationCap, Search, ArrowUpDown, Loader2, Upload } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
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
  const queryClient = useQueryClient();
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<any[]>([]); // Array of error objects
  const [uploadSummary, setUploadSummary] = useState<any>(null);

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

  const { data: students = [], isLoading } = useQuery<IStudent[]>({
    queryKey: ["students", institutionId],
    queryFn: async () => {
      const { data } = await _axios.get<{ success: boolean; data: IStudent[] }>("/admin/students", {
        params: { institutionId },
      });
      return data.data;
    },
    enabled: !!institutionId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateStudentDTO) => {
      const { data: res } = await _axios.post<{ success: boolean; data: IStudent }>("/admin/students", {
        ...data,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", institutionId] });
      queryClient.invalidateQueries({ queryKey: ["classes", institutionId] }); // Updates counts
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
    try {
      const formData = new FormData();
      formData.append("file", bulkFile);
      formData.append("institutionId", institutionId);
      // We are not sending classId, so backend will look up grade/section in file.

      const res = await _axios.post("/admin/students/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const responseData = res.data;

      // Determine if there are errors despite success = true (partial success)
      if (responseData.errors && responseData.errors.length > 0) {
        setUploadErrors(responseData.errors);
        setUploadSummary(responseData.summary || null);
        // Keep dialog open to show errors
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
        // Handle case where status is 400 but we have structured errors
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

  const columns = [
    columnHelper.accessor("name", {
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Name <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: info => <span className="font-semibold">{info.getValue()}</span>,
    }),
    columnHelper.accessor("classId", {
      header: "Class",
      cell: info => {
        const classData = info.getValue() as any; // Populated
        return classData ? (
          <Badge variant="outline">{classData.grade?.toString() || ""}-{classData.section}</Badge>
        ) : "-";
      },
    }),
    columnHelper.accessor("parentName", { header: "Parent" }),
    columnHelper.accessor("parentMobile", { header: "Parent Mobile" }),
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
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <GraduationCap className="h-6 w-6" /> Student Management
            </h2>
            <p className="text-muted-foreground text-sm">Onboard, manage, and batch import students.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpenBulkUpload(true)}>
              <Upload className="mr-2 h-4 w-4" /> Bulk Upload
            </Button>
            <Button onClick={handleCreate} className="bg-brand-color hover:bg-brand-color/90">
              <Plus className="mr-2 h-4 w-4" /> Add Student
            </Button>
          </div>
        </div>

        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search students..."
                value={globalFilter ?? ""}
                onChange={e => setGlobalFilter(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </Card>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
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
                      No students found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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

      {/* Bulk Upload Dialog */}
      <Dialog open={openBulkUpload} onOpenChange={setOpenBulkUpload}>
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
                  <li>Fill in student details. Ensure <b>Grade</b> and <b>Section</b> match existing classes.</li>
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
                <Input id="picture" type="file" accept=".xlsx, .xls" onChange={(e) => setBulkFile(e.target.files?.[0] || null)} />
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

                <div className="border rounded-md max-h-60 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Row</TableHead>
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
                // If all failed, maybe keep open? usage preference. 
                // Let's allow retry by resetting state but keeping dialog open if they want to upload new file.
              }}>
                Upload New File
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setOpenBulkUpload(false)}>Cancel</Button>
                <Button onClick={handleBulkUpload} disabled={!bulkFile || isUploading} className="bg-brand-color">
                  {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Upload
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