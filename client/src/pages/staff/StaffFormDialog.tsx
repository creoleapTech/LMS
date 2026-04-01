// src/components/staff/StaffFormDialog.tsx
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Eye, EyeOff, Copy, RefreshCw, UserCircle, Mail, Smartphone, BookOpen, CalendarDays, ShieldCheck, KeyRound } from "lucide-react";
import type { IStaff, CreateStaffDTO, StaffType } from "@/types/staff";
import { toast } from "sonner";

const staffSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  mobileNumber: z.string().min(10, "Mobile number too short"),
  type: z.enum(["teacher", "admin"]),
  subjects: z.string().optional(), // We'll handle comma-separated string <-> array conversion
  joiningDate: z.string(),
  password: z.string().optional(),
});

type FormValues = z.infer<typeof staffSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff?: IStaff | null;
  onSave: (data: CreateStaffDTO) => Promise<void>; // Updated to Promise for loading state
}

export function StaffFormDialog({ open, onOpenChange, staff, onSave }: Props) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: { type: "teacher", joiningDate: new Date().toISOString().split("T")[0] },
  });

  const [showPassword, setShowPassword] = useState(false);
  const passwordValue = watch("password");

  useEffect(() => {
    if (open) {
      if (staff) {
        reset({
          name: staff.name,
          email: staff.email,
          mobileNumber: staff.mobileNumber,
          type: staff.type as StaffType,
          subjects: staff.subjects?.join(", ") || "",
          joiningDate: staff.joiningDate ? new Date(staff.joiningDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        });
      } else {
        reset({
          name: "",
          email: "",
          mobileNumber: "",
          type: "teacher",
          subjects: "",
          joiningDate: new Date().toISOString().split("T")[0],
          password: "",
        });
      }
    }
  }, [staff, open, reset]);

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setValue("password", pass);
  };

  const copyToClipboard = () => {
    if (passwordValue) {
      navigator.clipboard.writeText(passwordValue);
      toast.success("Password copied to clipboard");
    }
  };

  const onSubmit = async (data: FormValues) => {
    const payload: any = {
      ...data,
      subjects: data.subjects ? data.subjects.split(",").map(s => s.trim()).filter(Boolean) : [],
    };
    await onSave(payload);
    // onOpenChange(false); // Let parent handle closing on success
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b px-6 pt-6 pb-4 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 shrink-0">
              <UserCircle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold leading-tight">
                {staff ? "Edit Staff Member" : "Add Staff Member"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                {staff ? "Update the staff member's information." : "Onboard a new teacher or admin to this institution."}
              </DialogDescription>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 pt-4 space-y-5">
          {/* Personal Info */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Personal Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="staff-name" className="text-sm font-medium">Full Name <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="staff-name" {...register("name")} placeholder="John Doe" className="pl-9" />
                </div>
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-email" className="text-sm font-medium">Email <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="staff-email" type="email" {...register("email")} placeholder="john@school.edu" className="pl-9" />
                </div>
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-mobile" className="text-sm font-medium">Mobile Number <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="staff-mobile" {...register("mobileNumber")} placeholder="+91 98765 43210" className="pl-9" />
                </div>
                {errors.mobileNumber && <p className="text-xs text-destructive">{errors.mobileNumber.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-date" className="text-sm font-medium">Joining Date <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="staff-date" type="date" {...register("joiningDate")} className="pl-9" />
                </div>
                {errors.joiningDate && <p className="text-xs text-destructive">Date required</p>}
              </div>
            </div>
          </div>

          {/* Role & Subjects */}
          <div className="space-y-4 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role & Expertise</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Role <span className="text-destructive">*</span></Label>
                <Select onValueChange={(v) => setValue("type", v as StaffType)} defaultValue={staff?.type || "teacher"}>
                  <SelectTrigger className="w-full">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground mr-2" />
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">👩‍🏫 Teacher</SelectItem>
                    <SelectItem value="admin">🛡️ Admin</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-subjects" className="text-sm font-medium">Subjects <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <div className="relative">
                  <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="staff-subjects" {...register("subjects")} placeholder="Math, Science, English" className="pl-9" />
                </div>
                <p className="text-xs text-muted-foreground">Comma-separated</p>
              </div>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-3 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {staff ? "Reset Password" : "Account Password"}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="staff-password" className="text-sm font-medium">
                {staff ? "New Password" : "Password"} <span className="text-muted-foreground font-normal">{staff ? "(leave blank to keep current)" : "*"}</span>
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="staff-password"
                    type={showPassword ? "text" : "password"}
                    {...register("password")}
                    placeholder={staff ? "Enter to reset password" : "Min. 8 characters"}
                    className="pl-9 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={generatePassword} title="Auto-generate password" className="shrink-0">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={copyToClipboard} title="Copy password" disabled={!passwordValue} className="shrink-0">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : staff ? "Update Staff" : "Add Staff"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
