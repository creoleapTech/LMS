import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Clock, Plus, Trash2, Save, Loader2, GripVertical } from "lucide-react";
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

type PeriodRow = IPeriodSlot & { rowKey: string };

function defaultPeriod(num: number): PeriodRow {
  return {
    rowKey: crypto.randomUUID(),
    periodNumber: num,
    label: `Period ${num}`,
    startTime: "08:00",
    endTime: "08:45",
    isBreak: false,
  };
}

function SortablePeriodRow({
  period,
  displayNumber,
  onUpdate,
  onRemove,
}: {
  period: PeriodRow;
  displayNumber: number;
  onUpdate: (field: keyof IPeriodSlot, value: any) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: period.rowKey,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      className={`flex items-center gap-3 p-3 rounded-xl border ${
        period.isBreak ? "bg-slate-50 border-slate-200" : "bg-white border-slate-100"
      }`}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder period"
        title="Drag to reorder"
        className="cursor-grab active:cursor-grabbing touch-none text-slate-400 hover:text-slate-600 shrink-0"
      >
        <GripVertical size={16} />
      </button>

      {/* Period number badge */}
      <span className={`text-sm font-black min-w-[32px] text-center py-1 rounded-lg ${
        period.isBreak
          ? "bg-slate-200 text-slate-600"
          : "bg-indigo-100 text-indigo-700"
      }`}>
        {period.isBreak ? "B" : displayNumber}
      </span>

      {/* Label */}
      <Input
        value={period.label || ""}
        onChange={(e) => onUpdate("label", e.target.value)}
        placeholder="Label"
        className="max-w-[120px] h-8 text-sm rounded-lg"
        maxLength={50}
      />

      {/* Start time */}
      <Input
        type="time"
        value={period.startTime}
        onChange={(e) => onUpdate("startTime", e.target.value)}
        className="max-w-[110px] h-8 text-sm rounded-lg"
      />

      <span className="text-slate-600 font-bold">→</span>

      {/* End time */}
      <Input
        type="time"
        value={period.endTime}
        onChange={(e) => onUpdate("endTime", e.target.value)}
        className="max-w-[110px] h-8 text-sm rounded-lg"
      />

      {/* Break checkbox */}
      <div className="flex items-center gap-1.5">
        <Checkbox
          checked={period.isBreak}
          onCheckedChange={(checked) => onUpdate("isBreak", !!checked)}
        />
        <span className="text-sm text-slate-600 font-medium">Break</span>
      </div>

      {/* Delete */}
      <button
        onClick={onRemove}
        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-600 hover:text-red-500 transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function PeriodConfigSection({ institutionId }: { institutionId?: string } = {}) {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery<IPeriodConfig | null>({
    queryKey: ["period-config", institutionId || "own"],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (institutionId) params.institutionId = institutionId;
      const { data: res } = await _axios.get<{
        success: boolean;
        data: IPeriodConfig | null;
      }>("/admin/period-config", { params });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    if (config) {
      setPeriods(
        config.periods.length > 0
          ? config.periods.map((p) => ({ ...p, rowKey: crypto.randomUUID() }))
          : [defaultPeriod(1)]
      );
      setWorkingDays(config.workingDays);
    } else if (!isLoading) {
      setPeriods([defaultPeriod(1)]);
      setWorkingDays([1, 2, 3, 4, 5]);
    }
  }, [config, isLoading]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  // Renumber: non-break periods get sequential numbers; breaks get high unique numbers
  const renumberedPeriods = useMemo(() => {
    let counter = 0;
    let breakCounter = 0;
    return periods.map((p) => {
      if (!p.isBreak) {
        counter++;
        return { ...p, periodNumber: counter };
      }
      breakCounter++;
      return { ...p, periodNumber: 10000 + breakCounter };
    });
  }, [periods]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        periods: renumberedPeriods.map(({ rowKey: _rowKey, ...p }) => p),
        workingDays,
      };
      if (institutionId) payload.institutionId = institutionId;
      const { data: res } = await _axios.post("/admin/period-config", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["period-config", institutionId || "own"] });
      toast.success("Period schedule saved!");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to save");
    },
  });

  const addPeriod = () => {
    const nonBreakMax = Math.max(0, ...periods.filter((p) => !p.isBreak).map((p) => p.periodNumber));
    const nextNum = nonBreakMax + 1;
    const lastPeriod = periods[periods.length - 1];
    const newPeriod: PeriodRow = {
      rowKey: crypto.randomUUID(),
      periodNumber: nextNum,
      label: `Period ${nextNum}`,
      startTime: lastPeriod?.endTime || "08:00",
      endTime: incrementTime(lastPeriod?.endTime || "08:00", 45),
      isBreak: false,
    };
    setPeriods([...periods, newPeriod]);
  };

  const removePeriod = (rowKey: string) => {
    setPeriods((prev) => prev.filter((p) => p.rowKey !== rowKey));
  };

  const updatePeriod = (rowKey: string, field: keyof IPeriodSlot, value: any) => {
    setPeriods((prev) =>
      prev.map((p) => (p.rowKey === rowKey ? { ...p, [field]: value } : p))
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPeriods((prev) => {
      const oldIndex = prev.findIndex((p) => p.rowKey === active.id);
      const newIndex = prev.findIndex((p) => p.rowKey === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
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
          <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
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
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        {/* Period Rows */}
        <div className="space-y-2">
          <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Periods ({periods.length})
          </Label>
          <p className="text-xs text-slate-500">
            Drag the handle to reorder periods — the saved period numbers follow this order.
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={periods.map((p) => p.rowKey)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {periods.map((period, idx) => (
                  <SortablePeriodRow
                    key={period.rowKey}
                    period={period}
                    displayNumber={renumberedPeriods[idx]?.periodNumber ?? period.periodNumber}
                    onUpdate={(field, value) => updatePeriod(period.rowKey, field, value)}
                    onRemove={() => removePeriod(period.rowKey)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

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
