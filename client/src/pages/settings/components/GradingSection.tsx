import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { GraduationCap, Save, Loader2, Plus, Trash2 } from "lucide-react";
import type { IInstitutionSettings, IGradeScaleEntry } from "@/types/settings";

const DEFAULT_GRADES: IGradeScaleEntry[] = [
  { grade: "O", label: "Outstanding", minPercentage: 90, maxPercentage: 100 },
  { grade: "A+", label: "Excellent", minPercentage: 80, maxPercentage: 89 },
  { grade: "A", label: "Very Good", minPercentage: 70, maxPercentage: 79 },
  { grade: "B+", label: "Good", minPercentage: 60, maxPercentage: 69 },
  { grade: "C", label: "Average", minPercentage: 50, maxPercentage: 59 },
  { grade: "D", label: "Below Average", minPercentage: 40, maxPercentage: 49 },
  { grade: "F", label: "Fail", minPercentage: 0, maxPercentage: 39 },
];

export function GradingSection() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<IInstitutionSettings | null>({
    queryKey: ["settings", "institution-settings"],
    queryFn: async () => {
      const { data: res } = await _axios.get<{ success: boolean; data: IInstitutionSettings | null }>(
        "/admin/settings/institution"
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const [gradingScale, setGradingScale] = useState<IGradeScaleEntry[]>(DEFAULT_GRADES);
  const [passingMarks, setPassingMarks] = useState(40);

  useEffect(() => {
    if (settings) {
      setGradingScale(
        settings.gradingScale?.length > 0 ? settings.gradingScale : DEFAULT_GRADES
      );
      setPassingMarks(settings.passingMarks ?? 40);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: res } = await _axios.put("/admin/settings/institution", {
        gradingScale,
        passingMarks,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "institution-settings"] });
      toast.success("Grading system saved!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save");
    },
  });

  const addGrade = () => {
    setGradingScale([
      ...gradingScale,
      { grade: "", label: "", minPercentage: 0, maxPercentage: 0 },
    ]);
  };

  const removeGrade = (idx: number) => {
    setGradingScale(gradingScale.filter((_, i) => i !== idx));
  };

  const updateGrade = (idx: number, field: keyof IGradeScaleEntry, value: string | number) => {
    setGradingScale(
      gradingScale.map((g, i) => (i === idx ? { ...g, [field]: value } : g))
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" /> Grading System
        </CardTitle>
        <CardDescription>Define grade scales and passing criteria</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Grade Scale Display */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold">Grading Scale</h4>
            <Button variant="outline" size="sm" onClick={addGrade} className="gap-1.5">
              <Plus size={14} /> Add Grade
            </Button>
          </div>

          <div className="space-y-2">
            {gradingScale.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border bg-white">
                <Input
                  value={entry.grade}
                  onChange={(e) => updateGrade(idx, "grade", e.target.value)}
                  placeholder="Grade"
                  className="max-w-[80px] h-8 text-sm"
                />
                <Input
                  value={entry.label}
                  onChange={(e) => updateGrade(idx, "label", e.target.value)}
                  placeholder="Label"
                  className="max-w-[160px] h-8 text-sm"
                />
                <Input
                  type="number"
                  value={entry.minPercentage}
                  onChange={(e) => updateGrade(idx, "minPercentage", Number(e.target.value))}
                  placeholder="Min %"
                  className="max-w-[80px] h-8 text-sm"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="number"
                  value={entry.maxPercentage}
                  onChange={(e) => updateGrade(idx, "maxPercentage", Number(e.target.value))}
                  placeholder="Max %"
                  className="max-w-[80px] h-8 text-sm"
                />
                <Badge variant="secondary" className="text-xs whitespace-nowrap">
                  {entry.minPercentage}-{entry.maxPercentage}%
                </Badge>
                <button
                  onClick={() => removeGrade(idx)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Passing Marks */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <Label>Passing Marks</Label>
            <p className="text-sm text-muted-foreground">Minimum marks required to pass a subject</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={passingMarks}
              onChange={(e) => setPassingMarks(Number(e.target.value))}
              className="w-24"
              min={0}
              max={100}
            />
            <span>%</span>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 gap-1.5"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Update Grading System
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
