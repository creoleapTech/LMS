import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Clock, Plus, Trash2, Save, Loader2 } from "lucide-react";
import type { IPeriodConfig, IPeriodSlot } from "@/types/timetable";

const DAY_OPTIONS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

function defaultPeriod(num: number): IPeriodSlot {
  return {
    periodNumber: num,
    label: `Period ${num}`,
    startTime: "08:00",
    endTime: "08:45",
    isBreak: false,
  };
}

export function PeriodConfigSection() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery<IPeriodConfig | null>({
    queryKey: ["period-config"],
    queryFn: async () => {
      const { data: res } = await _axios.get<{
        success: boolean;
        data: IPeriodConfig | null;
      }>("/admin/period-config");
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const [periods, setPeriods] = useState<IPeriodSlot[]>([]);
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    if (config) {
      setPeriods(config.periods.length > 0 ? config.periods : [defaultPeriod(1)]);
      setWorkingDays(config.workingDays);
    } else if (!isLoading) {
      setPeriods([defaultPeriod(1)]);
      setWorkingDays([1, 2, 3, 4, 5]);
    }
  }, [config, isLoading]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: res } = await _axios.post("/admin/period-config", {
        periods,
        workingDays,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["period-config"] });
      toast.success("Period schedule saved!");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to save");
    },
  });

  const addPeriod = () => {
    const nextNum = periods.length > 0 ? Math.max(...periods.map((p) => p.periodNumber)) + 1 : 1;
    const lastPeriod = periods[periods.length - 1];
    const newPeriod: IPeriodSlot = {
      periodNumber: nextNum,
      label: `Period ${nextNum}`,
      startTime: lastPeriod?.endTime || "08:00",
      endTime: incrementTime(lastPeriod?.endTime || "08:00", 45),
      isBreak: false,
    };
    setPeriods([...periods, newPeriod]);
  };

  const removePeriod = (idx: number) => {
    setPeriods(periods.filter((_, i) => i !== idx));
  };

  const updatePeriod = (idx: number, field: keyof IPeriodSlot, value: any) => {
    setPeriods(periods.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const toggleWorkingDay = (day: number) => {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
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
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" /> Period / Bell Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Working Days */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Working Days
          </Label>
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map((day) => (
              <button
                key={day.value}
                onClick={() => toggleWorkingDay(day.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  workingDays.includes(day.value)
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        {/* Period Rows */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Periods ({periods.length})
          </Label>

          <div className="space-y-2">
            {periods.map((period, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                  period.isBreak
                    ? "bg-slate-50 border-slate-200"
                    : "bg-white border-slate-100"
                }`}
              >
                {/* Period number badge */}
                <span className={`text-xs font-black min-w-[32px] text-center py-1 rounded-lg ${
                  period.isBreak
                    ? "bg-slate-200 text-slate-500"
                    : "bg-indigo-100 text-indigo-700"
                }`}>
                  {period.isBreak ? "B" : period.periodNumber}
                </span>

                {/* Label */}
                <Input
                  value={period.label || ""}
                  onChange={(e) => updatePeriod(idx, "label", e.target.value)}
                  placeholder="Label"
                  className="max-w-[120px] h-8 text-sm rounded-lg"
                />

                {/* Start time */}
                <Input
                  type="time"
                  value={period.startTime}
                  onChange={(e) => updatePeriod(idx, "startTime", e.target.value)}
                  className="max-w-[110px] h-8 text-sm rounded-lg"
                />

                <span className="text-slate-400 font-bold">→</span>

                {/* End time */}
                <Input
                  type="time"
                  value={period.endTime}
                  onChange={(e) => updatePeriod(idx, "endTime", e.target.value)}
                  className="max-w-[110px] h-8 text-sm rounded-lg"
                />

                {/* Break checkbox */}
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    checked={period.isBreak}
                    onCheckedChange={(checked) =>
                      updatePeriod(idx, "isBreak", !!checked)
                    }
                  />
                  <span className="text-xs text-slate-500 font-medium">Break</span>
                </div>

                {/* Delete */}
                <button
                  onClick={() => removePeriod(idx)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={addPeriod}
            className="rounded-xl gap-1.5"
          >
            <Plus size={14} />
            Add Period
          </Button>
        </div>

        {/* Save */}
        <div className="flex justify-end pt-2 border-t">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || periods.length === 0}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 gap-1.5"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Save Schedule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function incrementTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}
