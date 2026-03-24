"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
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
    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            grade: "",
            section: "",
            year: "",
        },
    });

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
            // reset(); // handled by parent or useEffect
        } catch (error) {
            // Error handled in parent
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{cls ? "Edit Class" : "Add Class"}</DialogTitle>
                    <DialogDescription>
                        {cls ? "Update class details." : "Create a new class for this institution."}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="grade">Grade / Standard</Label>
                        <Input id="grade" placeholder="e.g. 10, XII, 5" {...register("grade")} />
                        {errors.grade && <p className="text-sm text-destructive">{errors.grade.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="section">Section</Label>
                        <Input id="section" placeholder="e.g. A, B, Rose" {...register("section")} />
                        {errors.section && <p className="text-sm text-destructive">{errors.section.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="year">Academic Year</Label>
                        <Input id="year" placeholder="e.g. 2024-2025" {...register("year")} />
                        {errors.year && <p className="text-sm text-destructive">{errors.year.message}</p>}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {cls ? "Update Class" : "Create Class"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
