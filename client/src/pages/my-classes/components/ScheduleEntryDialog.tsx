import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { CalendarDays, BookOpen, Repeat, Loader2, GraduationCap, ChevronsUpDown, Calendar, RefreshCw } from "lucide-react";
import { useTimetableMutations } from "../hooks/useTimetableMutations";
import type {
  ITimetableEntry,
  IClassOption,
  IGradeBookOption,
} from "@/types/timetable";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface ScheduleEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodNumber: number;
  dayOfWeek: number;
  specificDate: string;
  entry?: ITimetableEntry;
}

export function ScheduleEntryDialog({
  open,
  onOpenChange,
  periodNumber,
  dayOfWeek,
  specificDate,
  entry,
}: ScheduleEntryDialogProps) {
  const isEdit = !!entry;
  const { createEntry, updateEntry } = useTimetableMutations();

  const [classId, setClassId] = useState("");
  const [gradeBookId, setGradeBookId] = useState("");
  const [additionalClassId, setAdditionalClassId] = useState("");
  const [notes, setNotes] = useState("");
  const [isRecurring, setIsRecurring] = useState(true);
  const [selectedGrade, setSelectedGrade] = useState("");
  const [classDropdownOpen, setClassDropdownOpen] = useState(false);
  const [editScope, setEditScope] = useState<"day" | "all">("day");
  const classDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch teacher's classes
  const { data: classes } = useQuery<IClassOption[]>({
    queryKey: ["my-classes-list"],
    queryFn: async () => {
      const { data: res } = await _axios.get<{
        success: boolean;
        data: IClassOption[];
      }>("/admin/timetable/my-classes-list");
      return res.data;
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const sortedClasses = useMemo(() => {
    return [...(classes || [])].sort((a, b) => {
      const gradeA = parseInt(a.grade, 10);
      const gradeB = parseInt(b.grade, 10);
      if (!Number.isNaN(gradeA) && !Number.isNaN(gradeB) && gradeA !== gradeB) {
        return gradeA - gradeB;
      }
      const gradeCmp = String(a.grade).localeCompare(String(b.grade));
      if (gradeCmp !== 0) return gradeCmp;
      return a.section.localeCompare(b.section);
    });
  }, [classes]);

  const availableAdditionalClasses = useMemo(() => {
    return (classes || []).filter((c) => {
      if (c._id === classId) return false;
      if (selectedGrade && c.grade) return c.grade === selectedGrade;
      return true;
    });
  }, [classes, classId, selectedGrade]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (classDropdownRef.current && !classDropdownRef.current.contains(e.target as Node)) {
        setClassDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedClassLabel = useMemo(() => {
    const cls = classes?.find((c) => c._id === classId);
    return cls ? `Grade ${cls.grade}–${cls.section}${cls.year ? ` (${cls.year})` : ""}` : "Select class...";
  }, [classes, classId]);

  // Fetch gradebooks when grade is selected
  const { data: gradeBooks } = useQuery<IGradeBookOption[]>({
    queryKey: ["timetable-gradebooks", selectedGrade],
    queryFn: async () => {
      const { data: res } = await _axios.get<{
        success: boolean;
        data: IGradeBookOption[];
      }>("/admin/timetable/gradebooks", {
        params: { grade: selectedGrade },
      });
      return res.data;
    },
    enabled: !!selectedGrade && open,
    staleTime: 5 * 60 * 1000,
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (entry) {
        const cid = typeof entry.classId === "object" ? entry.classId._id : entry.classId;
        const gbid = entry.gradeBookId
          ? typeof entry.gradeBookId === "object"
            ? entry.gradeBookId._id
            : entry.gradeBookId
          : "";
        setClassId(cid);
        setGradeBookId(gbid);
        setAdditionalClassId(
          entry.additionalClassId
            ? (typeof entry.additionalClassId === "object" ? entry.additionalClassId._id : entry.additionalClassId)
            : ""
        );
        setNotes(entry.notes || "");
        setIsRecurring(entry.isRecurring);
        setEditScope("day");
        // Set grade from classId
        if (typeof entry.classId === "object" && entry.classId.grade) {
          setSelectedGrade(entry.classId.grade);
        }
      } else {
        setClassId("");
        setGradeBookId("");
        setAdditionalClassId("");
        setNotes("");
        setIsRecurring(true);
        setSelectedGrade("");
        setClassDropdownOpen(false);
        setEditScope("day");
      }
    }
  }, [open, entry]);

  // Update grade when class changes
  const handleClassChange = (cid: string) => {
    setClassId(cid);
    setGradeBookId("");
    const cls = classes?.find((c) => c._id === cid);
    if (cls) setSelectedGrade(cls.grade);
  };

  const handleSubmit = () => {
    if (!classId) return;

    if (isEdit && entry) {
      updateEntry.mutate(
        {
          id: entry._id,
          data: {
            classId,
            gradeBookId: gradeBookId || undefined,
            additionalClassId: additionalClassId || null,
            notes: notes || undefined,
            date: entry.isRecurring && editScope === "day" ? specificDate : undefined,
          },
        },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createEntry.mutate(
        {
          classId,
          gradeBookId: gradeBookId || undefined,
          additionalClassId: additionalClassId || null,
          periodNumber,
          dayOfWeek,
          isRecurring,
          specificDate: isRecurring ? undefined : specificDate,
          notes: notes || undefined,
        },
        { onSuccess: () => onOpenChange(false) }
      );
    }
  };

  const isPending = createEntry.isPending || updateEntry.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl p-0">
        <div className="sticky top-0 z-10 bg-white border-b px-6 pt-6 pb-4 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl text-white">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {isEdit ? "Edit Schedule" : "Add Schedule"}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                {DAY_NAMES[dayOfWeek]} · Period {periodNumber}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 space-y-4">
          {/* Edit scope toggle (recurring entries only) */}
          {isEdit && entry?.isRecurring && (
            <div className="flex rounded-xl border border-slate-200 p-0.5 bg-slate-100">
              <button
                type="button"
                onClick={() => setEditScope("day")}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 px-3 rounded-[10px] transition-all cursor-pointer ${
                  editScope === "day"
                    ? "bg-white text-indigo-700 shadow-sm border border-slate-200"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Calendar size={13} />
                This day only
              </button>
              <button
                type="button"
                onClick={() => setEditScope("all")}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 px-3 rounded-[10px] transition-all cursor-pointer ${
                  editScope === "all"
                    ? "bg-white text-violet-700 shadow-sm border border-slate-200"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <RefreshCw size={13} />
                All recurring days
              </button>
            </div>
          )}

          {/* Class select */}
          <div className="space-y-1.5" ref={classDropdownRef}>
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Class
            </Label>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={classDropdownOpen}
              onClick={() => setClassDropdownOpen(!classDropdownOpen)}
              className="w-full justify-between rounded-xl font-normal"
            >
              <span className={classId ? "text-slate-900" : "text-slate-400"}>
                {selectedClassLabel}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
            {classDropdownOpen && (
              <div className="relative z-50">
                <div className="absolute top-0 left-0 right-0 mt-1 rounded-xl border bg-white shadow-lg">
                  <Command>
                    <CommandInput placeholder="Search classes..." />
                    <CommandList>
                      <CommandEmpty>No classes found</CommandEmpty>
                      <CommandGroup>
                        {sortedClasses.map((cls) => (
                          <CommandItem
                            key={cls._id}
                            value={`Grade ${cls.grade} ${cls.section} ${cls.year || ""}`}
                            onSelect={() => {
                              handleClassChange(cls._id);
                              setClassDropdownOpen(false);
                            }}
                          >
                            Grade {cls.grade}–{cls.section}
                            {cls.year ? ` (${cls.year})` : ""}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </div>
              </div>
            )}
          </div>

          {/* Combined Class */}
          {(isEdit || availableAdditionalClasses.length > 0) && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <GraduationCap size={12} />
                Combined Class
              </Label>
              <Select
                value={additionalClassId || "__none__"}
                onValueChange={(v) => setAdditionalClassId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="None (single class)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (single class)</SelectItem>
                  {availableAdditionalClasses.map((cls) => (
                    <SelectItem key={cls._id} value={cls._id}>
                      Grade {cls.grade}–{cls.section}
                      {cls.year ? ` (${cls.year})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-400">
                Select if two classes are combined into this period
              </p>
            </div>
          )}

          {/* Subject / GradeBook select */}
          {selectedGrade && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                <BookOpen size={12} className="inline mr-1" />
                Subject / Book
              </Label>
              <Select value={gradeBookId} onValueChange={setGradeBookId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select subject (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {gradeBooks?.map((gb) => (
                    <SelectItem key={gb._id} value={gb._id}>
                      {gb.bookTitle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Notes
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes for this period..."
              className="rounded-xl resize-none"
              rows={2}
            />
          </div>

          {/* Recurring toggle (only for new entries) */}
          {!isEdit && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100">
              <div className="flex items-center gap-2">
                <Repeat size={16} className="text-violet-600" />
                <div>
                  <p className="text-sm font-bold text-slate-800">Recurring</p>
                  <p className="text-[11px] text-slate-500">
                    {isRecurring
                      ? `Repeats every ${DAY_NAMES[dayOfWeek]} at Period ${periodNumber}`
                      : "Only for this specific date"}
                  </p>
                </div>
              </div>
              <Switch
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!classId || isPending}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isEdit ? (
                "Update"
              ) : (
                "Add Schedule"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
