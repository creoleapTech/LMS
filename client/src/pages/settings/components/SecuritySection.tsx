import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, Save, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/userAuthStore";
import type { IInstitutionSettings } from "@/types/settings";

export function SecuritySection() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
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
    enabled: isAdmin,
  });

  const [sessionTimeout, setSessionTimeout] = useState("30");

  useEffect(() => {
    if (settings) {
      setSessionTimeout(String(settings.sessionTimeout ?? 30));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: res } = await _axios.put("/admin/settings/institution", {
        sessionTimeout: Number(sessionTimeout),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "institution-settings"] });
      toast.success("Security settings saved!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save");
    },
  });

  if (isAdmin && isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-600">
          <Shield className="h-5 w-5" /> Security Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Label>Two-Factor Authentication (2FA)</Label>
            <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Add an extra layer of security to admin accounts
          </p>
          <Button variant="outline" disabled>
            Enable 2FA
          </Button>
        </div>

        <Separator />

        <div>
          <Label>Session Timeout</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Automatically log out after inactivity
          </p>
          <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 minutes</SelectItem>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
              <SelectItem value="120">2 hours</SelectItem>
              <SelectItem value="480">8 hours</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isAdmin && (
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
              Save Security Settings
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
