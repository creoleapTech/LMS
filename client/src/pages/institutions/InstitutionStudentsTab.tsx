"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentTable } from "@/pages/students/StudentTable";
import { StudentCredentialsPanel } from "@/pages/students/StudentCredentialsPanel";
import { Users, KeyRound } from "lucide-react";

interface InstitutionStudentsTabProps {
  institutionId: string;
}

export function InstitutionStudentsTab({ institutionId }: InstitutionStudentsTabProps) {
  const [view, setView] = useState<"students" | "credentials">("students");

  return (
    <Tabs value={view} onValueChange={(v) => setView(v as "students" | "credentials")} className="w-full space-y-5">
      {/* Capsule toggle */}
      <TabsList className="inline-flex h-10 items-center justify-center rounded-full bg-muted p-1 gap-1">
        <TabsTrigger
          value="students"
          className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-1.5 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-900"
        >
          <Users className="h-4 w-4" />
          Students
        </TabsTrigger>
        <TabsTrigger
          value="credentials"
          className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-1.5 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-900"
        >
          <KeyRound className="h-4 w-4" />
          Credentials
        </TabsTrigger>
      </TabsList>

      <TabsContent value="students" className="mt-2">
        <StudentTable institutionId={institutionId} />
      </TabsContent>
      <TabsContent value="credentials" className="mt-2">
        <StudentCredentialsPanel institutionId={institutionId} />
      </TabsContent>
    </Tabs>
  );
}
