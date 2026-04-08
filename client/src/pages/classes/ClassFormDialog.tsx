"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, LayoutGrid, Hash, Tag, CalendarDays } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { useAuthStore } from "@/store/userAuthStore";
import type { IClass, CreateClassDTO } from "@/types/class";

const formSchema = z.object({
    grade: z.string().max(50).optional(),
    section: z.string().min(1, "Section is required").max(10),
    year: z.string().max(50).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    cls?: IClass | null;
    institutionId: string;
    onSave: (data: CreateClassDTO) => Promise<void>;
}

export function ClassFormDialog({ open, onOpenChange, cls, institutionId, onSave }: Props) {
    const user = useAuthStore((s) => s.user);
    const isSuperAdmin = user?.role === "super_admin";

    const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            grade: "",
            section: "",
            year: "",
        },
    });

    // Fetch enabled grades from curriculum access
    // Admin/teacher/staff: GET /admin/filtered-curriculum/ (auto-scoped to their institution)
    // Super admin: GET /admin/institutions/:id/curriculum-access (scoped to selected institution)
    const { data: gradesData } = useQuery({
        queryKey: isSuperAdmin
            ? ["institution-curriculum-access", institutionId]
            : ["filtered-curriculum"],
        queryFn: async () => {
            if (isSuperAdmin) {
                const res = await _axios.get(`/admin/institutions/${institutionId}/curriculum-access`);
                return res.data?.data ?? [];
            } else {
                const res = await _axios.get("/admin/filtered-curriculum");
                return res.data?.data ?? [];
            }
        },
        enabled: !!institutionId && open,
        staleTime: 5 * 60 * 1000,
    });

    const enabledGrades = useMemo(() => {
        if (!gradesData || !Array.isArray(gradesData)) return [];

        let grades: number[] = [];
        if (isSuperAdmin) {
            // curriculum-access response: array of { curriculumId, accessibleGradeBooks: [{ grade, bookTitle, ... }] }
            grades = gradesData.flatMap((access: any) =>
                (access.accessibleGradeBooks || []).map((book: any) => book.grade)
            );
        } else {
            // filtered-curriculum response: array of { gradeBooks: [{ grade, ... }] }
            grades = gradesData.flatMap((curriculum: any) =>
                (curriculum.gradeBooks || []).map((book: any) => book.grade)
            );
        }

        return [...new Set(grades)].filter(Boolean).sort((a, b) => a - b);
    }, [gradesData, isSuperAdmin]);

    useEffect(() => {
        if (open) {
            if (cls) {
                reset({
                    grade: cls.grade || "",
                    section: cls.section,
                    year: cls.year || "",
                });
            } else {
                reset({
                    grade: "",
                    section: "",
                    year: new Date().getFullYear().toString(),
                });
            }
        }
    }, [cls, reset, open]);

    const onSubmit = async (values: FormValues) => {
        try {
            await onSave({
                ...values,
                institutionId,
            });
        } catch (error) {
            // Error handled in parent
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-0">
                <div className="sticky top-0 z-10 bg-[var(--neo-bg)] border-b border-white/30 px-6 pt-6 pb-4 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
                            <LayoutGrid className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-semibold leading-tight">
                                {cls ? "Edit Class" : "Add Class"}
                            </DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                                {cls ? "Update the class details below." : "Create a new class for this institution."}
                            </DialogDescription>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 pt-4 space-y-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Class Details</p>

                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium">Grade / Standard</Label>
                        {enabledGrades.length > 0 ? (
                            <Controller
                                name="grade"
                                control={control}
                                render={({ field }) => (
                                    <Select value={field.value || ""} onValueChange={field.onChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select grade" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {enabledGrades.map((g) => (
                                                <SelectItem key={g} value={String(g)}>
                                                    Grade {g}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        ) : (
                            <div className="relative">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input className="pl-9" placeholder="e.g. 10, XII, 5" {...register("grade")} />
                            </div>
                        )}
                        {errors.grade && <p className="text-xs text-destructive">{errors.grade.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="section" className="text-sm font-medium">
                            Section <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input id="section" className="pl-9" placeholder="e.g. A, B, Rose" {...register("section")} />
                        </div>
                        {errors.section && <p className="text-xs text-destructive">{errors.section.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="year" className="text-sm font-medium">Academic Year</Label>
                        <div className="relative">
                            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input id="year" className="pl-9" placeholder="e.g. 2024-2025" {...register("year")} />
                        </div>
                        {errors.year && <p className="text-xs text-destructive">{errors.year.message}</p>}
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t border-white/20">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {cls ? "Update Class" : "Create Class"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
