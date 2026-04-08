import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Globe, Save, Loader2 } from "lucide-react";
import type { IInstitutionSettings } from "@/types/settings";
import { useSettingsInstitution } from "../context/SettingsInstitutionContext";
import { useAuthStore } from "@/store/userAuthStore";

const DEFAULTS: Partial<IInstitutionSettings> = {
  language: "en",
  timezone: "Asia/Kolkata",
  dateFormat: "DD/MM/YYYY",
  currency: "INR",
  enableStudentPortal: true,
  enableParentPortal: true,
};

export function GeneralSettingsSection() {
  const queryClient = useQueryClient();
  const { institutionId: contextInstitutionId } = useSettingsInstitution();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";
  const qsParam = contextInstitutionId ? `?institutionId=${contextInstitutionId}` : "";

  const { data: settings, isLoading } = useQuery<IInstitutionSettings | null>({
    queryKey: ["settings", "institution-settings", contextInstitutionId],
    queryFn: async () => {
      const { data: res } = await _axios.get<{ success: boolean; data: IInstitutionSettings | null }>(
        `/admin/settings/institution${qsParam}`
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !isSuperAdmin || !!contextInstitutionId,
  });

  const [language, setLanguage] = useState(DEFAULTS.language!);
  const [timezone, setTimezone] = useState(DEFAULTS.timezone!);
  const [dateFormat, setDateFormat] = useState(DEFAULTS.dateFormat!);
  const [currency, setCurrency] = useState(DEFAULTS.currency!);
  const [enableStudentPortal, setEnableStudentPortal] = useState(DEFAULTS.enableStudentPortal!);
  const [enableParentPortal, setEnableParentPortal] = useState(DEFAULTS.enableParentPortal!);

  useEffect(() => {
    if (settings) {
      setLanguage(settings.language || DEFAULTS.language!);
      setTimezone(settings.timezone || DEFAULTS.timezone!);
      setDateFormat(settings.dateFormat || DEFAULTS.dateFormat!);
      setCurrency(settings.currency || DEFAULTS.currency!);
      setEnableStudentPortal(settings.enableStudentPortal ?? DEFAULTS.enableStudentPortal!);
      setEnableParentPortal(settings.enableParentPortal ?? DEFAULTS.enableParentPortal!);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: res } = await _axios.put(`/admin/settings/institution${qsParam}`, {
        language,
        timezone,
        dateFormat,
        currency,
        enableStudentPortal,
        enableParentPortal,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "institution-settings", contextInstitutionId] });
      toast.success("General settings saved!");
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
          <Globe className="h-5 w-5" /> General Settings
        </CardTitle>
        <CardDescription>Basic configuration for your institution</CardDescription>
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
            <Label>Time Zone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Asia/Kolkata">India Standard Time (IST)</SelectItem>
                <SelectItem value="America/New_York">Eastern Time (EST)</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific Time (PST)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Date Format</Label>
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">Indian Rupee (₹)</SelectItem>
                <SelectItem value="USD">US Dollar ($)</SelectItem>
                <SelectItem value="EUR">Euro (€)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Enable Student Portal</Label>
              <p className="text-sm text-muted-foreground">Allow students to log in and view their data</p>
            </div>
            <Switch checked={enableStudentPortal} onCheckedChange={setEnableStudentPortal} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Enable Parent Portal</Label>
              <p className="text-sm text-muted-foreground">Allow parents to monitor their child's progress</p>
            </div>
            <Switch checked={enableParentPortal} onCheckedChange={setEnableParentPortal} />
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
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
