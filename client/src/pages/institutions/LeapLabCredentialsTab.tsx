"use client";

import { useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FlaskConical,
  Plus,
  Trash2,
  Copy,
  Download,
  Loader2,
  KeyRound,
  Users,
  CheckCircle,
} from "lucide-react";

interface Props {
  institutionId: string;
  institutionName: string;
}

type CreatedCredential = {
  id: string;
  username: string;
  plainPassword: string;
};

type ExistingCredential = {
  id: string;
  username: string;
  isActive: number | boolean;
  createdAt: string;
};

const formSchema = z
  .object({
    credentials: z.array(
      z.object({
        baseUsername: z
          .string()
          .max(60, "Too long")
          .regex(
            /^[a-zA-Z0-9_-]*$/,
            "Only letters, numbers, hyphens and underscores allowed",
          ),
        password: z
          .union([
            z.string().min(6, "Minimum 6 characters"),
            z.literal(""),
          ])
          .optional(),
      }),
    ),
    autoGenerate: z.preprocess(
      (val) => (val === "" || val === null || val === undefined ? 0 : Number(val)),
      z.number().min(0).max(100),
    ).default(0),
    customPrefix: z
      .string()
      .max(20, "Too long")
      .regex(/^[a-zA-Z0-9_-]*$/, "Only letters, numbers, hyphens and underscores allowed")
      .optional(),
  })
  .refine(
    (data) =>
      data.credentials.some((c) => c.baseUsername.trim().length > 0) ||
      data.autoGenerate > 0,
    {
      message: "Add at least one credential or choose an auto-generate count",
    },
  );

type FormValues = z.infer<typeof formSchema>;

function sanitizeSuffix(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "institution"
  );
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function downloadCredentialsAsCsv(
  institutionName: string,
  credentials: CreatedCredential[],
) {
  const rows = [
    ["Institution", "Username", "Password"],
    ...credentials.map((c) => [institutionName, c.username, c.plainPassword]),
  ];
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leaplab-credentials-${sanitizeSuffix(institutionName)}-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function LeapLabCredentialsTab({ institutionId, institutionName }: Props) {
  const queryClient = useQueryClient();
  const suffix = useMemo(() => `@${sanitizeSuffix(institutionName)}`, [institutionName]);

  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredential[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      credentials: [{ baseUsername: "", password: "" }],
      autoGenerate: 0,
      customPrefix: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "credentials",
  });

  const { data: credentialsData, isLoading } = useQuery<{ success: boolean; data: ExistingCredential[] }>({
    queryKey: ["leaplab-credentials", institutionId],
    queryFn: async () => {
      const { data } = await _axios.get(`/admin/institutions/${institutionId}/leaplab-credentials`);
      return data;
    },
    enabled: !!institutionId,
  });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: Record<string, unknown> = {};

      const manual = values.credentials.filter((c) => c.baseUsername.trim().length > 0);
      if (manual.length > 0) {
        payload.credentials = manual.map((c) => ({
          baseUsername: c.baseUsername.trim(),
          password: c.password?.trim() || undefined,
        }));
      }

      if (values.autoGenerate > 0) {
        payload.autoGenerate = values.autoGenerate;
        if (values.customPrefix?.trim()) {
          payload.customPrefix = values.customPrefix.trim();
        }
      }

      const { data } = await _axios.post<{ success: boolean; data: CreatedCredential[] }>(
        `/admin/institutions/${institutionId}/leaplab-credentials`,
        payload,
      );
      return data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leaplab-credentials", institutionId] });
      setCreatedCredentials(data);
      reset({ credentials: [{ baseUsername: "", password: "" }], autoGenerate: 0, customPrefix: "" });
      toast.success(`${data.length} LeapLab credential${data.length === 1 ? "" : "s"} created`);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to create credentials");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await _axios.delete<{ success: boolean; message: string }>(
        `/admin/institutions/${institutionId}/leaplab-credentials/${id}`,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaplab-credentials", institutionId] });
      setDeletingId(null);
      toast.success("Credential removed");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to remove credential");
      setDeletingId(null);
    },
  });

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values);
  };

  const existingCredentials = credentialsData?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Create credentials card */}
      <Card className="neo-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">LeapLab Credentials</CardTitle>
              <CardDescription>
                Create usernames and passwords for LeapLab. Every username uses the school suffix{" "}
                <Badge variant="secondary" className="font-mono">{suffix}</Badge>
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Manual credentials */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Manual Credentials
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ baseUsername: "", password: "" })}
                  className="rounded-lg"
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Add row
                </Button>
              </div>

              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-start"
                  >
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Username prefix</Label>
                      <div className="flex rounded-xl border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                        <Input
                          {...register(`credentials.${index}.baseUsername`)}
                          placeholder="computer1"
                          className="border-0 rounded-none shadow-none focus-visible:ring-0"
                        />
                        <div className="flex items-center px-3 text-sm text-muted-foreground bg-muted/50 border-l border-input font-mono">
                          {suffix}
                        </div>
                      </div>
                      {errors.credentials?.[index]?.baseUsername && (
                        <p className="text-xs text-destructive">
                          {errors.credentials[index]?.baseUsername?.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Password <span className="font-normal">(optional)</span>
                      </Label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...register(`credentials.${index}.password`)}
                          type="text"
                          placeholder="Auto-generated if empty"
                          className="pl-9"
                        />
                      </div>
                      {errors.credentials?.[index]?.password && (
                        <p className="text-xs text-destructive">
                          {errors.credentials[index]?.password?.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      className="mt-6 rounded-lg text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Auto-generate */}
            <div className="rounded-xl border border-dashed border-border p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Auto-generate Credentials
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="auto-generate-count">Number of credentials</Label>
                  <Input
                    id="auto-generate-count"
                    type="number"
                    min={0}
                    max={100}
                    {...register("autoGenerate")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Uses the school&apos;s initials as the prefix, e.g. GH1{suffix}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="custom-prefix">Custom prefix (optional)</Label>
                  <Input
                    id="custom-prefix"
                    {...register("customPrefix")}
                    placeholder="GH"
                  />
                  <p className="text-xs text-muted-foreground">
                    Override the auto-detected school initials
                  </p>
                </div>
              </div>
            </div>

            {errors.root?.message && (
              <p className="text-sm text-destructive">{errors.root.message}</p>
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isSubmitting || createMutation.isPending}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" /> Create Credentials
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Existing credentials table */}
      <Card className="neo-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Existing Credentials</CardTitle>
          <CardDescription>
            {existingCredentials.length} credential{existingCredentials.length === 1 ? "" : "s"} created
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : existingCredentials.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No LeapLab credentials yet. Create some above.
            </div>
          ) : (
            <div className="neo-table-wrapper rounded-xl overflow-hidden border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {existingCredentials.map((credential) => (
                    <TableRow key={credential.id}>
                      <TableCell className="font-mono text-sm">{credential.username}</TableCell>
                      <TableCell>
                        {credential.isActive === true || credential.isActive === 1 ? (
                          <Badge variant="default" className="rounded-lg gap-1">
                            <CheckCircle className="h-3 w-3" /> Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="rounded-lg">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(credential.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete credential ${credential.username}? This cannot be undone.`,
                              )
                            ) {
                              setDeletingId(credential.id);
                              deleteMutation.mutate(credential.id);
                            }
                          }}
                          disabled={deleteMutation.isPending && deletingId === credential.id}
                          className="text-destructive hover:text-destructive rounded-lg"
                        >
                          {deleteMutation.isPending && deletingId === credential.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results dialog */}
      <Dialog open={!!createdCredentials} onOpenChange={() => setCreatedCredentials(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">New LeapLab Credentials</DialogTitle>
            <DialogDescription>
              Copy the passwords now — they are hashed on the server and cannot be shown again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="neo-table-wrapper rounded-xl overflow-hidden border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead className="w-16">Copy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {createdCredentials?.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-sm">{c.username}</TableCell>
                      <TableCell className="font-mono text-sm">{c.plainPassword}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            navigator.clipboard.writeText(c.plainPassword);
                            toast.success("Password copied");
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
                  if (!createdCredentials) return;
                  const text = createdCredentials
                    .map((c) => `${c.username}\t${c.plainPassword}`)
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
                  if (!createdCredentials) return;
                  downloadCredentialsAsCsv(institutionName, createdCredentials);
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
