"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import type { IStudent, CreateStudentDTO } from "@/types/student";
import type { IClass } from "@/types/class";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  parentName: z.string().min(1, "Parent name is required"),
  parentMobile: z.string().min(10, "Mobile number must be at least 10 digits"),
  classId: z.string().min(1, "Class is required"),
  admissionNumber: z.string().optional(),
  rollNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
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
      parentName: "",
      parentMobile: "",
      classId: "",
      admissionNumber: "",
      rollNumber: "",
      email: "",
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
          parentName: student.parentName,
          parentMobile: student.parentMobile,
          classId: clsId || "",
          admissionNumber: student.admissionNumber || "",
          rollNumber: student.rollNumber || "",
          email: student.email || "",
          gender: (student.gender as any) || "male",
        });
      } else {
        reset({
          name: "",
          parentName: "",
          parentMobile: "",
          classId: "",
          admissionNumber: "",
          rollNumber: "",
          email: "",
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
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{student ? "Edit Student" : "Add Student"}</DialogTitle>
          <DialogDescription>
            {student ? "Update student details." : "Onboard a new student."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input id="name" placeholder="Student Name" {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="classId">Class *</Label>
              <Select onValueChange={(val) => setValue("classId", val, { shouldValidate: true })} defaultValue={watch("classId")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes
                    .filter(cls => cls.isActive || (student && (typeof student.classId === 'string' ? student.classId === cls._id : student.classId._id === cls._id)))
                    .map((cls) => (
                      <SelectItem key={cls._id} value={cls._id}>
                        {cls.grade} - {cls.section} ({cls.year}) {cls.isActive ? "" : "(Inactive)"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {errors.classId && <p className="text-sm text-destructive">{errors.classId.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="parentName">Parent/Guardian Name *</Label>
              <Input id="parentName" placeholder="Parent Name" {...register("parentName")} />
              {errors.parentName && <p className="text-sm text-destructive">{errors.parentName.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="parentMobile">Parent Mobile *</Label>
              <Input id="parentMobile" placeholder="Mobile Number" {...register("parentMobile")} />
              {errors.parentMobile && <p className="text-sm text-destructive">{errors.parentMobile.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="admissionNumber">Admission Number</Label>
              <Input id="admissionNumber" placeholder="Optional" {...register("admissionNumber")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rollNumber">Roll Number</Label>
              <Input id="rollNumber" placeholder="Optional" {...register("rollNumber")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select onValueChange={(val) => setValue("gender", val as any)} defaultValue={watch("gender") || "male"}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="student@example.com" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {student ? "Update Student" : "Add Student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}