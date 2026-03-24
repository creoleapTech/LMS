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
} from "lucide-react";
import { toast } from "sonner";
import { InstitutionCurriculumAccess } from "./InstitutionCurriculumAccess";

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
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

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
      return res.data.data as Institution;
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative selection:bg-brand-color/20">
      {/* Abstract Background Pattern */}
      {/* <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-3xl animate-blob" />
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-20%] left-[20%] w-[40%] h-[40%] rounded-full bg-pink-500/10 blur-3xl animate-blob animation-delay-4000" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      </div> */}

      <div className="relative z-10 container mx-auto py-8 px-4 max-w-7xl">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/30 dark:bg-slate-800/30 backdrop-blur-xl shadow-2xl mb-8 px-8 py-2 ">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-color/10 to-brand-color/5 opacity-30" />
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-3xl font-bold text-brand-color">
                  {institution.name}
                </h1>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-md px-4 py-2 capitalize font-medium bg-white/20 dark:bg-slate-700/20 backdrop-blur-sm">
                    <School className="h-6 w-6 mr-2" />
                    {institution.type}
                  </Badge>
                  <Badge
                    variant={institution.isActive ? "default" : "secondary"}
                    className="text-md px-4 py-2 font-medium bg-white/20 dark:bg-slate-700/20 backdrop-blur-sm"
                  >
                    {institution.isActive ? (
                      <>
                        <CheckCircle className="h-5 w-5 mr-2" /> Active
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 mr-2" /> Inactive
                      </>
                    )}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Institution ID</p>
              <code className="text-xs bg-muted/30 px-3 py-2 rounded-lg font-mono backdrop-blur-sm">
                {institution._id}
              </code>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full max-w-3xl h-14 rounded-2xl p-2 bg-white/20 dark:bg-slate-700/30 backdrop-blur-md shadow-md">
            <TabsTrigger value="overview" className="rounded-xl text-lg font-medium transition-colors duration-300 hover:bg-white/30 dark:hover:bg-slate-600">
              <Building2 className="h-5 w-5 mr-2" /> Overview
            </TabsTrigger>
            <TabsTrigger value="staff" className="rounded-xl text-lg font-medium">
              <Users className="h-5 w-5 mr-2" /> Staff
            </TabsTrigger>
            <TabsTrigger value="classes" className="rounded-xl text-lg font-medium">
              <Shapes className="h-5 w-5 mr-2" /> Classes
            </TabsTrigger>
            <TabsTrigger value="students" className="rounded-xl text-lg font-medium">
              <GraduationCap className="h-5 w-5 mr-2" /> Students
            </TabsTrigger>
           <TabsTrigger value="curriculum" className="flex items-center gap-2">
  <BookOpen className="h-4 w-4" />
  Curriculum & Books
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
            <StaffTable institutionId={institution._id} institutionName={institution.name} />
          </TabsContent>

          {/* Students Tab */}
          <TabsContent value="students">
            <StudentTable institutionId={institution._id} />
          </TabsContent>

          {/* Classes Tab */}
          <TabsContent value="classes">
            <ClassTable institutionId={institution._id} />
          </TabsContent>
          <TabsContent value="curriculum">
  {institution && <InstitutionCurriculumAccess institutionId={institution._id} />}
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
    <div className="container mx-auto py-10 max-w-7xl">
      <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
        <div className="flex items-center gap-6">
          <Skeleton className="h-32 w-32 rounded-3xl" />
          <div className="space-y-4">
            <Skeleton className="h-12 w-96" />
            <div className="flex gap-4">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}