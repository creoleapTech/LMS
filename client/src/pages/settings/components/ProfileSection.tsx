import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Config } from "@/lib/config";
import { useAuthStore } from "@/store/userAuthStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { User, Save, Loader2, Lock } from "lucide-react";
import type { IUserProfile } from "@/types/settings";

function resolveProfileImageSrc(profileImage?: string): string {
  if (!profileImage) {
    return "";
  }

  if (profileImage.startsWith("http://") || profileImage.startsWith("https://")) {
    return profileImage;
  }

  return `${Config.imgUrl}${profileImage}`;
}

export function ProfileSection() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

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
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState("");

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setSalutation(profile.salutation || "");
      setMobileNumber(profile.mobileNumber || "");
      setProfileImagePreview(resolveProfileImageSrc(profile.profileImage));
      setProfileImageFile(null);
    }
  }, [profile]);

  const handleProfileImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Profile image must be 5MB or smaller");
      event.target.value = "";
      return;
    }

    setProfileImageFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setProfileImagePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const initials = (name || profile?.name || profile?.email || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";

  const updateMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("name", name);
      if (salutation) {
        formData.append("salutation", salutation);
      }
      formData.append("mobileNumber", mobileNumber);
      if (profileImageFile) {
        formData.append("profileImage", profileImageFile);
      }

      const { data: res } = await _axios.patch<{ success: boolean; message: string; data: IUserProfile }>(
        "/admin/settings/profile",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      return res;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["settings", "profile"] });

      if (user && res.data) {
        setUser({
          ...user,
          name: res.data.name ?? user.name,
          salutation: (res.data.salutation as "Mr" | "Mrs" | "Ms" | "Dr" | undefined) ?? user.salutation,
          mobileNumber: res.data.mobileNumber ?? user.mobileNumber,
          profileImage: res.data.profileImage ?? user.profileImage,
        });
      }

      setProfileImageFile(null);
      setProfileImagePreview(resolveProfileImageSrc(res.data?.profileImage));
      toast.success(res.message || "Profile updated!");
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
          <div className="flex flex-col gap-4 rounded-xl border bg-muted/20 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profileImagePreview || undefined} alt="Profile picture" />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>

              <div>
                <p className="font-medium">Profile Picture</p>
                <p className="text-sm text-muted-foreground">JPG, PNG or WEBP up to 5MB</p>
              </div>
            </div>

            <div className="w-full md:w-auto">
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleProfileImageChange}
                className="w-full cursor-pointer md:w-[260px]"
              />
            </div>
          </div>

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
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 gap-1.5"
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
