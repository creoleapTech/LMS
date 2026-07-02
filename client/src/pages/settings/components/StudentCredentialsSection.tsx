"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { KeyRound, Save, Loader2, Copy, Download, ShieldCheck } from "lucide-react";
import type { IInstitutionSettings } from "@/types/settings";
import { useSettingsInstitution } from "../context/SettingsInstitutionContext";
import { useAuthStore } from "@/store/userAuthStore";

type GeneratedCredential = {
  id: string;
  name: string;
  rollNumber: string;
  plainPassword: string;
};

function downloadCredentialsAsCsv(
  institutionName: string,
  credentials: GeneratedCredential[],
) {
  const hasPasswords = credentials.some((c) => c.plainPassword);
  const header = hasPasswords
    ? "Name,Roll Number,Password\n"
    : "Name,Roll Number,Username\n";
  const rows = credentials
    .map((c) => {
      if (hasPasswords) {
        return `"${c.name}","${c.rollNumber}","${c.plainPassword}"`;
      }
      return `"${c.name}","${c.rollNumber}","${c.rollNumber}"`;
    })
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${institutionName.replace(/\s+/g, "_")}_student_credentials.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function StudentCredentialsSection() {
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

  const [generateEnabled, setGenerateEnabled] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<GeneratedCredential[] | null>(null);

  useEffect(() => {
    if (settings) {
      setGenerateEnabled(settings.generateStudentCredentials ?? false);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: res } = await _axios.put(`/admin/settings/institution${qsParam}`, {
        generateStudentCredentials: generateEnabled,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "institution-settings", contextInstitutionId] });
      toast.success("Settings saved!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save");
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data: res } = await _axios.post(
        `/admin/institutions/${contextInstitutionId}/generate-student-credentials`
      );
      return res;
    },
    onSuccess: (data) => {
      setGeneratedCredentials(data.data);
      toast.success(data.message || "Credentials generated!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to generate credentials");
    },
  });

  const downloadAllMutation = useMutation({
    mutationFn: async () => {
      const { data: res } = await _axios.get(
        `/admin/institutions/${contextInstitutionId}/student-credentials`
      );
      return res;
    },
    onSuccess: (data) => {
      const { institutionName = "", students: creds } = data.data ?? {};
      if (!creds || creds.length === 0) {
        toast.error("No students with credentials found");
        return;
      }
      const csvCreds = creds.map((s: any) => ({
        id: s.id,
        name: s.name ?? "Unknown",
        rollNumber: s.rollNumber ?? s.username ?? "",
        plainPassword: s.plainPassword ?? "",
      }));
      downloadCredentialsAsCsv(institutionName, csvCreds);
      toast.success(`Downloaded credentials for ${creds.length} student(s)`);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to download credentials");
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
            <KeyRound className="h-5 w-5" /> Student Credentials
          </CardTitle>
          <CardDescription>
            Auto-generate roll numbers and login credentials for students
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Auto-generate Student Credentials</Label>
              <p className="text-sm text-muted-foreground">
                Enable credential generation for students in this institution
              </p>
            </div>
            <Switch checked={generateEnabled} onCheckedChange={setGenerateEnabled} />
          </div>

          <Separator />

          <div className="rounded-xl border bg-muted/50 p-4 space-y-2">
            <Label className="text-sm font-medium">Roll Number Format</Label>
            <p className="text-sm text-muted-foreground">
              Roll numbers are generated as: <span className="font-mono font-medium text-foreground">School Initials (3) + Year (2) + Sequence (3)</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Example: "Sunshine Public School" in 2025 → <span className="font-mono font-medium text-foreground">SUN25001</span>, <span className="font-mono font-medium text-foreground">SUN25002</span>, ...
            </p>
            <p className="text-sm text-muted-foreground">
              Students log in using their <span className="font-medium text-foreground">roll number</span> as the username.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              variant="outline"
              className="rounded-xl gap-1.5"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save Setting
            </Button>
            <Button
              onClick={() => {
                if (!contextInstitutionId) return;
                downloadAllMutation.mutate();
              }}
              disabled={!contextInstitutionId || downloadAllMutation.isPending}
              variant="outline"
              className="rounded-xl gap-1.5"
            >
              {downloadAllMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download size={14} />
              )}
              Download Credentials
            </Button>
            <Button
              onClick={() => {
                if (window.confirm("Generate credentials for all students without credentials? This will assign roll numbers and passwords.")) {
                  generateMutation.mutate();
                }
              }}
              disabled={!contextInstitutionId || generateMutation.isPending}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 gap-1.5"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck size={14} />
              )}
              Generate Credentials
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results dialog */}
      <Dialog open={!!generatedCredentials} onOpenChange={() => setGeneratedCredentials(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Generated Student Credentials</DialogTitle>
            <DialogDescription>
              Copy the passwords now — they are hashed on the server and cannot be shown again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="rounded-xl overflow-hidden border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead className="w-16">Copy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {generatedCredentials?.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">{c.name}</TableCell>
                      <TableCell className="font-mono text-sm">{c.rollNumber}</TableCell>
                      <TableCell className="font-mono text-sm">{c.plainPassword}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `Username: ${c.rollNumber}\nPassword: ${c.plainPassword}`
                            );
                            toast.success("Credential copied");
                          }}
                          className="h-8 w-8 rounded-lg"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!generatedCredentials) return;
                  const text = generatedCredentials
                    .map((c) => `${c.name}\t${c.rollNumber}\t${c.plainPassword}`)
                    .join("\n");
                  navigator.clipboard.writeText(text);
                  toast.success("All credentials copied");
                }}
                className="rounded-xl"
              >
                <Copy className="mr-2 h-4 w-4" /> Copy all
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!generatedCredentials) return;
                  downloadCredentialsAsCsv("students", generatedCredentials);
                }}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Download className="mr-2 h-4 w-4" /> Download CSV
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
