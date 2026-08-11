import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { KeyRound, Loader2, Copy, Download, Search, ShieldCheck, AlertCircle } from "lucide-react";

type Credential = {
  id: string;
  name: string;
  username: string | null;
  rollNumber: string | null;
  grade: string | null;
  section: string | null;
  plainPassword: string;
};

type GeneratedCredential = {
  id: string;
  name: string;
  rollNumber: string;
  grade: string | null;
  section: string | null;
  leaplabUsername: string;
  plainPassword: string;
};

type StudentCredentialsResponse = {
  success: boolean;
  data: {
    institutionName: string;
    students: Credential[];
  };
};

function downloadCsv(
  filename: string,
  rows: { rollNumber: string; name: string; password: string; grade?: string | null; section?: string | null }[]
) {
  const header = "Roll Number,Name,Class,Section,Password\n";
  const data = rows
    .map((r) => `"${r.rollNumber}","${r.name}","${r.grade ?? ""}","${r.section ?? ""}","${r.password}"`)
    .join("\n");
  const blob = new Blob([header + data], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  institutionId: string;
}

export function StudentCredentialsPanel({ institutionId }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [generatedCredentials, setGeneratedCredentials] = useState<GeneratedCredential[] | null>(null);

  const { data, isLoading, isError } = useQuery<StudentCredentialsResponse>({
    queryKey: ["student-credentials", institutionId],
    queryFn: async () => {
      const url = `/admin/institutions/${institutionId}/student-credentials`;
      console.log("[CredentialsPanel] Fetching GET", url);
      try {
        const res = await _axios.get(url);
        console.log("[CredentialsPanel] Response:", res.status, res.data);
        return res.data;
      } catch (err: any) {
        console.error("[CredentialsPanel] Request failed:", {
          status: err?.response?.status,
          data: err?.response?.data,
          message: err?.message,
          url,
        });
        throw err;
      }
    },
    enabled: !!institutionId,
    retry: false,
  });

  const credentials = data?.data?.students ?? [];
  const institutionName = data?.data?.institutionName ?? "";

  const filtered = useMemo(() => {
    if (!search) return credentials;
    const q = search.toLowerCase();
    return credentials.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.rollNumber?.toLowerCase().includes(q) ||
        c.username?.toLowerCase().includes(q) ||
        c.grade?.toLowerCase().includes(q) ||
        c.section?.toLowerCase().includes(q)
    );
  }, [credentials, search]);

  const generateMutation = useMutation({
    mutationFn: async (force: boolean = false) => {
      const url = `/admin/institutions/${institutionId}/generate-student-credentials${force ? "?force=true" : ""}`;
      const { data: res } = await _axios.post(url);
      return res;
    },
    onSuccess: (data) => {
      setGeneratedCredentials(data.data);
      queryClient.invalidateQueries({ queryKey: ["student-credentials", institutionId] });
      toast.success(data.message || "Credentials generated!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to generate credentials");
    },
  });

  const handleDownload = () => {
    if (!credentials.length) {
      toast.error("No credentials to download");
      return;
    }
    const rows = credentials.map((c) => ({
      rollNumber: c.rollNumber ?? c.username ?? "",
      name: c.name ?? "Unknown",
      password: c.plainPassword,
      grade: c.grade,
      section: c.section,
    }));
    downloadCsv(`${institutionName.replace(/\s+/g, "_")}_student_credentials.csv`, rows);
    toast.success(`Downloaded ${rows.length} credential(s)`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-5 w-5" /> Student Credentials
            </CardTitle>
            <CardDescription>
              {credentials.length} student(s) with credentials
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!credentials.length}
              className="rounded-xl gap-1.5"
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (window.confirm("Generate/reset credentials for students in this institution?")) {
                  generateMutation.mutate(true);
                }
              }}
              disabled={generateMutation.isPending}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 gap-1.5"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Generate Credentials
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, roll number, class or section..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center gap-2 py-8 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>Failed to load credentials</span>
            </div>
          ) : !filtered.length ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? "No matching students found" : "No credentials generated yet"}
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead className="w-16">Copy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-sm">{c.rollNumber ?? c.username ?? "-"}</TableCell>
                      <TableCell className="text-sm font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm">{c.grade ?? "-"}</TableCell>
                      <TableCell className="text-sm">{c.section ?? "-"}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {c.plainPassword || "********"}
                      </TableCell>
                      <TableCell>
                        {c.plainPassword ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                `Name: ${c.name}\nClass: ${c.grade ?? "-"}${c.grade ? ` - ${c.section ?? ""}` : ""}\nUsername: ${c.rollNumber ?? c.username}\nPassword: ${c.plainPassword}`
                              );
                              toast.success("Copied");
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!isLoading && !isError && filtered.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Showing {filtered.length} of {credentials.length} credential(s)
            </p>
          )}
        </CardContent>
      </Card>

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
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>LeapLab Username</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead className="w-16">Copy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {generatedCredentials?.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-sm">{c.rollNumber}</TableCell>
                      <TableCell className="text-sm font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm">{c.grade ?? "-"}</TableCell>
                      <TableCell className="text-sm">{c.section ?? "-"}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{c.leaplabUsername}</TableCell>
                      <TableCell className="font-mono text-sm">{c.plainPassword}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `Roll Number: ${c.rollNumber}\nClass: ${c.grade ?? "-"}${c.grade ? ` - ${c.section ?? ""}` : ""}\nLeapLab Username: ${c.leaplabUsername}\nPassword: ${c.plainPassword}`
                            );
                            toast.success("Copied");
                          }}
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
                variant="outline"
                onClick={() => {
                  if (!generatedCredentials) return;
                  const text = generatedCredentials
                    .map((c) => `${c.rollNumber}\t${c.name}\t${c.grade ?? ""}\t${c.section ?? ""}\t${c.leaplabUsername}\t${c.plainPassword}`)
                    .join("\n");
                  navigator.clipboard.writeText(text);
                  toast.success("All credentials copied");
                }}
                className="rounded-xl"
              >
                <Copy className="mr-2 h-4 w-4" /> Copy all
              </Button>
              <Button
                onClick={() => {
                  if (!generatedCredentials) return;
                  const rows = generatedCredentials.map((c) => ({
                    rollNumber: c.rollNumber,
                    name: c.name,
                    password: c.plainPassword,
                    grade: c.grade,
                    section: c.section,
                  }));
                  downloadCsv("student_credentials.csv", rows);
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
