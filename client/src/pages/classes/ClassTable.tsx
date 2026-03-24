"use client";

import { useState, useMemo } from "react";
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
import { Pencil, Trash2, Plus, BookOpen, Search, ArrowUpDown, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { _axios } from "@/lib/axios";
import { ClassFormDialog } from "./ClassFormDialog";
import type { IClass, CreateClassDTO, UpdateClassDTO } from "@/types/class";

const columnHelper = createColumnHelper<IClass>();

interface Props {
    institutionId: string;
}

export function ClassTable({ institutionId }: Props) {
    const [openForm, setOpenForm] = useState(false);
    const [editingClass, setEditingClass] = useState<IClass | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [globalFilter, setGlobalFilter] = useState("");
    const [sorting, setSorting] = useState<SortingState>([]);
    const queryClient = useQueryClient();

    const { data: classes = [], isLoading } = useQuery<IClass[]>({
        queryKey: ["classes", institutionId],
        queryFn: async () => {
            const { data } = await _axios.get<{ success: boolean; data: IClass[] }>("/admin/classes", {
                params: { institutionId },
            });
            return data.data;
        },
        enabled: !!institutionId,
    });

    const createMutation = useMutation({
        mutationFn: async (data: CreateClassDTO) => {
            const { data: res } = await _axios.post<{ success: boolean; data: IClass }>("/admin/classes", {
                ...data,
                institutionId,
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["classes", institutionId] });
            toast.success("Class added successfully");
            setOpenForm(false);
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || "Failed to add class");
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdateClassDTO }) => {
            const { data: res } = await _axios.patch<{ success: boolean; data: IClass }>(`/admin/classes/${id}`, {
                ...data,
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["classes", institutionId] });
            toast.success("Class updated successfully");
            setOpenForm(false);
            setEditingClass(null);
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || "Failed to update class");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { data } = await _axios.delete<{ success: boolean; message: string }>(`/admin/classes/${id}`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["classes", institutionId] });
            toast.success("Class removed");
            setDeletingId(null);
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || "Failed to delete class");
        },
    });

    const handleCreate = () => {
        setEditingClass(null);
        setOpenForm(true);
    };

    const handleEdit = (cls: IClass) => {
        setEditingClass(cls);
        setOpenForm(true);
    };

    const handleSave = async (data: CreateClassDTO) => {
        if (editingClass) {
            updateMutation.mutate({ id: editingClass._id, data });
        } else {
            createMutation.mutate(data);
        }
    };

    const columns = [
        columnHelper.accessor("grade", {
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Grade <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: info => <span className="font-semibold">{info.getValue() || "-"}</span>,
        }),
        columnHelper.accessor("section", {
            header: "Section",
            cell: info => <Badge variant="outline">{info.getValue()}</Badge>,
        }),
        columnHelper.accessor("year", { header: "Year" }),
        columnHelper.accessor("studentCount", {
            header: "Students",
            cell: info => <Badge variant="secondary">{info.getValue() || 0}</Badge>,
        }),
        columnHelper.display({
            id: "isActive",
            header: "Status",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Switch
                        checked={row.original.isActive}
                        onCheckedChange={(val) => updateMutation.mutate({ id: row.original._id, data: { isActive: val } })}
                    />
                    <span className="text-xs text-muted-foreground w-12">{row.original.isActive ? "Active" : "Archived"}</span>
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
        data: classes,
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
                            <BookOpen className="h-6 w-6" /> Classes & Sections
                        </h2>
                        <p className="text-muted-foreground text-sm">Manage grades, sections, and class capacity.</p>
                    </div>
                    <Button onClick={handleCreate} className="bg-brand-color hover:bg-brand-color/90">
                        <Plus className="mr-2 h-4 w-4" /> Add Class
                    </Button>
                </div>

                <Card className="p-4">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                            <Input
                                placeholder="Search classes..."
                                value={globalFilter ?? ""}
                                onChange={e => setGlobalFilter(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="text-sm text-muted-foreground">
                            Total: {classes.length}
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
                                            <TableHead className="text-center" key={header.id}>
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
                                                <TableCell className="text-center" key={cell.id}>
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                                            No classes found. Add one to get started.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            <ClassFormDialog open={openForm} onOpenChange={setOpenForm} cls={editingClass} institutionId={institutionId} onSave={handleSave} />

            <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Class?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this class? You cannot delete a class if it has active students.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deletingId && deleteMutation.mutate(deletingId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
