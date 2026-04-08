import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2 } from "lucide-react";
import { useSettingsConfig } from "./hooks/useSettingsConfig";

export default function SettingsPage() {
  const { tabs, defaultTab, subtitle } = useSettingsConfig();

  return (
    <div className="py-10 px-5 sm:px-8 max-w-screen-2xl mx-auto">
      <div className="mb-10">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold flex items-center gap-3 tracking-tight">
          <div className="p-2.5 bg-linear-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-[3px_3px_8px_var(--neo-shadow-dark),-3px_-3px_8px_var(--neo-shadow-light),0_0_15px_rgba(99,102,241,0.3)]">
            <Building2 className="h-6 w-6" />
          </div>
          Settings
        </h1>
        <p className="text-muted-foreground mt-2">{subtitle}</p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-8">
        <TabsList className="flex flex-wrap w-full max-w-5xl h-auto gap-2 rounded-2xl p-2">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="gap-2 px-5 py-3 text-sm min-h-11"
            >
              <tab.icon className="h-4.5 w-4.5" />
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
