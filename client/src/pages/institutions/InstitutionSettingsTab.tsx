import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Globe, Calendar, GraduationCap, Bell, Shield } from "lucide-react";
import { SettingsInstitutionProvider } from "../settings/context/SettingsInstitutionContext";
import { InstitutionProfileSection } from "../settings/components/InstitutionProfileSection";
import { GeneralSettingsSection } from "../settings/components/GeneralSettingsSection";
import { AcademicSection } from "../settings/components/AcademicSection";
import { GradingSection } from "../settings/components/GradingSection";
import { NotificationSection } from "../settings/components/NotificationSection";
import { SecuritySection } from "../settings/components/SecuritySection";

interface Props {
  institutionId: string;
}

const SUB_TABS = [
  { id: "institution-profile", label: "Profile", icon: Building2 },
  { id: "general", label: "General", icon: Globe },
  { id: "academic", label: "Academic", icon: Calendar },
  { id: "grading", label: "Grading", icon: GraduationCap },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
];

export function InstitutionSettingsTab({ institutionId }: Props) {
  return (
    <SettingsInstitutionProvider value={{ institutionId }}>
      <Tabs defaultValue="institution-profile" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1 rounded-xl p-1">
          {SUB_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="rounded-lg gap-1.5">
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="institution-profile">
          <InstitutionProfileSection />
        </TabsContent>
        <TabsContent value="general">
          <GeneralSettingsSection />
        </TabsContent>
        <TabsContent value="academic">
          <AcademicSection />
        </TabsContent>
        <TabsContent value="grading">
          <GradingSection />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationSection />
        </TabsContent>
        <TabsContent value="security">
          <SecuritySection />
        </TabsContent>
      </Tabs>
    </SettingsInstitutionProvider>
  );
}
