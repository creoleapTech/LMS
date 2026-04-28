import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettingsConfig } from "./hooks/useSettingsConfig";

export default function SettingsPage() {
  const { tabs, defaultTab } = useSettingsConfig();

  return (
    <div className="py-10 px-5 sm:px-8 max-w-screen-2xl mx-auto">
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
