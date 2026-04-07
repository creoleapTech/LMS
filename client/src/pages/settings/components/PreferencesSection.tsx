import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Settings, Save, Loader2 } from "lucide-react";
import type { IUserPreferences } from "@/types/settings";

export function PreferencesSection() {
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery<IUserPreferences | null>({
    queryKey: ["settings", "preferences"],
    queryFn: async () => {
      const { data: res } = await _axios.get<{ success: boolean; data: IUserPreferences | null }>(
        "/admin/settings/preferences"
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const [language, setLanguage] = useState("en");
  const [theme, setTheme] = useState("system");

  useEffect(() => {
    if (preferences) {
      setLanguage(preferences.language || "en");
      setTheme(preferences.theme || "system");
    }
  }, [preferences]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: res } = await _axios.put("/admin/settings/preferences", {
        language,
        theme,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "preferences"] });
      toast.success("Preferences saved!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save");
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" /> Preferences
        </CardTitle>
        <CardDescription>Customize your personal experience</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Theme</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System Default</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 gap-1.5"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Save Preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
