import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { useAuthStore } from "@/store/userAuthStore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  Building2,
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  Timer,
} from "lucide-react";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PAGE_SIZE = 30;

interface WorkDoneEntry {
  _id: string;
  id: string;
  staffId: string;
  classId: string;
  institutionId: string;
  gradeBookId?: string;
  periodNumber: number;
  dayOfWeek: number;
  status: string;
  completedAt: string;
  notes?: string;
  createdAt: string;
  topicsCovered: string[];
  durationMinutes?: number;
  staff: { _id: string; name: string; email: string } | null;
  class: { _id: string; grade: string; section: string } | null;
  institution: { _id: string; name: string } | null;
  gradeBook: { _id: string; bookTitle: string } | null;
}

interface WorkDoneResponse {
  entries: WorkDoneEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function useWorkDone(params: {
  institutionId?: string;
  staffId?: string;
  startDate?: string;
  endDate?: string;
  page: number;
}) {
  return useQuery<WorkDoneResponse>({
    queryKey: ["work-done", params],
    queryFn: async () => {
      const query: Record<string, string> = {
        page: String(params.page),
        limit: String(PAGE_SIZE),
      };
      if (params.institutionId) query.institutionId = params.institutionId;
      if (params.staffId) query.staffId = params.staffId;
      if (params.startDate) query.startDate = params.startDate;
      if (params.endDate) query.endDate = params.endDate;

      const { data: res } = await _axios.get<{
        success: boolean;
        data: WorkDoneResponse;
      }>("/admin/timetable/work-done", { params: query });
      return res.data;
    },
    staleTime: 30 * 1000,
  });
}

const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function WorkDonePage() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin";

  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [startDate, setStartDate] = useState(fmt(thirtyDaysAgo));
  const [endDate, setEndDate] = useState(fmt(today));
  const [page, setPage] = useState(1);

  // Applied filters (only update on "Search" click)
  const [applied, setApplied] = useState<{
    institutionId?: string;
    staffId?: string;
    startDate?: string;
    endDate?: string;
    page: number;
  }>({
    startDate: fmt(thirtyDaysAgo),
    endDate: fmt(today),
    page: 1,
  });

  // Institutions
  const { data: institutions = [] } = useQuery<{ _id: string; name: string }[]>({
    queryKey: ["institutions-list"],
    queryFn: async () => {
      const res = await _axios.get("/admin/institutions");
      return res.data?.data ?? [];
    },
    enabled: isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });

  // Staff list
  const { data: staffList = [] } = useQuery<{ _id: string; name: string; email: string }[]>({
    queryKey: ["staff-list", applied.institutionId],
    queryFn: async () => {
      const res = await _axios.get<{ success: boolean; data: any[] }>(
        "/admin/timetable/staff-list",
        { params: { institutionId: applied.institutionId === "all" ? "" : applied.institutionId } }
      );
      return res.data?.data ?? [];
    },
    enabled: !!(applied.institutionId || (isAdmin && user?.institutionId)),
    staleTime: 2 * 60 * 1000,
  });

  // Admin's institution ID
  const adminInstitutionId =
    isAdmin && user?.institutionId
      ? typeof user.institutionId === "object"
        ? (user.institutionId as any)._id
        : user.institutionId
      : "";

  // Auto-fetch institution ID for admin
  const effectiveInstitutionId = isSuperAdmin
    ? (applied.institutionId === "all" ? "" : applied.institutionId)
    : adminInstitutionId || "";

  const { data, isLoading } = useWorkDone({
    institutionId: effectiveInstitutionId,
    staffId: applied.staffId === "all" ? "" : applied.staffId,
    startDate: applied.startDate,
    endDate: applied.endDate,
    page: applied.page,
  });

  const entries = data?.entries || [];
  const pagination = data?.pagination;

  const handleSearch = () => {
    setApplied({
      institutionId: selectedInstitutionId === "all" ? "" : selectedInstitutionId,
      staffId: selectedStaffId === "all" ? "" : selectedStaffId,
      startDate,
      endDate,
      page: 1,
    });
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setApplied((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl text-white shadow-lg">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Work Done</h1>
          <p className="text-sm text-slate-500">
            View completed class entries across all teachers
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="neo-card p-4 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          {isSuperAdmin && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Building2 size={12} />
                Institution
              </label>
              <Select
                value={selectedInstitutionId}
                onValueChange={(v) => {
                  setSelectedInstitutionId(v);
                  setSelectedStaffId("");
                }}
              >
                <SelectTrigger className="w-56 rounded-xl">
                  <SelectValue placeholder="All Institutions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Institutions</SelectItem>
                  {institutions.map((inst) => (
                    <SelectItem key={inst._id} value={inst._id}>
                      {inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Users size={12} />
              Teacher
            </label>
            <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
              <SelectTrigger className="w-56 rounded-xl">
                <SelectValue placeholder="All Teachers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teachers</SelectItem>
                {staffList.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">From</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40 rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">To</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40 rounded-xl"
            />
          </div>

          <Button
            onClick={handleSearch}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
          >
            <Search size={14} className="mr-1" />
            Search
          </Button>
        </div>
      </div>

      {/* Results */}
      <div className="neo-card overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                  <TableHead className="hidden md:table-cell"><Skeleton className="h-4 w-32" /></TableHead>
                  <TableHead className="hidden md:table-cell"><Skeleton className="h-4 w-12" /></TableHead>
                  <TableHead className="hidden lg:table-cell"><Skeleton className="h-4 w-20" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j} className={j >= 4 && j <= 5 ? "hidden md:table-cell" : j === 6 ? "hidden lg:table-cell" : ""}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-semibold">No completed entries found</p>
            <p className="text-slate-400 text-sm mt-1">
              Try adjusting your filters to see more results.
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-400">Date</TableHead>
                  <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-400">Teacher</TableHead>
                  <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-400">Class</TableHead>
                  <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-400">Subject</TableHead>
                  <TableHead className="hidden md:table-cell text-[11px] font-black uppercase tracking-wider text-slate-400">Topics</TableHead>
                  <TableHead className="hidden md:table-cell text-[11px] font-black uppercase tracking-wider text-slate-400">Time</TableHead>
                  {isSuperAdmin && (
                    <TableHead className="hidden lg:table-cell text-[11px] font-black uppercase tracking-wider text-slate-400">Institution</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry._id} className="border-b border-white/20 hover:bg-white/20">
                    <TableCell>
                      <span className="text-sm font-semibold text-slate-700">
                        {formatDate(entry.completedAt)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        P{entry.periodNumber}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-semibold text-slate-800">
                        {entry.staff?.name || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-semibold text-slate-700">
                        {entry.class
                          ? `${entry.class.grade}–${entry.class.section}`
                          : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-600">
                        {entry.gradeBook?.bookTitle || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {entry.topicsCovered?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {entry.topicsCovered.map((t, i) => (
                            <span
                              key={i}
                              className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400 italic">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1 text-xs text-slate-600">
                        <Clock size={11} />
                        {formatTime(entry.completedAt)}
                        {entry.durationMinutes && (
                          <>
                            <span className="mx-1">·</span>
                            <Timer size={11} />
                            {entry.durationMinutes}m
                          </>
                        )}
                      </div>
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm text-slate-600">
                          {entry.institution?.name || "—"}
                        </span>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-white/30">
                <span className="text-xs text-slate-500 font-semibold">
                  {pagination.total} entries · Page {pagination.page} of{" "}
                  {pagination.totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className="rounded-xl"
                  >
                    <ChevronLeft size={14} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= pagination.totalPages}
                    className="rounded-xl"
                  >
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
