// src/pages/institutions/InstitutionDetailPage.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { InstitutionFormDialog } from "./InstitutionFormDialog";
import { StaffTable } from "../staff/StaffTable";
import { StudentTable } from "@/pages/students/StudentTable";
import { ClassTable } from "@/pages/classes/ClassTable";
import { InstitutionDashboard } from "./InstitutionDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Users,
  GraduationCap,
  BookOpen,
  CheckCircle,
  XCircle,
  School,
  Shapes,
  Clock,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { InstitutionCurriculumAccess } from "./InstitutionCurriculumAccess";
import { PeriodConfigSection } from "../settings/components/PeriodConfigSection";
import { InstitutionSettingsTab } from "./InstitutionSettingsTab";
import { Config } from "@/lib/config";

type Institution = {
  id: string;
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
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiInstitution = {
  id?: string;
  _id?: string;
  name?: string;
  type?: "school" | "college";
  address?: string | null;
  logo?: string | null;
  contactInchargePerson?: string | null;
  contactMobile?: string | null;
  contactEmail?: string | null;
  contactOfficePhone?: string | null;
  contactDetails?: {
    inchargePerson?: string;
    mobileNumber?: string;
    email?: string;
    officePhone?: string;
  };
  isActive?: number | boolean;
  createdAt?: string;
  updatedAt?: string;
};

function normalizeInstitution(row: ApiInstitution): Institution {
  const nestedContact = row.contactDetails ?? {};
  return {
    id: String(row.id ?? row._id ?? ""),
    name: String(row.name ?? ""),
    type: row.type === "college" ? "college" : "school",
    address: String(row.address ?? ""),
    logo: row.logo ?? undefined,
    contactDetails: {
      inchargePerson: String(
        row.contactInchargePerson ?? nestedContact.inchargePerson ?? "",
      ),
      mobileNumber: String(row.contactMobile ?? nestedContact.mobileNumber ?? ""),
      email: String(row.contactEmail ?? nestedContact.email ?? ""),
      officePhone: String(row.contactOfficePhone ?? nestedContact.officePhone ?? ""),
    },
    isActive: row.isActive === true || row.isActive === 1,
    createdAt: String(row.createdAt ?? ""),
    updatedAt: String(row.updatedAt ?? ""),
  };
}

interface InstitutionDetailPageProps {
  id: string;
}

export function InstitutionDetailPage({ id }: InstitutionDetailPageProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: institution, isLoading } = useQuery<Institution>({
    queryKey: ["institution", id],
    queryFn: async () => {
      const res = await _axios.get(`/admin/institutions/${id}`);
      return normalizeInstitution(res.data.data as ApiInstitution);
    },
    enabled: !!id,
  });

  // Mutation for updating institution
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await _axios.patch(`/admin/institutions/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["institution", id] });
      queryClient.invalidateQueries({ queryKey: ["institutions"] });
      toast.success("Institution updated successfully");
      setIsEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to update institution");
    },
  });

  if (isLoading) {
    return <InstitutionDetailSkeleton />;
  }

  if (!institution) {
    toast.error("Institution not found");
    return <div className="text-center py-20 text-destructive text-2xl">Institution not found</div>;
  }

  return (
    <div className="min-h-screen relative selection:bg-brand-color/20">

      <div className="relative z-10 py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto">
        {/* Hero Header */}
        <div className="relative overflow-hidden neo-card mb-8 px-5 sm:px-8 py-5">
          <div className="absolute inset-0 bg-linear-to-r from-indigo-500/5 to-purple-500/5" />
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              {institution.logo ? (
                <img
                  src={`${Config.imgUrl}${institution.logo}`}
                  alt={institution.name}
                  className="h-14 w-14 rounded-2xl object-cover border border-slate-200 shadow-lg"
                />
              ) : (
                <div className="p-3 bg-linear-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
                  <Building2 className="h-7 w-7" />
                </div>
              )}
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
                  {institution.name}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-sm px-3 py-1 capitalize font-medium rounded-lg">
                    <School className="h-4 w-4 mr-1.5" />
                    {institution.type}
                  </Badge>
                  <Badge
                    variant={institution.isActive ? "default" : "secondary"}
                    className="text-sm px-3 py-1 font-medium rounded-lg"
                  >
                    {institution.isActive ? (
                      <>
                        <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Active
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5 mr-1.5" /> Inactive
                      </>
                    )}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Institution ID</p>
              <code className="text-xs neo-inset-rounded-lg px-3 py-1.5 font-mono break-all mt-1 inline-block">
                {institution.id}
              </code>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap w-full max-w-3xl h-auto min-h-12 rounded-xl p-1 gap-1">
            <TabsTrigger value="overview" className="rounded-lg text-sm sm:text-base font-medium">
              <Building2 className="h-4 w-4 mr-1.5 hidden sm:block" /> Overview
            </TabsTrigger>
            <TabsTrigger value="staff" className="rounded-lg text-sm sm:text-base font-medium">
              <Users className="h-4 w-4 mr-1.5 hidden sm:block" /> Staff
            </TabsTrigger>
            <TabsTrigger value="classes" className="rounded-lg text-sm sm:text-base font-medium">
              <Shapes className="h-4 w-4 mr-1.5 hidden sm:block" /> Classes
            </TabsTrigger>
            <TabsTrigger value="students" className="rounded-lg text-sm sm:text-base font-medium">
              <GraduationCap className="h-4 w-4 mr-1.5 hidden sm:block" /> Students
            </TabsTrigger>
            <TabsTrigger value="curriculum" className="rounded-lg text-sm sm:text-base font-medium">
              <BookOpen className="h-4 w-4 mr-1.5 hidden sm:block" /> Curriculum
            </TabsTrigger>
            <TabsTrigger value="periods" className="rounded-lg text-sm sm:text-base font-medium">
              <Clock className="h-4 w-4 mr-1.5 hidden sm:block" /> Periods
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-lg text-sm sm:text-base font-medium">
              <Settings className="h-4 w-4 mr-1.5 hidden sm:block" /> Settings
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 animate-fade-in">
            <InstitutionDashboard
              id={id}
              institution={institution}
              onEdit={() => setIsEditDialogOpen(true)}
              onTabChange={setActiveTab}
            />
          </TabsContent>

          {/* Staff Tab */}
          <TabsContent value="staff">
            <StaffTable institutionId={institution.id} institutionName={institution.name} />
          </TabsContent>

          {/* Students Tab */}
          <TabsContent value="students">
            <StudentTable institutionId={institution.id} />
          </TabsContent>

          {/* Classes Tab */}
          <TabsContent value="classes">
            <ClassTable institutionId={institution.id} />
          </TabsContent>
          <TabsContent value="curriculum">
  {institution && <InstitutionCurriculumAccess institutionId={institution.id} />}
</TabsContent>
          <TabsContent value="periods">
            <PeriodConfigSection institutionId={id} />
          </TabsContent>
          <TabsContent value="settings">
            <InstitutionSettingsTab institutionId={institution.id} />
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <InstitutionFormDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          institution={institution}
          onSave={(data) => updateMutation.mutate(data)}
        />
      </div>
    </div>
  );
}

// Loading Skeleton
function InstitutionDetailSkeleton() {
  return (
    <div className="py-10 px-5 sm:px-8 max-w-screen-2xl mx-auto">
      <div className="neo-card p-5 sm:p-8 mb-8">
        <div className="flex items-center gap-5">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <div className="space-y-3 flex-1">
            <Skeleton className="h-8 w-full max-w-80" />
            <div className="flex gap-3">
              <Skeleton className="h-7 w-24 rounded-lg" />
              <Skeleton className="h-7 w-20 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}