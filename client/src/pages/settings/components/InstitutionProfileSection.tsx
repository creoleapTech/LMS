import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, Mail, Phone, MapPin, Save, Loader2 } from "lucide-react";
import type { IInstitutionProfile } from "@/types/settings";
import { useSettingsInstitution } from "../context/SettingsInstitutionContext";
import { useAuthStore } from "@/store/userAuthStore";

export function InstitutionProfileSection() {
  const queryClient = useQueryClient();
  const { institutionId: contextInstitutionId } = useSettingsInstitution();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";
  const qsParam = contextInstitutionId ? `?institutionId=${contextInstitutionId}` : "";

  const { data: institution, isLoading } = useQuery<IInstitutionProfile | null>({
    queryKey: ["settings", "institution-profile", contextInstitutionId],
    queryFn: async () => {
      const { data: res } = await _axios.get<{ success: boolean; data: IInstitutionProfile | null }>(
        `/admin/settings/institution-profile${qsParam}`
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !isSuperAdmin || !!contextInstitutionId,
  });

  const [name, setName] = useState("");
  const [type, setType] = useState<string>("school");
  const [address, setAddress] = useState("");
  const [inchargePerson, setInchargePerson] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [officePhone, setOfficePhone] = useState("");

  useEffect(() => {
    if (institution) {
      setName(institution.name || "");
      setType(institution.type || "school");
      setAddress(institution.address || "");
      setInchargePerson(institution.contactDetails?.inchargePerson || "");
      setMobileNumber(institution.contactDetails?.mobileNumber || "");
      setEmail(institution.contactDetails?.email || "");
      setOfficePhone(institution.contactDetails?.officePhone || "");
    }
  }, [institution]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: res } = await _axios.patch(`/admin/settings/institution-profile${qsParam}`, {
        name,
        type,
        address,
        contactDetails: {
          inchargePerson,
          mobileNumber,
          ...(email && { email }),
          ...(officePhone && { officePhone }),
        },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "institution-profile", contextInstitutionId] });
      toast.success("Institution profile updated!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update");
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
          <Building2 className="h-5 w-5" /> Institution Profile
        </CardTitle>
        <CardDescription>Update your institution information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Institution Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="school">School</SelectItem>
                <SelectItem value="college">College</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>In-Charge Person</Label>
            <Input value={inchargePerson} onChange={(e) => setInchargePerson(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Contact Number</Label>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <Input value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Office Phone</Label>
            <Input value={officePhone} onChange={(e) => setOfficePhone(e.target.value)} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Address</Label>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-2" />
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} />
            </div>
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
            Update Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
