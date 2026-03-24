// src/components/course/CourseTable.tsx
"use client";

import { useState, useCallback, useMemo } from "react";
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
import { Pencil, Trash2, Plus, BookOpen, Search, IndianRupee, Calendar } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CourseFormDialog } from "./CourseFormDialog";

type Course = {
  id: string;
  code: string;          // e.g., MATH101
  name: string;
  description?: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string;      // e.g., "3 Months", "1 Year"
  fees: number;
  status: "Active" | "Inactive" | "Archived";
  startDate: string;     // YYYY-MM-DD
  instructor?: string;
};

const columnHelper = createColumnHelper<Course>();

const mockCourses: Course[] = [
  { id: "1", code: "MATH101", name: "Mathematics Grade 10", description: "CBSE Math for Class 10", level: "Intermediate", duration: "1 Year", fees: 25000, status: "Active", startDate: "2025-04-01", instructor: "Rajesh Kumar" },
  { id: "2", code: "SCI202", name: "Physics Advanced", level: "Advanced", duration: "6 Months", fees: 35000, status: "Active", startDate: "2025-06-15", instructor: "Priya Singh" },
  { id: "3", code: "ENG101", name: "English Foundation", level: "Beginner", duration: "3 Months", fees: 15000, status: "Inactive", startDate: "2025-01-10" },
];

interface Props {
  institutionId: string;
  institutionName: string;
}

export function CourseTable({ institutionId, institutionName }: Props) {
  const [courses, setCourses] = useState(mockCourses);
  const [openForm, setOpenForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filters
  const [globalFilter, setGlobalFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([]);

  const filteredData = useMemo(() => {
    let filtered = courses;
    if (levelFilter !== "all") filtered = filtered.filter(c => c.level === levelFilter);
    if (statusFilter !== "all") filtered = filtered.filter(c => c.status === statusFilter);
    return filtered;
  }, [courses, levelFilter, statusFilter]);

  const columns = [
    columnHelper.accessor("code", { header: "Code" }),
    columnHelper.accessor("name", {
      header: "Course Name",
      cell: info => <div className="font-medium">{info.getValue()}</div>,
    }),
    columnHelper.accessor("level", {
      header: "Level",
      cell: info => <Badge variant="outline">{info.getValue()}</Badge>,
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
        <Badge variant={info.getValue() === "Active" ? "default" : info.getValue() === "Inactive" ? "secondary" : "outline"}>
          {info.getValue()}
        </Badge>
      ),
    }),
    columnHelper.display({
      id: "actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button size="icon" variant="ghost" onClick={() => { setEditingCourse(row.original); setOpenForm(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeletingId(row.original.id)}>
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

  const handleSave = useCallback((data: any) => {
    if (editingCourse) {
      setCourses(prev => prev.map(c => c.id === editingCourse.id ? { ...c, ...data } : c));
      toast.success("Course updated successfully");
    } else {
      setCourses(prev => [...prev, { id: String(Date.now()), ...data }]);
      toast.success("Course created successfully");
    }
    setOpenForm(false);
    setEditingCourse(null);
  }, [editingCourse]);

  return (
    <>
      <div className="container mx-auto py-8 max-w-7xl">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BookOpen className="h-8 w-8" /> Courses
            </h1>
            <p className="text-muted-foreground">{institutionName}</p>
          </div>
          <Button onClick={() => { setEditingCourse(null); setOpenForm(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Create Course
          </Button>
        </div>

        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search courses..." value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} className="pl-10" />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger><SelectValue placeholder="All Levels" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="Beginner">Beginner</SelectItem>
                <SelectItem value="Intermediate">Intermediate</SelectItem>
                <SelectItem value="Advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setGlobalFilter(""); setLevelFilter("all"); setStatusFilter("all"); }}>
              Clear Filters
            </Button>
          </div>
        </Card>

        <div className="rounded-md border">
          <Table>
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
                    No courses found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <CourseFormDialog open={openForm} onOpenChange={setOpenForm} course={editingCourse} onSave={handleSave} />

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course?</AlertDialogTitle>
            <AlertDialogDescription>This course will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setCourses(prev => prev.filter(c => c.id !== deletingId));
              setDeletingId(null);
              toast.success("Course deleted");
            }} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}