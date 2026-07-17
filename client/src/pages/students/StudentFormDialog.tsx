"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, GraduationCap, User, Hash, Mail, AtSign, Lock } from "lucide-react";
import { useEffect } from "react";
import type { IStudent, CreateStudentDTO } from "@/types/student";
import type { IClass } from "@/types/class";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  classId: z.string().min(1, "Class is required"),
  admissionNumber: z.string().max(50).optional().or(z.literal("")),
  rollNumber: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email().max(255).optional().or(z.literal("")),
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username too long").regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers and underscores allowed").optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters").max(128).optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other"]).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: IStudent | null;
  institutionId: string;
  classes: IClass[];
  onSave: (data: CreateStudentDTO) => Promise<void>;
}

export function StudentFormDialog({ open, onOpenChange, student, institutionId, classes, onSave }: Props) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      classId: "",
      admissionNumber: "",
      rollNumber: "",
      email: "",
      username: "",
      password: "",
      gender: "male",
    },
  });

  // Watch values for select components default value handling if needed,
  // but usually we rely on setValue and standard React Hook Form integration.

  useEffect(() => {
    if (open) {
      if (student) {
        // Handle populated classId if necessary
        const clsId = typeof student.classId === 'object' && student.classId ? (student.classId as any)._id : student.classId;

        reset({
          name: student.name,
          classId: clsId || "",
          admissionNumber: student.admissionNumber || "",
          rollNumber: student.rollNumber || "",
          email: student.email || "",
          username: student.username || "",
          password: "",
          gender: (student.gender as any) || "male",
        });
      } else {
        reset({
          name: "",
          classId: "",
          admissionNumber: "",
          rollNumber: "",
          email: "",
          username: "",
          password: "",
          gender: "male",
        });
      }
    }
  }, [student, reset, open]);

  const onSubmit = async (values: FormValues) => {
    try {
      await onSave({
        ...values,
        institutionId,
      });
      // reset();
    } catch (error) {
      // Error handled in parent
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto rounded-2xl p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--neo-bg)] border-b border-white/30 px-6 pt-6 pb-4 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold leading-tight">
                {student ? "Edit Student" : "Add Student"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                {student ? "Update the student's enrollment details." : "Enroll a new student into the institution."}
              </DialogDescription>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 pt-4 space-y-5">
          {/* Student Info */}
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Student Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium">Full Name <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="name" placeholder="Student Full Name" {...register("name")} className="pl-9" />
                </div>
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="classId" className="text-sm font-medium">Class <span className="text-destructive">*</span></Label>
                <Select onValueChange={(val) => setValue("classId", val, { shouldValidate: true })} defaultValue={watch("classId")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes
                      .filter(cls => cls.isActive || (student && (typeof student.classId === 'string' ? student.classId === cls._id : student.classId._id === cls._id)))
                      .map((cls) => (
                        <SelectItem key={cls._id} value={cls._id}>
                          Class {cls.grade} – {cls.section} ({cls.year}) {!cls.isActive ? "· Inactive" : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {errors.classId && <p className="text-sm text-destructive">{errors.classId.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gender" className="text-sm font-medium">Gender</Label>
                <Select onValueChange={(val) => setValue("gender", val as any)} defaultValue={watch("gender") || "male"}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">♂ Male</SelectItem>
                    <SelectItem value="female">♀ Female</SelectItem>
                    <SelectItem value="other">⚥ Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">Email <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="student@example.com" {...register("email")} className="pl-9" />
                </div>
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
            </div>
          </div>

          {/* Login Credentials */}
          <div className="space-y-4 pt-1">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Login Credentials <span className="font-normal normal-case text-muted-foreground">{student ? "(leave blank to keep current)" : "(optional — auto-generated if skipped)"}</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-sm font-medium">Username</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="username" placeholder="e.g. student01" {...register("username")} className="pl-9" />
                </div>
                {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type="password" placeholder={student ? "••••••••" : "Set a password"} {...register("password")} className="pl-9" />
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
              </div>
            </div>
          </div>

          {/* Academic IDs */}
          <div className="space-y-4 pt-1">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Academic IDs <span className="font-normal normal-case text-muted-foreground">(optional)</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="admissionNumber" className="text-sm font-medium">Admission Number</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="admissionNumber" placeholder="e.g. ADM-2024-001" {...register("admissionNumber")} className="pl-9" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rollNumber" className="text-sm font-medium">Roll Number</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="rollNumber" placeholder="e.g. 25" {...register("rollNumber")} className="pl-9" />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t border-white/20">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {student ? "Update Student" : "Enroll Student"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}