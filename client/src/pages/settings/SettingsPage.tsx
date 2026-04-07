import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2 } from "lucide-react";
import { useSettingsConfig } from "./hooks/useSettingsConfig";

export default function SettingsPage() {
  const { tabs, defaultTab, subtitle } = useSettingsConfig();

  return (
    <div className="py-10 px-5 sm:px-8 max-w-6xl mx-auto">
      <div className="mb-10">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold flex items-center gap-3 tracking-tight">
          <div className="p-2.5 bg-linear-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg shadow-indigo-500/20">
            <Building2 className="h-6 w-6" />
          </div>
          Settings
        </h1>
        <p className="text-muted-foreground mt-2">{subtitle}</p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-8">
        <TabsList className="flex flex-wrap w-full max-w-4xl h-auto gap-1 rounded-xl p-1">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="rounded-lg gap-1.5">
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => {
          const Component = tab.component;
          return (
            <TabsContent key={tab.id} value={tab.id}>
              <Component />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
