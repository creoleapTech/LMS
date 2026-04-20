// src/components/institution/InstitutionFormDialog.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Loader2, Building2, MapPin, Phone, Mail, User, Smartphone, ImagePlus, X } from "lucide-react";
import { Config } from "@/lib/config";

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
  onSave: (data: FormData) => void;
}

type Institution = {
  id?: string;
  _id?: string;
  name: string;
  type: "school" | "college";
  address: string;
  logo?: string;
  contactDetails: {
    inchargePerson: string;
    mobileNumber: string;
    email?: string;
    officePhone?: string;
  };
};

export function InstitutionFormDialog({ open, onOpenChange, institution, onSave }: Props) {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setLogoFile(null);
      setLogoPreview(institution.logo ? `${Config.imgUrl}${institution.logo}` : null);
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
      setLogoFile(null);
      setLogoPreview(null);
    }
  }, [institution, open, reset]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = (data: FormValues) => {
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("type", data.type);
    formData.append("address", data.address);
    formData.append("contactDetails", JSON.stringify(data.contactDetails));

    if (logoFile) {
      formData.append("logo", logoFile);
    }

    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--neo-bg)] border-b border-white/30 px-6 pt-6 pb-4 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold leading-tight">
                {institution ? "Edit Institution" : "Add Institution"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                {institution ? "Update the institution's details below." : "Fill in the details to onboard a new school or college."}
              </DialogDescription>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 pt-4 space-y-5">
          {/* Basic Info */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Basic Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="inst-name" className="text-sm font-medium">Institution Name <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="inst-name" {...register("name")} placeholder="Creoleap Matric Hr Sec School" className="pl-9" />
                </div>
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Type <span className="text-destructive">*</span></Label>
                <Select onValueChange={(v) => setValue("type", v as any)} defaultValue={institution?.type || "school"}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="school">🏫 School</SelectItem>
                    <SelectItem value="college">🎓 College</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-xs text-destructive mt-1">{errors.type.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inst-address" className="text-sm font-medium">Address <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="inst-address" {...register("address")} placeholder="Nagercoil, Tamil Nadu" className="pl-9" />
                </div>
                {errors.address && <p className="text-xs text-destructive mt-1">{errors.address.message}</p>}
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-4 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">School Photo</p>
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <div className="relative">
                  <img src={logoPreview} alt="School logo" className="h-20 w-20 rounded-xl object-cover border border-white/20 shadow-sm" />
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-20 w-20 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
                >
                  <ImagePlus size={20} />
                  <span className="text-[10px] font-medium">Upload</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
              {logoPreview && (
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="rounded-lg">
                  Change Photo
                </Button>
              )}
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="incharge" className="text-sm font-medium">Incharge Person <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="incharge" {...register("contactDetails.inchargePerson")} placeholder="Mahendran" className="pl-9" />
                </div>
                {errors.contactDetails?.inchargePerson && (
                  <p className="text-xs text-destructive mt-1">{errors.contactDetails.inchargePerson.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mobile" className="text-sm font-medium">Mobile Number <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="mobile" {...register("contactDetails.mobileNumber")} placeholder="9344676467" className="pl-9" />
                </div>
                {errors.contactDetails?.mobileNumber && (
                  <p className="text-xs text-destructive mt-1">{errors.contactDetails.mobileNumber.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">Email <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" {...register("contactDetails.email")} placeholder="school@example.com" className="pl-9" />
                </div>
                {errors.contactDetails?.email && (
                  <p className="text-xs text-destructive mt-1">{errors.contactDetails.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="office-phone" className="text-sm font-medium">Office Phone <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="office-phone" {...register("contactDetails.officePhone")} placeholder="0476-2223456" className="pl-9" />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t border-white/20">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : institution ? "Update Institution" : "Create Institution"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}