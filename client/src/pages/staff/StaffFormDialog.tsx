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
import { Loader2, Eye, EyeOff, KeyRound, Copy, RefreshCw } from "lucide-react";
import type { IStaff, CreateStaffDTO, StaffType } from "@/types/staff";
import { toast } from "sonner"; // Add toast for copy feedback

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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{staff ? "Edit" : "Add New"} Staff</DialogTitle>
          <DialogDescription>
            Manage staff members for this institution
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input {...register("name")} placeholder="John Doe" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" {...register("email")} placeholder="john@example.com" />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            {/* Password Field */}
            <div className="space-y-2 sm:col-span-2 md:col-span-1">
              <Label>{staff ? "New Password (Optional)" : "Password"}</Label>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPassword ? "text" : "password"}
                    {...register("password")}
                    placeholder={staff ? "Leave blank to keep current" : "Enter or Generate Password"}
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
                <Button type="button" variant="outline" size="icon" onClick={generatePassword} title="Generate Password">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={copyToClipboard} title="Copy Password" disabled={!passwordValue}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {staff && <p className="text-xs text-muted-foreground">Note: Existing password is hidden for security. Enter a new one to reset it.</p>}
            </div>

            <div className="space-y-2 sm:col-span-2 md:col-span-1">
              <Label>Mobile Number *</Label>
              <Input {...register("mobileNumber")} placeholder="+91 98765 43210" />
              {errors.mobileNumber && <p className="text-sm text-destructive">{errors.mobileNumber.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>One Role *</Label>
              <Select onValueChange={(v) => setValue("type", v as StaffType)} defaultValue={staff?.type || "teacher"}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Subjects (comma separated)</Label>
              <Input {...register("subjects")} placeholder="Math, Science, English" />
            </div>

            <div className="space-y-2">
              <Label>Joining Date *</Label>
              <Input type="date" {...register("joiningDate")} />
              {errors.joiningDate && <p className="text-sm text-destructive">Date required</p>}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : staff ? "Update" : "Add Staff"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
