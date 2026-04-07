import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { User, Save, Loader2, Lock } from "lucide-react";
import type { IUserProfile } from "@/types/settings";

export function ProfileSection() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery<IUserProfile | null>({
    queryKey: ["settings", "profile"],
    queryFn: async () => {
      const { data: res } = await _axios.get<{ success: boolean; data: IUserProfile | null }>(
        "/admin/settings/profile"
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const [name, setName] = useState("");
  const [salutation, setSalutation] = useState<string>("");
  const [mobileNumber, setMobileNumber] = useState("");

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setSalutation(profile.salutation || "");
      setMobileNumber(profile.mobileNumber || "");
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { data: res } = await _axios.patch("/admin/settings/profile", {
        name,
        ...(salutation && { salutation }),
        mobileNumber,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "profile"] });
      toast.success("Profile updated!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update profile");
    },
  });

  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const passwordMutation = useMutation({
    mutationFn: async () => {
      const { data: res } = await _axios.patch("/admin/settings/change-password", {
        currentPassword,
        newPassword,
      });
      return res;
    },
    onSuccess: () => {
      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to change password");
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Personal Profile
          </CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Salutation</Label>
              <Select value={salutation} onValueChange={setSalutation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mr">Mr</SelectItem>
                  <SelectItem value="Mrs">Mrs</SelectItem>
                  <SelectItem value="Ms">Ms</SelectItem>
                  <SelectItem value="Dr">Dr</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile?.email || ""} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label>Mobile Number</Label>
              <Input
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 gap-1.5"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" /> Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => passwordMutation.mutate()}
              disabled={
                passwordMutation.isPending || !currentPassword || newPassword.length < 6
              }
              variant="outline"
              className="rounded-xl gap-1.5"
            >
              {passwordMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock size={14} />
              )}
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
