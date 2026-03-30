// src/components/institution/InstitutionFormDialog.tsx
"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const institutionSchema = z.object({
  name: z.string().min(2, "Institution name is required"),
  type: z.enum(["school", "college"], { message: "Select school or college" }),
  address: z.string().min(5, "Address is required"),
  contactDetails: z.object({
    inchargePerson: z.string().min(2, "Incharge person name required"),
    mobileNumber: z.string().min(10).max(15, "Invalid mobile number"),
    email: z.string().email().optional().or(z.literal("")),
    officePhone: z.string().optional(),
  }),
});

type FormValues = z.infer<typeof institutionSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  institution?: Institution | null;
  onSave: (data: FormValues) => void;
}

type Institution = {
  _id: string;
  name: string;
  type: "school" | "college";
  address: string;
  contactDetails: {
    inchargePerson: string;
    mobileNumber: string;
    email?: string;
    officePhone?: string;
  };
};

export function InstitutionFormDialog({ open, onOpenChange, institution, onSave }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(institutionSchema),
    defaultValues: {
      type: "school",
      contactDetails: {
        inchargePerson: "",
        mobileNumber: "",
        email: "",
        officePhone: "",
      },
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (open && institution) {
      reset({
        name: institution.name,
        type: institution.type,
        address: institution.address,
        contactDetails: {
          inchargePerson: institution.contactDetails.inchargePerson,
          mobileNumber: institution.contactDetails.mobileNumber,
          email: institution.contactDetails.email || "",
          officePhone: institution.contactDetails.officePhone || "",
        },
      });
    } else if (open && !institution) {
      reset({
        name: "",
        type: "school",
        address: "",
        contactDetails: {
          inchargePerson: "",
          mobileNumber: "",
          email: "",
          officePhone: "",
        },
      });
    }
  }, [institution, open, reset]);

  const onSubmit = (data: FormValues) => {
    onSave(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {institution ? "Edit Institution" : "Create New Institution"}
          </DialogTitle>
          <DialogDescription>
            {institution ? "Update institution details" : "Add a new school or college"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pt-4">
          {/* Basic Info */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Institution Name *</Label>
                <Input {...register("name")} placeholder="Creoleap Matric Hr Sec School" />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Type *</Label>
                <Select onValueChange={(v) => setValue("type", v as any)} defaultValue={institution?.type || "school"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="school">School</SelectItem>
                    <SelectItem value="college">College</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Address *</Label>
                <Input {...register("address")} placeholder="Nagercoil, Tamil Nadu" />
                {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-6 pt-6 border-t">
            <h3 className="text-lg font-semibold">Contact Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Incharge Person *</Label>
                <Input {...register("contactDetails.inchargePerson")} placeholder="Mahendran" />
                {errors.contactDetails?.inchargePerson && (
                  <p className="text-sm text-destructive">{errors.contactDetails.inchargePerson.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Mobile Number *</Label>
                <Input {...register("contactDetails.mobileNumber")} placeholder="9344676467" />
                {errors.contactDetails?.mobileNumber && (
                  <p className="text-sm text-destructive">{errors.contactDetails.mobileNumber.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Email (optional)</Label>
                <Input type="email" {...register("contactDetails.email")} placeholder="test@gmail.com" />
                {errors.contactDetails?.email && (
                  <p className="text-sm text-destructive">{errors.contactDetails.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Office Phone (optional)</Label>
                <Input {...register("contactDetails.officePhone")} placeholder="9344676467" />
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-4 pt-6 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-brand-color hover:bg-brand-color/90 rounded-xl shadow-lg shadow-purple-900/20">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : institution ? (
                "Update Institution"
              ) : (
                "Create Institution"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}