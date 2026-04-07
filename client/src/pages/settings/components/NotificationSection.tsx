import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Bell, Save, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/userAuthStore";
import type { IInstitutionSettings, IUserPreferences } from "@/types/settings";

const INSTITUTION_NOTIFICATION_ITEMS = [
  { key: "newStudentRegistration" as const, label: "New Student Registration", desc: "Send notification when a new student is registered" },
  { key: "feePaymentReceived" as const, label: "Fee Payment Received", desc: "Send notification for fee payments" },
  { key: "attendanceAlert" as const, label: "Attendance Alert (<75%)", desc: "Alert when student attendance falls below threshold" },
  { key: "examResultsPublished" as const, label: "Exam Results Published", desc: "Notify when exam results are published" },
  { key: "holidayAnnouncement" as const, label: "Holiday Announcement", desc: "Send holiday announcements" },
];

const USER_NOTIFICATION_ITEMS = [
  { key: "emailNotifications" as const, label: "Email Notifications", desc: "Receive notifications via email" },
  { key: "smsNotifications" as const, label: "SMS Notifications", desc: "Receive notifications via SMS" },
  { key: "attendanceAlerts" as const, label: "Attendance Alerts", desc: "Get alerts about class attendance" },
  { key: "examResults" as const, label: "Exam Results", desc: "Get notified when exam results are available" },
  { key: "announcements" as const, label: "Announcements", desc: "Receive general announcements" },
];

export function NotificationSection() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  return isAdmin ? <AdminNotifications /> : <UserNotifications />;
}

function AdminNotifications() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<IInstitutionSettings | null>({
    queryKey: ["settings", "institution-settings"],
    queryFn: async () => {
      const { data: res } = await _axios.get<{ success: boolean; data: IInstitutionSettings | null }>(
        "/admin/settings/institution"
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const [prefs, setPrefs] = useState({
    newStudentRegistration: true,
    feePaymentReceived: true,
    attendanceAlert: true,
    examResultsPublished: true,
    holidayAnnouncement: true,
  });

  useEffect(() => {
    if (settings?.notificationPreferences) {
      setPrefs({ ...prefs, ...settings.notificationPreferences });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: res } = await _axios.put("/admin/settings/institution", {
        notificationPreferences: prefs,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "institution-settings"] });
      toast.success("Notification preferences saved!");
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
          <Bell className="h-5 w-5" /> Institution Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {INSTITUTION_NOTIFICATION_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center justify-between">
            <div>
              <Label className="text-base">{item.label}</Label>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
            <Switch
              checked={prefs[item.key]}
              onCheckedChange={(checked) => setPrefs({ ...prefs, [item.key]: checked })}
            />
          </div>
        ))}
        <div className="flex justify-end pt-2 border-t">
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

function UserNotifications() {
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

  const [prefs, setPrefs] = useState({
    emailNotifications: true,
    smsNotifications: false,
    attendanceAlerts: true,
    examResults: true,
    announcements: true,
  });

  useEffect(() => {
    if (preferences?.notificationPreferences) {
      setPrefs({ ...prefs, ...preferences.notificationPreferences });
    }
  }, [preferences]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: res } = await _axios.put("/admin/settings/preferences", {
        notificationPreferences: prefs,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "preferences"] });
      toast.success("Notification preferences saved!");
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
          <Bell className="h-5 w-5" /> Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {USER_NOTIFICATION_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center justify-between">
            <div>
              <Label className="text-base">{item.label}</Label>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
            <Switch
              checked={prefs[item.key]}
              onCheckedChange={(checked) => setPrefs({ ...prefs, [item.key]: checked })}
            />
          </div>
        ))}
        <div className="flex justify-end pt-2 border-t">
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
