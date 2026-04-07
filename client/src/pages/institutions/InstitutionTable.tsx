// src/components/institution/InstitutionTable.tsx
"use client";

import { useState, useMemo } from "react";
import { useDebouncedCallback } from "use-debounce";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pencil,
  Trash2,
  Plus,
  Loader2,
  Building2,
  Phone,
  Mail,
  MapPin,
  User,
  Search,
} from "lucide-react";
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
import { toast } from "sonner";
import { InstitutionFormDialog } from "./InstitutionFormDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { useNavigate } from "@tanstack/react-router";

const columnHelper = createColumnHelper<Institution>();

type Institution = {
  _id: string;
  name: string;
  type: "school" | "college";
  address: string;
  contactDetails: {
    inchargePerson: string;
    mobileNumber: string;
    email?: string;
    officePhone?: string;
  };
  isActive: boolean;
};

// Response type for the API
type InstitutionsResponse = {
  data: Institution[];
  // Add other response fields if needed
};

export function InstitutionTable() {
  const [openForm, setOpenForm] = useState(false);
  const [editingInstitution, setEditingInstitution] = useState<Institution | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "school" | "college">("all");

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Debounced search input
  const debouncedSearch = useDebouncedCallback((value: string) => {
    setSearchTerm(value);
  }, 400);

  // Server-side search + filter with proper typing
  const {
    data: institutions = [],
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["institutions", searchTerm, typeFilter] as const,
    queryFn: async ({ queryKey }): Promise<Institution[]> => {
      const [, search, type] = queryKey;
      
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (type && type !== "all") params.append("type", type);

      const res = await _axios.get<InstitutionsResponse>(`/admin/institutions?${params.toString()}`);
      return res.data?.data ?? [];
    },
    retry: 2,
    staleTime: 30 * 1000,
  });

  // Memoize the data to prevent unnecessary re-renders
  const memoizedInstitutions = useMemo(() => institutions, [institutions]);

  const toggleMutation = useMutation({
    mutationFn: (id: string) => _axios.patch(`/admin/institutions/${id}/toggle-active`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["institutions"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to toggle status");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const isFormData = data instanceof FormData;
      const config = isFormData ? { headers: { "Content-Type": "multipart/form-data" } } : {};
      if (editingInstitution) {
        return _axios.patch(`/admin/institutions/${editingInstitution._id}`, data, config);
      } else {
        return _axios.post("/admin/institutions", data, config);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["institutions"] });
      toast.success(editingInstitution ? "Institution updated!" : "Institution created!");
      setOpenForm(false);
      setEditingInstitution(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => _axios.delete(`/admin/institutions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["institutions"] });
      toast.success("Institution deleted");
      setDeletingId(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to delete");
      setDeletingId(null);
    },
  });

  const columns = useMemo(() => [
    columnHelper.accessor("name", {
      header: "Institution",
      cell: ({ row }) => (
        <button
          onClick={() => navigate({ to: "/institutions/$id", params: { id: row.original._id } })}
          className="text-left hover:underline font-semibold text-blue-600 transition"
        >
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <div>{row.original.name}</div>
            </div>
          </div>
        </button>
      ),
    }),
        columnHelper.accessor("address", {
      header: "Address",
      cell: info =>  <div className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {info.getValue()}
              </div>,
    }),
    
    columnHelper.accessor("type", {
      header: "Type",
      cell: info => <Badge variant="outline" className="capitalize">{info.getValue()}</Badge>,
    }),
    columnHelper.accessor("contactDetails.inchargePerson", {
      header: "Incharge",
      cell: info => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          {info.getValue()}
        </div>
      ),
    }),
    columnHelper.accessor("contactDetails.mobileNumber", {
      header: "Mobile",
      cell: info => (
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          {info.getValue()}
        </div>
      ),
    }),
    columnHelper.accessor("contactDetails.email", {
      header: "Email",
      cell: info => info.getValue() ? (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          {info.getValue()}
        </div>
      ) : <span className="text-muted-foreground">-</span>,
    }),
    columnHelper.accessor("isActive", {
      header: "Status",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Switch
            checked={row.original.isActive}
            onCheckedChange={() => toggleMutation.mutate(row.original._id)}
            disabled={toggleMutation.isPending}
          />
          <Badge variant={row.original.isActive ? "default" : "secondary"}>
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => { 
              setEditingInstitution(row.original); 
              setOpenForm(true); 
            }}
            disabled={saveMutation.isPending}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-destructive" 
            onClick={() => setDeletingId(row.original._id)}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    }),
  ], [navigate, toggleMutation, saveMutation, deleteMutation]);

  const table = useReactTable({
    data: memoizedInstitutions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
  });

  // Handle type filter change
  const handleTypeFilterChange = (value: "all" | "school" | "college") => {
    setTypeFilter(value);
    table.setPageIndex(0);
  };

  // Reset form state when dialog closes
  const handleFormOpenChange = (open: boolean) => {
    setOpenForm(open);
    if (!open) {
      setEditingInstitution(null);
    }
  };

  return (
    <>
      <div className="py-8 px-5 sm:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Institutions</h1>
            <p className="text-muted-foreground mt-1">Manage schools and colleges</p>
          </div>
          <Button 
            onClick={() => { 
              setEditingInstitution(null); 
              setOpenForm(true); 
            }}
            disabled={saveMutation.isPending}
            className="rounded-xl shadow-lg shadow-primary/20"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Institution
          </Button>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, incharge, mobile..."
              onChange={(e) => debouncedSearch(e.target.value)}
              className="pl-10 rounded-xl"
              disabled={isLoading}
            />
          </div>
          <Select 
            value={typeFilter} 
            onValueChange={handleTypeFilterChange}
            disabled={isLoading}
          >
            <SelectTrigger className="w-48 rounded-xl">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="school">School</SelectItem>
              <SelectItem value="college">College</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Error State */}
        {error && (
          <div className="flex items-center justify-center py-16 text-destructive">
            <span className="text-lg">Failed to load institutions. Please try again.</span>
          </div>
        )}

        {/* Loading State */}
        {(isLoading || isFetching) && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin mr-3" />
            <span className="text-lg">{isFetching ? "Searching..." : "Loading institutions..."}</span>
          </div>
        )}

        {/* Table */}
        {!isLoading && !isFetching && !error && (
          <div className="rounded-2xl border border-slate-200/80 bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                {table.getHeaderGroups().map((g) => (
                  <TableRow key={g.id}>
                    {g.headers.map((h) => (
                      <TableHead key={h.id}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No institutions found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !error && table.getPageCount() > 1 && (
          <div className="flex justify-end mt-6 gap-2">
            <Button 
              variant="outline" 
              size="sm"
              className="rounded-xl" 
              onClick={() => table.previousPage()} 
              disabled={!table.getCanPreviousPage() || isFetching}
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="rounded-xl"
              onClick={() => table.nextPage()} 
              disabled={!table.getCanNextPage() || isFetching}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Remove isLoading prop if InstitutionFormDialog doesn't support it */}
      <InstitutionFormDialog
        open={openForm}
        onOpenChange={handleFormOpenChange}
        institution={editingInstitution}
        onSave={(data) => saveMutation.mutate(data)}
      />

      <AlertDialog open={!!deletingId} onOpenChange={() => !deleteMutation.isPending && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Institution?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the institution and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}