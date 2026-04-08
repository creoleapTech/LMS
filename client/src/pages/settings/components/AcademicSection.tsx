import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, Clock, Plus, Loader2 } from "lucide-react";
import type { IAcademicYear, IAcademicYearTerm } from "@/types/academic-year";
import { PeriodConfigSection } from "./PeriodConfigSection";
import { useSettingsInstitution } from "../context/SettingsInstitutionContext";
import { useAuthStore } from "@/store/userAuthStore";

export function AcademicSection() {
  const queryClient = useQueryClient();
  const { institutionId: contextInstitutionId } = useSettingsInstitution();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";
  const qsParam = contextInstitutionId ? `?institutionId=${contextInstitutionId}` : "";

  const { data: academicYears, isLoading } = useQuery<IAcademicYear[]>({
    queryKey: ["academic-years", contextInstitutionId],
    queryFn: async () => {
      const { data: res } = await _axios.get<{ success: boolean; data: IAcademicYear[] }>(
        `/admin/academic-year${qsParam}`
      );
      return res.data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !isSuperAdmin || !!contextInstitutionId,
  });

  const activeYear = academicYears?.find((y) => y.isActive);

  // Create academic year form
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newTerms, setNewTerms] = useState<IAcademicYearTerm[]>([]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: res } = await _axios.post("/admin/academic-year", {
        label: newLabel,
        startDate: newStartDate,
        endDate: newEndDate,
        terms: newTerms,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years", contextInstitutionId] });
      toast.success("Academic year created!");
      setShowCreate(false);
      setNewLabel("");
      setNewStartDate("");
      setNewEndDate("");
      setNewTerms([]);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create");
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: res } = await _axios.patch(`/admin/academic-year/${id}/activate`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years", contextInstitutionId] });
      toast.success("Academic year activated!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to activate");
    },
  });

  const addTerm = () => {
    setNewTerms([...newTerms, { label: "", startDate: "", endDate: "" }]);
  };

  const updateTerm = (idx: number, field: keyof IAcademicYearTerm, value: string) => {
    setNewTerms(newTerms.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  };

  const removeTerm = (idx: number) => {
    setNewTerms(newTerms.filter((_, i) => i !== idx));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Current Academic Year */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Current Academic Year
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeYear ? (
            <>
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>{activeYear.label}</span>
                <Badge>Active</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <p className="text-sm">{new Date(activeYear.startDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label>End Date</Label>
                  <p className="text-sm">{new Date(activeYear.endDate).toLocaleDateString()}</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No active academic year</p>
          )}
          <Button
            className="w-full"
            variant="outline"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={14} className="mr-1" />
            Create New Academic Year
          </Button>
        </CardContent>
      </Card>

      {/* Terms */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Terms / Semesters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeYear?.terms && activeYear.terms.length > 0 ? (
            activeYear.terms.map((term, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{term.label}</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(term.startDate).toLocaleDateString()} -{" "}
                  {new Date(term.endDate).toLocaleDateString()}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No terms configured</p>
          )}
        </CardContent>
      </Card>

      {/* All Academic Years */}
      {academicYears && academicYears.length > 1 && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>All Academic Years</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {academicYears.map((year) => (
                <div
                  key={year._id}
                  className="flex items-center justify-between p-3 rounded-xl border"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{year.label}</span>
                    {year.isActive && <Badge>Active</Badge>}
                  </div>
                  {!year.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => activateMutation.mutate(year._id)}
                      disabled={activateMutation.isPending}
                    >
                      Activate
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Academic Year Form */}
      {showCreate && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Create Academic Year</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  placeholder="2026-2027"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Terms */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Terms ({newTerms.length})
              </Label>
              {newTerms.map((term, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border">
                  <Input
                    placeholder="Term label"
                    value={term.label}
                    onChange={(e) => updateTerm(idx, "label", e.target.value)}
                    className="max-w-[160px]"
                  />
                  <Input
                    type="date"
                    value={term.startDate}
                    onChange={(e) => updateTerm(idx, "startDate", e.target.value)}
                  />
                  <Input
                    type="date"
                    value={term.endDate}
                    onChange={(e) => updateTerm(idx, "endDate", e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTerm(idx)}
                    className="text-red-500"
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addTerm} className="gap-1.5">
                <Plus size={14} /> Add Term
              </Button>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !newLabel || !newStartDate || !newEndDate}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 gap-1.5"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period / Bell Schedule */}
      <PeriodConfigSection institutionId={contextInstitutionId || undefined} />
    </div>
  );
}
