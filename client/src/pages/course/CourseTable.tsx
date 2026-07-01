"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Image, Pencil, Trash2, Plus, Search, IndianRupee, LayoutGrid, List, BookOpen,
  Users, Clock, AlertTriangle, Layers, ChevronRight
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { _axios } from "@/lib/axios";
import { CourseFormDialog } from "./CourseFormDialog";

type Course = {
  id: string;
  code: string;
  name: string;
  description?: string;
  thumbnail?: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  fees: number;
  status: "Active" | "Inactive" | "Archived";
  startDate: string;
};

const columnHelper = createColumnHelper<Course>();

interface Props {
  institutionName?: string;
}

const levelColors: Record<string, string> = {
  Beginner: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Intermediate: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Advanced: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  Active: "default",
  Inactive: "secondary",
  Archived: "outline",
};

export function CourseTable({ institutionName: _institutionName }: Props) {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [_loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [globalFilter, setGlobalFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([]);

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await _axios.get("/admin/courses");
      setCourses(data.data ?? []);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load courses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const filteredData = useMemo(() => {
    let filtered = courses;
    if (levelFilter !== "all") filtered = filtered.filter(c => c.level === levelFilter);
    if (statusFilter !== "all") filtered = filtered.filter(c => c.status === statusFilter);
    return filtered;
  }, [courses, levelFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: courses.length,
    active: courses.filter(c => c.status === "Active").length,
    inactive: courses.filter(c => c.status === "Inactive").length,
    archived: courses.filter(c => c.status === "Archived").length,
  }), [courses]);

  const columns = [
    columnHelper.accessor("thumbnail", {
      header: "",
      cell: info =>
        info.getValue() ? (
          <img src={info.getValue()} alt="" className="h-12 w-9 rounded-md object-cover border" />
        ) : (
          <div className="h-12 w-9 rounded-md bg-muted flex items-center justify-center">
            <Image className="h-4 w-4 text-muted-foreground/40" />
          </div>
        ),
    }),
    columnHelper.accessor("code", { header: "Code" }),
    columnHelper.accessor("name", {
      header: "Course Name",
      cell: info => <div className="font-medium">{info.getValue()}</div>,
    }),
    columnHelper.accessor("level", {
      header: "Level",
      cell: info => (
        <Badge variant="outline" className={levelColors[info.getValue()]}>
          {info.getValue()}
        </Badge>
      ),
    }),
    columnHelper.accessor("duration", { header: "Duration" }),
    columnHelper.accessor("fees", {
      header: "Fees",
      cell: info => (
        <div className="flex items-center font-semibold">
          <IndianRupee className="h-4 w-4 mr-1" />
          {info.getValue().toLocaleString("en-IN")}
        </div>
      ),
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: info => (
        <Badge variant={statusVariants[info.getValue()] || "outline"}>
          {info.getValue()}
        </Badge>
      ),
    }),
    columnHelper.display({
      id: "actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditingCourse(row.original); setOpenForm(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeletingId(row.original.id); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
  });

  const handleSave = useCallback(async (data: any) => {
    try {
      if (editingCourse) {
        const { data: res } = await _axios.put(`/admin/courses/${editingCourse.id}`, data);
        setCourses(prev => prev.map(c => c.id === editingCourse.id ? { ...c, ...res.data } : c));
        toast.success("Course updated successfully");
      } else {
        const { data: res } = await _axios.post("/admin/courses", data);
        setCourses(prev => [...prev, res.data]);
        toast.success("Course created successfully");
      }
      setOpenForm(false);
      setEditingCourse(null);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save course");
    }
  }, [editingCourse]);

  const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) => (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );

  return (
    <>
      <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Courses</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage all courses across your institution</p>
          </div>
          <Button onClick={() => { setEditingCourse(null); setOpenForm(true); }} className="rounded-xl shadow-lg shadow-indigo-500/30 bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="mr-2 h-4 w-4" /> Create Course
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Courses" value={stats.total} icon={BookOpen} color="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" />
          <StatCard label="Active" value={stats.active} icon={Users} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
          <StatCard label="Inactive" value={stats.inactive} icon={Clock} color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
          <StatCard label="Archived" value={stats.archived} icon={AlertTriangle} color="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" />
        </div>

        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-1 flex-wrap gap-3 items-center">
              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search courses..."
                  value={globalFilter}
                  onChange={e => setGlobalFilter(e.target.value)}
                  className="pl-10 rounded-xl h-9"
                />
              </div>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="rounded-xl h-9 w-[140px]"><SelectValue placeholder="All Levels" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="Beginner">Beginner</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="rounded-xl h-9 w-[140px]"><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="rounded-xl h-9 text-muted-foreground" onClick={() => { setGlobalFilter(""); setLevelFilter("all"); setStatusFilter("all"); }}>
                Clear
              </Button>
            </div>
            <div className="flex items-center gap-1 rounded-lg border p-0.5 bg-muted/50">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Grid
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <List className="h-3.5 w-3.5" /> List
              </button>
            </div>
          </div>
        </Card>

        {filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <BookOpen className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold">No courses found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {globalFilter || levelFilter !== "all" || statusFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Get started by creating your first course"}
            </p>
            {!globalFilter && levelFilter === "all" && statusFilter === "all" && (
              <Button onClick={() => { setEditingCourse(null); setOpenForm(true); }} variant="outline" className="mt-4 rounded-xl">
                <Plus className="mr-2 h-4 w-4" /> Create Course
              </Button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredData.map(course => (
              <div
                key={course.id}
                onClick={() => navigate({ to: "/courses/$id", params: { id: course.id } })}
                className="group relative rounded-xl border bg-card shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer"
              >
                <div className="relative bg-gradient-to-b from-muted/50 to-muted flex items-center justify-center h-44">
                  {course.thumbnail ? (
                    <img src={course.thumbnail} alt={course.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground/30">
                      <Layers className="h-10 w-10" />
                      <span className="text-xs font-medium">No thumbnail</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingCourse(course); setOpenForm(true); }}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm hover:bg-white text-muted-foreground hover:text-foreground transition-all"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingId(course.id); }}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm hover:bg-white text-destructive transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="absolute bottom-2 left-2">
                    <Badge variant={statusVariants[course.status] || "outline"} className="shadow-sm text-[10px] px-1.5 py-0">
                      {course.status}
                    </Badge>
                  </div>
                </div>

                <div className="flex-1 p-3.5 space-y-2.5">
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground/60">
                      {course.code}
                    </p>
                    <h3 className="font-semibold leading-snug text-sm">{course.name}</h3>
                    {course.description && (
                      <p className="text-xs text-muted-foreground/70 line-clamp-2">{course.description}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-medium ${levelColors[course.level]}`}>
                      {course.level}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {course.duration}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t">
                    <div className="flex items-center font-bold text-sm">
                      <IndianRupee className="h-3.5 w-3.5 mr-0.5" />
                      {course.fees.toLocaleString("en-IN")}
                    </div>
                    <span className="flex items-center gap-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Manage <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  {table.getHeaderGroups().map(g => (
                    <TableRow key={g.id}>
                      {g.headers.map(h => <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>)}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map(row => (
                      <TableRow
                        key={row.id}
                        onClick={() => navigate({ to: "/courses/$id", params: { id: row.original.id } })}
                        className="cursor-pointer"
                      >
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
                        No courses found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {table.getPageCount() > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
                  {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredData.length)} of {filteredData.length}
                </p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-8 rounded-lg" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                    Prev
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 rounded-lg" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {filteredData.length > 0 && viewMode === "grid" && (
          <p className="text-xs text-muted-foreground text-center">
            Showing {filteredData.length} of {courses.length} course{courses.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      <CourseFormDialog open={openForm} onOpenChange={setOpenForm} course={editingCourse} onSave={handleSave} />

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course?</AlertDialogTitle>
            <AlertDialogDescription>This course will be permanently removed. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              try {
                await _axios.delete(`/admin/courses/${deletingId}`);
                setCourses(prev => prev.filter(c => c.id !== deletingId));
                setDeletingId(null);
                toast.success("Course deleted");
              } catch (err: any) {
                toast.error(err?.message ?? "Failed to delete course");
              }
            }} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
