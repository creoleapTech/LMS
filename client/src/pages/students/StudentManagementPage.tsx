import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/userAuthStore";
import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { StudentTable } from "./StudentTable";
import { ClassTable } from "@/pages/classes/ClassTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Users, Shapes } from "lucide-react";

export function StudentManagementPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin";

  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string>("");

  // Admin's own institution
  const adminInstitutionId = isAdmin
    ? (typeof user?.institutionId === "object"
        ? user?.institutionId?._id
        : user?.institutionId) || ""
    : "";
  const effectiveInstitutionId = isSuperAdmin
    ? selectedInstitutionId
    : adminInstitutionId;

  // Institutions list (super admin only)
  const { data: institutions = [] } = useQuery<
    { _id: string; name: string }[]
  >({
    queryKey: ["institutions-list"],
    queryFn: async () => {
      const res = await _axios.get("/admin/institutions");
      return res.data?.data ?? [];
    },
    enabled: isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });

  // Auto-select first institution for super admin
  useEffect(() => {
    if (isSuperAdmin && institutions.length > 0 && !selectedInstitutionId) {
      setSelectedInstitutionId(institutions[0]._id);
    }
  }, [isSuperAdmin, institutions, selectedInstitutionId]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-screen-2xl mx-auto space-y-6">
      {/* Institution selector for super admin */}
      {isSuperAdmin && (
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-slate-400" />
          <Select
            value={selectedInstitutionId}
            onValueChange={setSelectedInstitutionId}
          >
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Select institution" />
            </SelectTrigger>
            <SelectContent>
              {institutions.map((inst) => (
                <SelectItem key={inst._id} value={inst._id}>
                  {inst.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Content */}
      {!effectiveInstitutionId ? (
        <div className="text-center py-20 text-slate-400">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">Select an institution to manage students</p>
        </div>
      ) : (
        <Tabs defaultValue="classes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="classes" className="gap-1.5">
              <Shapes className="h-4 w-4" />
              Classes & Sections
            </TabsTrigger>
            <TabsTrigger value="students" className="gap-1.5">
              <Users className="h-4 w-4" />
              Students
            </TabsTrigger>
          </TabsList>

          <TabsContent value="classes">
            <ClassTable institutionId={effectiveInstitutionId} />
          </TabsContent>

          <TabsContent value="students">
            <StudentTable institutionId={effectiveInstitutionId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
