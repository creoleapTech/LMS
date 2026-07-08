import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { toast } from "sonner";
import { useAuthStore } from "@/store/userAuthStore";

import { useStaffList } from "@/pages/my-classes/hooks/useStaffList";
import { useReportEditor, type BodyItem, type ReportTable, type ReportParams } from "./hooks/useReportEditor";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Config } from "@/lib/config";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Plus,
  Trash2,
  RefreshCw,
  FileText,
  Building2,
  Users,
  Heading2,
  Pilcrow,
  TableIcon,
  Eye,
  Pencil,
  PenLine,
  Send,
  CheckCircle2,
  Clock,
  Inbox,
  Calendar,
  X,
  ShieldCheck,
  ShieldX,
  MessageSquare,
  Upload,
  Shield,
} from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const today = new Date();

export default function ReportsPage({ draftId }: { draftId?: string } = {}) {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin";
  const isAdminRole = isSuperAdmin || isAdmin;

  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string>("");
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  });
  const [previewMode] = useState(false);
  const [showAddTableDialog, setShowAddTableDialog] = useState(false);
  const [newTableCols, setNewTableCols] = useState("");
  const [newTableTitle, setNewTableTitle] = useState("");
  const [viewMode, setViewMode] = useState<"edit" | "submitted">("edit");
  const [signatureLoadError, setSignatureLoadError] = useState(false);
  const signatureFileRef = useRef<HTMLInputElement>(null);
  const principalPdfRef = useRef<HTMLInputElement>(null);

  // Draft action states
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isDeletingDraft, setIsDeletingDraft] = useState(false);

  const adminInstitutionId = isAdmin
    ? (typeof user?.institutionId === "object" ? user?.institutionId?._id : user?.institutionId) || ""
    : "";
  const effectiveInstitutionId = isSuperAdmin ? selectedInstitutionId : adminInstitutionId;

  // For teachers, extract institutionId from auth store
  const teacherInstitutionId = !isAdminRole
    ? (typeof user?.institutionId === "object" ? user?.institutionId?._id : user?.institutionId) || ""
    : "";

  const { data: institutions = [] } = useQuery<{ _id: string; name: string }[]>({
    queryKey: ["institutions-list"],
    queryFn: async () => {
      const res = await _axios.get("/admin/institutions");
      return res.data?.data ?? [];
    },
    enabled: isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const { data: staffList = [], isLoading: staffLoading } = useStaffList(
    isAdminRole ? effectiveInstitutionId || null : null
  );

  useEffect(() => {
    if (isSuperAdmin && institutions.length > 0 && !selectedInstitutionId) {
      setSelectedInstitutionId(institutions[0]._id);
    }
  }, [isSuperAdmin, institutions, selectedInstitutionId]);

  useEffect(() => {
    if (isAdminRole && staffList.length > 0 && !selectedStaffId) {
      setSelectedStaffId(staffList[0]._id);
    }
  }, [isAdminRole, staffList, selectedStaffId]);

  const {
    isGenerating,
    isDownloading,
    isSubmitting,
    isSavingDraft,
    reportData,
    signatureUrl,
    submissionStatus,
    generateReport,
    downloadDocx,
    uploadSignature,
    fetchSignature,
    submitReport,
    saveDraft,
    checkSubmissionStatus,
    loadSubmissionData,
    loadDraftData,
    updateRow,
    addRow,
    removeRow,
    updateSessionColumn,
    addBodyItem,
    updateBodyItem,
    removeBodyItem,
    clearReport,
    updateField,
  } = useReportEditor();

  const isApproved = submissionStatus?.adminApproval === "verified";

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 1) return { year: prev.year - 1, month: 12 };
      return { ...prev, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 12) return { year: prev.year + 1, month: 1 };
      return { ...prev, month: prev.month + 1 };
    });
  };

  // Fetch teacher's signature on mount (teachers only)
  useEffect(() => {
    if (!isAdminRole) {
      fetchSignature();
    }
  }, [isAdminRole, fetchSignature]);

  // Check submission status when month or staff changes
  useEffect(() => {
    checkSubmissionStatus({
      year: currentMonth.year,
      month: currentMonth.month,
      staffId: isAdminRole ? selectedStaffId : null,
    });
  }, [currentMonth.year, currentMonth.month, selectedStaffId, isAdminRole, checkSubmissionStatus]);

  // Load draft if draftId is provided in search params
  useEffect(() => {
    if (draftId) {
      loadDraftData(draftId);
      setViewMode("edit");
    }
  }, [draftId, loadDraftData]);

  // Sync currentMonth state when reportData changes (e.g. when loading a draft or submission)
  useEffect(() => {
    if (reportData) {
      const monthIndex = MONTH_NAMES.indexOf(reportData.monthName) + 1;
      if (monthIndex > 0 && (currentMonth.year !== reportData.year || currentMonth.month !== monthIndex)) {
        setCurrentMonth({
          year: reportData.year,
          month: monthIndex,
        });
      }
    }
  }, [reportData]);

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSignatureLoadError(false);
    await uploadSignature(file);
    if (signatureFileRef.current) signatureFileRef.current.value = "";
  };

  const handlePrincipalPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are accepted");
      return;
    }
    const submissionId = submissionStatus?.submissionId;
    if (!submissionId) {
      toast.error("No active submission found");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("submissionId", submissionId);
    try {
      const res = await _axios.post("/admin/timetable/upload-principal-signed-report", formData);
      if (res.data?.success) {
        toast.success("Principal signed report uploaded");
        checkSubmissionStatus({
          year: currentMonth.year,
          month: currentMonth.month,
          staffId: isAdminRole ? selectedStaffId : null,
        });
      } else {
        toast.error(res.data?.message || "Upload failed");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to upload";
      toast.error(msg);
    }
    if (principalPdfRef.current) principalPdfRef.current.value = "";
  };

  const handleSubmitReport = () => {
    if (reportData) submitReport(reportData);
  };

  const handleSaveDraft = () => {
    if (reportData) saveDraft(reportData);
  };

  const handleGenerate = () => {
    generateReport({
      year: currentMonth.year,
      month: currentMonth.month,
      staffId: isAdminRole ? selectedStaffId : null,
      institutionId: isAdminRole ? effectiveInstitutionId : teacherInstitutionId || null,
    });
  };

  const handleGenerateClick = () => {
    if (submissionStatus?.hasDraft) {
      setShowOverwriteConfirm(true);
    } else {
      handleGenerate();
    }
  };

  const handleDiscardDraft = async () => {
    const draftId = submissionStatus?.draftId;
    if (!draftId) return;
    setIsDeletingDraft(true);
    try {
      await _axios.delete(`/admin/timetable/delete-report-draft?id=${draftId}`);
      toast.success("Draft deleted successfully");
      setShowDiscardConfirm(false);
      clearReport();
      checkSubmissionStatus({
        year: currentMonth.year,
        month: currentMonth.month,
        staffId: isAdminRole ? selectedStaffId : null,
      });
    } catch {
      toast.error("Failed to delete draft");
    } finally {
      setIsDeletingDraft(false);
    }
  };

  const handleRegenerate = () => {
    clearReport();
    handleGenerate();
  };

  const handleDownload = () => {
    if (reportData) downloadDocx(reportData);
  };

  const handleAddTable = () => {
    const cols = newTableCols.split(",").map((c) => c.trim()).filter(Boolean);
    if (cols.length === 0 || !newTableTitle.trim()) return;
    const table: ReportTable = {
      title: newTableTitle.trim(),
      columns: cols,
      rows: [cols.map(() => "")],
    };
    addBodyItem({ kind: "table", table, keepOnSamePage: true });
    setShowAddTableDialog(false);
    setNewTableCols("");
    setNewTableTitle("");
  };

  return (
    <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate and edit monthly lesson completion reports</p>
      </div>

      {/* View Mode Tabs */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setViewMode("edit")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
            viewMode === "edit"
              ? "bg-indigo-600 text-white shadow-md"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Pencil size={16} />
          {isAdminRole ? "Edit Report" : "New Report"}
        </button>
        <button
          onClick={() => setViewMode("submitted")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
            viewMode === "submitted"
              ? "bg-indigo-600 text-white shadow-md"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Inbox size={16} />
          {isAdminRole ? "Submitted Reports" : "My Submissions"}
        </button>
      </div>

      {/* Submitted Reports View */}
      {viewMode === "submitted" ? (
        isAdminRole ? (
          <SubmittedReportsView
            institutionId={effectiveInstitutionId || undefined}
            isSuperAdmin={isSuperAdmin}
            staffList={staffList}
            institutions={institutions}
          />
        ) : (
          <MySubmissionsView
            onView={(id) => {
              loadSubmissionData(id);
              setViewMode("edit");
            }}
          />
        )
      ) : (
        <>
      {/* Admin Selectors */}
      {isAdminRole && (
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {isSuperAdmin && (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                <Building2 size={18} />
              </div>
              <Select
                value={selectedInstitutionId}
                onValueChange={(v) => {
                  setSelectedInstitutionId(v);
                  setSelectedStaffId("");
                  clearReport();
                }}
              >
                <SelectTrigger className="w-64 rounded-xl">
                  <SelectValue placeholder="Select Institution" />
                </SelectTrigger>
                <SelectContent>
                  {institutions.map((inst) => (
                    <SelectItem key={inst._id} value={inst._id}>
                      {inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(isAdmin || (isSuperAdmin && selectedInstitutionId)) && (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg text-violet-600">
                <Users size={18} />
              </div>
              <Select
                value={selectedStaffId}
                onValueChange={(v) => {
                  setSelectedStaffId(v);
                  clearReport();
                }}
                disabled={staffLoading}
              >
                <SelectTrigger className="w-64 rounded-xl">
                  <SelectValue placeholder={staffLoading ? "Loading teachers..." : "Select Teacher"} />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((staff) => (
                    <SelectItem key={staff._id} value={staff._id}>
                      {staff.name} - {staff.type === "teacher" ? "Teacher" : "Admin"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Month Navigation + Generate Button */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
        <div className="flex items-center gap-2 neo-card-flat rounded-xl px-3 py-2">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center min-w-[140px]">
            <span className="text-sm font-bold">
              {MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}
            </span>
          </div>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <Button
          onClick={handleGenerateClick}
          disabled={isGenerating || (isAdminRole && !selectedStaffId)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-300/30 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <FileText size={16} />
          )}
          {isGenerating ? "Generating..." : "Generate Report"}
        </Button>
      </div>

      {/* Admin mode: prompt to select teacher */}
      {isAdminRole && !selectedStaffId && (
        <div className="neo-card-flat rounded-2xl p-12 text-center">
          <Users className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-600 font-semibold text-lg">
            {isSuperAdmin && !selectedInstitutionId
              ? "Select an institution to get started"
              : "Select a teacher to generate their report"}
          </p>
        </div>
      )}

      {/* Report Editor */}
      {reportData && (
        <div className="space-y-6">
          {/* Approved Banner */}
          {isApproved && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold">
              <ShieldCheck size={18} />
              This report has been verified and is now read-only.
            </div>
          )}

          {/* Floating Toolbar */}
          <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-lg px-4 py-2.5 space-y-2">
            {/* Row 1: Content actions + view toggle */}
            <div className="flex items-center gap-2">
              {!isApproved && (
                <>
                  <span className="text-sm font-bold text-slate-700 shrink-0">Quick Actions:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      onClick={() => addBodyItem({ kind: "content", content: { type: "heading", text: "" }, keepOnSamePage: true })}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1.5 rounded-lg font-semibold"
                    >
                      <Heading2 size={14} />
                      Heading
                    </Button>
                    <Button
                      onClick={() => addBodyItem({ kind: "content", content: { type: "paragraph", text: "" }, keepOnSamePage: true })}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1.5 rounded-lg font-semibold"
                    >
                      <Pilcrow size={14} />
                      Paragraph
                    </Button>
                    <Button
                      onClick={() => setShowAddTableDialog(true)}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1.5 rounded-lg font-semibold"
                    >
                      <TableIcon size={14} />
                      Add Table
                    </Button>
                  </div>
                  <div className="h-5 w-px bg-slate-300 mx-1 shrink-0" />
                  <div className="flex items-center gap-1.5">
                    <Button
                      onClick={handleRegenerate}
                      disabled={isGenerating}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1.5 rounded-lg font-semibold"
                    >
                      <RefreshCw size={14} className={isGenerating ? "animate-spin" : ""} />
                      Regenerate
                    </Button>
                  </div>
                  {/* Signature upload (teachers only) */}
                  {!isAdminRole && (
                    <>
                      <input
                        ref={signatureFileRef}
                        type="file"
                        accept="image/*"
                        onChange={handleSignatureUpload}
                        className="hidden"
                      />
                      <Button
                        onClick={() => signatureFileRef.current?.click()}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1.5 rounded-lg font-semibold"
                      >
                        <PenLine size={14} />
                        {signatureUrl && !signatureLoadError ? "Change Signature" : "Upload Signature"}
                      </Button>
                      {signatureUrl && !signatureLoadError && (
                        <img
                          src={signatureUrl}
                          alt="Signature"
                          onError={() => setSignatureLoadError(true)}
                          className="h-10 w-24 object-contain border border-slate-200 rounded"
                        />
                      )}
                    </>
                  )}
                </>
              )}
              <div className="flex-1" />
              {/* Submission status badge */}
              {submissionStatus?.submitted ? (
                <>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg shrink-0">
                    <CheckCircle2 size={14} />
                    Submitted{submissionStatus.submittedAt ? ` on ${new Date(submissionStatus.submittedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}` : ""}
                  </span>
                  {submissionStatus.adminApproval === "verified" && (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg shrink-0">
                      <ShieldCheck size={14} />
                      Verified
                    </span>
                  )}
                  {submissionStatus.adminApproval === "rejected" && (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 px-2.5 py-1.5 rounded-lg shrink-0">
                      <ShieldX size={14} />
                      Rejected
                    </span>
                  )}
                </>
              ) : submissionStatus?.hasDraft ? (
                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg shrink-0">
                  <Clock size={14} />
                  Draft Saved
                </span>
              ) : submissionStatus && !submissionStatus.submitted ? (
                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg shrink-0">
                  <Clock size={14} />
                  Not Submitted
                </span>
              ) : null}
              {submissionStatus?.adminApproval === "rejected" && submissionStatus?.adminComment && (
                <span className="text-xs text-red-600 max-w-[200px] truncate shrink-0" title={submissionStatus.adminComment}>
                  <MessageSquare size={12} className="inline mr-1" />
                  {submissionStatus.adminComment}
                </span>
              )}
            </div>
            {/* Row 2: Actions row (submit + download) */}
            <div className="flex items-center gap-2">
              {/* Submit Report button (teachers only, hidden if approved) */}
              {!isAdminRole && !isApproved && (
                <Button
                  onClick={handleSubmitReport}
                  disabled={isSubmitting || !signatureUrl}
                  title={!signatureUrl ? "Upload your signature first" : undefined}
                  size="sm"
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  {isSubmitting ? "Submitting..." : "Submit Report"}
                </Button>
              )}
              {/* Save Draft button (teachers only, hidden if approved) */}
              {!isAdminRole && !isApproved && reportData && (
                <Button
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft}
                  size="sm"
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold hover:from-amber-600 hover:to-orange-600 transition-all shadow-md disabled:opacity-60"
                >
                  {isSavingDraft ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <FileText size={14} />
                  )}
                  {isSavingDraft ? "Saving..." : "Save Draft"}
                </Button>
              )}
              {!isAdminRole && !isApproved && !signatureUrl && (
                <span className="text-xs font-semibold text-red-600">
                  Signature required to submit
                </span>
              )}
              {/* Principal Signed Report (trainers only, after verification) */}
              {!isAdminRole && isApproved && (() => {
                const submittedAt = submissionStatus?.submittedAt;
                const daysSince = submittedAt ? (Date.now() - new Date(submittedAt).getTime()) / (1000 * 60 * 60 * 24) : Infinity;
                const canEdit = daysSince <= 10;
                const hasPrincipalSigned = !!submissionStatus?.principalSignedKey;
                return (
                  <>
                    <div className="h-5 w-px bg-slate-300 shrink-0" />
                    <input
                      ref={principalPdfRef}
                      type="file"
                      accept="application/pdf"
                      onChange={handlePrincipalPdfUpload}
                      className="hidden"
                    />
                    {canEdit ? (
                      <>
                        {hasPrincipalSigned ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-1.5 rounded-lg font-semibold border-emerald-300 text-emerald-700"
                              onClick={() => window.open(`/admin/timetable/download-principal-signed-report?id=${submissionStatus?.submissionId}`, "_blank")}
                            >
                              <Download size={14} />
                              Signed PDF
                            </Button>
                            <Button
                              onClick={() => principalPdfRef.current?.click()}
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-1.5 rounded-lg font-semibold"
                            >
                              <Upload size={14} />
                              Replace
                            </Button>
                          </>
                        ) : (
                          <Button
                            onClick={() => principalPdfRef.current?.click()}
                            size="sm"
                            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold hover:from-violet-700 hover:to-purple-700 transition-all shadow-md"
                          >
                            <Upload size={14} />
                            Upload Principal Signed PDF
                          </Button>
                        )}
                        <span className="text-[10px] text-slate-500">
                          {Math.ceil(10 - daysSince)} days left
                        </span>
                      </>
                    ) : (
                      <>
                        {hasPrincipalSigned ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1.5 rounded-lg font-semibold border-emerald-300 text-emerald-700"
                            onClick={() => window.open(`/admin/timetable/download-principal-signed-report?id=${submissionStatus?.submissionId}`, "_blank")}
                          >
                            <Download size={14} />
                            Signed PDF
                          </Button>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-semibold text-slate-400">
                            <Shield size={14} />
                            Principal sign window expired
                          </span>
                        )}
                      </>
                    )}
                  </>
                );
              })()}
              <div className="flex-1" />
              <Button
                onClick={handleDownload}
                disabled={isDownloading}
                size="sm"
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md disabled:opacity-60"
              >
                {isDownloading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                {isDownloading ? "Downloading..." : "Download DOCX"}
              </Button>
            </div>
          </div>

          {/* Add Table Dialog */}
          {showAddTableDialog && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
                <h3 className="text-lg font-bold">Add New Table</h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Table Title</label>
                    <Input
                      value={newTableTitle}
                      onChange={(e) => setNewTableTitle(e.target.value)}
                      placeholder="e.g. Assessment Results"
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Column Names (comma-separated)</label>
                    <Input
                      value={newTableCols}
                      onChange={(e) => setNewTableCols(e.target.value)}
                      placeholder="e.g. Date, Score, Grade"
                      className="rounded-lg"
                    />
                    <p className="text-xs text-muted-foreground">Number of columns is fixed after creation</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowAddTableDialog(false)} className="rounded-lg">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddTable}
                    disabled={!newTableTitle.trim() || !newTableCols.trim()}
                    className="rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    Create Table
                  </Button>
                </div>
              </div>
            </div>
          )}

          {previewMode ? (
            <ReportPreview data={reportData} signatureUrl={signatureUrl} />
          ) : (
            <>
              {/* Report Metadata Card */}
              <div className="neo-card rounded-2xl border border-slate-200/80 p-5 bg-slate-50/50 space-y-4 mb-6">
                <h2 className="text-lg font-bold text-slate-700 tracking-wide">Report Session Statistics</h2>
                <p className="text-sm text-muted-foreground">{isApproved ? "Session statistics — read only" : "Adjust the planned and completed sessions count for this monthly report."}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500">No. of Sessions/Periods Planned</label>
                    <Input
                      type="number"
                      value={reportData.sessionsPlanned ?? ""}
                      onChange={(e) => updateField("sessionsPlanned", Number(e.target.value))}
                      className="rounded-lg bg-white"
                      disabled={isApproved}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500">No. of Sessions/Periods Completed</label>
                    <Input
                      type="number"
                      value={reportData.sessionsCompleted ?? ""}
                      onChange={(e) => updateField("sessionsCompleted", Number(e.target.value))}
                      className="rounded-lg bg-white"
                      disabled={isApproved}
                    />
                  </div>
                </div>
              </div>

              {/* Session Summary Table */}
              <div className="neo-card rounded-2xl border-2 border-indigo-200 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 px-5 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-extrabold text-white tracking-wide">Session Summary</h2>
                    <p className="text-sm text-white/80">{isApproved ? "View-only session summary" : "Edit column names and cell values — changes will appear in the downloaded docx"}</p>
                  </div>
                  {!isApproved && (
                    <Button
                      onClick={addRow}
                      variant="secondary"
                      size="sm"
                      className="flex items-center gap-1.5 rounded-lg font-bold"
                    >
                      <Plus size={14} />
                      Add Row
                    </Button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#4FA3D1] text-white">
                        {(reportData.sessionColumns || ["Date", "Class", "Chapter", "Topic", "Remarks"]).map((col, ci) => (
                          <th key={ci} className="px-3 py-2.5">
                            <input
                              value={col}
                              onChange={(e) => updateSessionColumn(ci, e.target.value)}
                              readOnly={isApproved}
                              className={`bg-transparent text-white font-bold text-center w-full outline-none border-b border-white/30 focus:border-white/80 transition-colors ${isApproved ? "cursor-default" : ""}`}
                            />
                          </th>
                        ))}
                        <th className={`px-3 py-2.5 text-center font-bold w-12 ${isApproved ? "hidden" : ""}`}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.rows.length === 0 ? (
                        <tr>
                          <td colSpan={isApproved ? 5 : 6} className="text-center py-8 text-muted-foreground">
                            {isApproved ? "No session entries." : 'No session entries. Click "Add Row" to create one.'}
                          </td>
                        </tr>
                      ) : (
                        reportData.rows.map((row, index) => (
                          <tr key={index} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-1.5">
                              <Input
                                value={row.date}
                                onChange={(e) => updateRow(index, "date", e.target.value)}
                                className="h-8 text-xs rounded-md text-center"
                                readOnly={isApproved}
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <Input
                                value={row.section ? `${row.className}${row.section}` : row.className}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const match = val.match(/^(\d+)\s*([a-zA-Z]*)$/);
                                  if (match) {
                                    updateRow(index, "className", match[1]);
                                    updateRow(index, "section", match[2]);
                                  } else {
                                    updateRow(index, "className", val);
                                    updateRow(index, "section", "");
                                  }
                                }}
                                className="h-8 text-xs rounded-md text-center"
                                readOnly={isApproved}
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <Input
                                value={row.chapterName}
                                onChange={(e) => updateRow(index, "chapterName", e.target.value)}
                                className="h-8 text-xs rounded-md"
                                readOnly={isApproved}
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <Input
                                value={row.topicName}
                                onChange={(e) => updateRow(index, "topicName", e.target.value)}
                                className="h-8 text-xs rounded-md"
                                readOnly={isApproved}
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <Textarea
                                value={row.remarks}
                                onChange={(e) => updateRow(index, "remarks", e.target.value)}
                                className="min-h-[32px] text-xs rounded-md resize-none"
                                rows={1}
                                readOnly={isApproved}
                              />
                            </td>
                            <td className={`px-3 py-1.5 text-center ${isApproved ? "hidden" : ""}`}>
                              <button
                                onClick={() => removeRow(index)}
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                title="Remove row"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Body Items (additional tables, headings, paragraphs) */}
              {(reportData.bodyItems || []).map((item, index) => (
                <BodyItemEditor
                  key={index}
                  item={item}
                  onUpdate={(newItem) => updateBodyItem(index, newItem)}
                  onRemove={() => removeBodyItem(index)}
                  readOnly={isApproved}
                />
              ))}
            </>
          )}

          {/* Bottom Action Bar */}
          <div className="flex items-center gap-3 pb-8">
            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-300/30 disabled:opacity-60"
            >
              {isDownloading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {isDownloading ? "Downloading..." : "Download as DOCX"}
            </Button>
            {!isApproved && (
              <Button
                onClick={handleRegenerate}
                disabled={isGenerating}
                variant="outline"
                className="flex items-center gap-2 rounded-xl font-bold disabled:opacity-60"
              >
                <RefreshCw size={16} className={isGenerating ? "animate-spin" : ""} />
                Regenerate
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!reportData && !isGenerating && !(isAdminRole && !selectedStaffId) && (
        <div className="neo-card rounded-2xl border border-slate-200/80 p-8 sm:p-10 text-center">
          {submissionStatus?.hasDraft ? (
            <>
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Saved Draft Found</h2>
              <p className="text-muted-foreground max-w-xl mx-auto mb-6">
                You have a saved draft for {MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}. You can load this draft to resume editing or generate a fresh report from scratch.
              </p>
              <div className="flex justify-center gap-3">
                <Button
                  onClick={() => submissionStatus.draftId && loadDraftData(submissionStatus.draftId)}
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-300/30"
                >
                  <FileText size={16} className="mr-1.5" />
                  Load Saved Draft
                </Button>
                <Button
                  onClick={handleGenerateClick}
                  variant="outline"
                  className="rounded-xl font-bold border-slate-200 hover:bg-slate-50"
                >
                  Generate Fresh
                </Button>
                <Button
                  onClick={() => setShowDiscardConfirm(true)}
                  variant="outline"
                  className="rounded-xl font-bold border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                >
                  Discard Draft
                </Button>
              </div>
            </>
          ) : submissionStatus?.submitted ? (
            <>
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Monthly Report Submitted</h2>
              <p className="text-muted-foreground max-w-xl mx-auto mb-6">
                Your report for {MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year} was submitted on{" "}
                {submissionStatus.submittedAt
                  ? new Date(submissionStatus.submittedAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
                . You can load this submission to view or make edits.
              </p>
              <div className="flex justify-center gap-3">
                <Button
                  onClick={() => submissionStatus.submissionId && loadSubmissionData(submissionStatus.submissionId)}
                  className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-300/30"
                >
                  <Eye size={16} className="mr-1.5" />
                  {isApproved ? "View Submission" : "View/Edit Submission"}
                </Button>
                {!isApproved && (
                  <Button
                    onClick={handleGenerateClick}
                    variant="outline"
                    className="rounded-xl font-bold border-slate-200 hover:bg-slate-50"
                  >
                    Start Fresh
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileText className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Generate a Monthly Report</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Select a month and click "Generate Report" to load the session table. You can edit the table, add more tables, headings, and paragraphs before downloading as a DOCX file.
              </p>
            </>
          )}
        </div>
      )}
    </>
      )}

      {/* Overwrite Confirmation Dialog */}
      <Dialog open={showOverwriteConfirm} onOpenChange={setShowOverwriteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Overwrite Saved Draft?</DialogTitle>
            <DialogDescription>
              We found a saved draft for {MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}. Generating a new report will discard any unsaved changes in that draft.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end">
            <DialogClose asChild>
              <Button variant="outline" size="sm">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => {
                setShowOverwriteConfirm(false);
                handleGenerate();
              }}
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700 font-bold"
            >
              Generate Fresh
            </Button>
            <Button
              onClick={() => {
                setShowOverwriteConfirm(false);
                if (submissionStatus?.draftId) {
                  loadDraftData(submissionStatus.draftId);
                }
              }}
              size="sm"
              className="bg-indigo-600 text-white hover:bg-indigo-700 font-bold"
            >
              Load Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard Draft Confirmation Dialog */}
      <Dialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Discard Saved Draft?</DialogTitle>
            <DialogDescription>
              Are you sure you want to discard the draft for {MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end">
            <DialogClose asChild>
              <Button variant="outline" size="sm" disabled={isDeletingDraft}>Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleDiscardDraft}
              disabled={isDeletingDraft}
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700 font-bold"
            >
              {isDeletingDraft ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Discard Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Body Item Editor (additional tables, headings, paragraphs) ───

function BodyItemEditor({
  item,
  onUpdate,
  onRemove,
  readOnly,
}: {
  item: BodyItem;
  onUpdate: (item: BodyItem) => void;
  onRemove: () => void;
  readOnly?: boolean;
}) {
  if (item.kind === "table" && item.table) {
    const table = item.table;
    const updateTitle = (title: string) => onUpdate({ kind: "table", table: { ...table, title }, keepOnSamePage: item.keepOnSamePage });
    const updateKeepOnSamePage = (keepOnSamePage: boolean) => onUpdate({ kind: "table", table, keepOnSamePage });
    const updateColumn = (ci: number, name: string) => {
      const columns = [...table.columns];
      columns[ci] = name;
      onUpdate({ kind: "table", table: { ...table, columns }, keepOnSamePage: item.keepOnSamePage });
    };
    const updateCell = (ri: number, ci: number, val: string) => {
      const rows = table.rows.map((r) => [...r]);
      rows[ri][ci] = val;
      onUpdate({ kind: "table", table: { ...table, rows }, keepOnSamePage: item.keepOnSamePage });
    };
    const addTableRow = () => {
      onUpdate({ kind: "table", table: { ...table, rows: [...table.rows, table.columns.map(() => "")] }, keepOnSamePage: item.keepOnSamePage });
    };
    const removeTableRow = (ri: number) => {
      onUpdate({ kind: "table", table: { ...table, rows: table.rows.filter((_, i) => i !== ri) }, keepOnSamePage: item.keepOnSamePage });
    };

    return (
      <div className="neo-card rounded-2xl border-2 border-indigo-200 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 px-5 py-4 flex items-center justify-between">
          <input
            value={table.title}
            onChange={(e) => updateTitle(e.target.value)}
            readOnly={readOnly}
            className={`bg-transparent text-white font-extrabold text-lg tracking-wide outline-none border-b border-white/30 focus:border-white/80 transition-colors flex-1 mr-3 ${readOnly ? "cursor-default" : ""}`}
          />
          <div className="flex items-center gap-3">
            {!readOnly && (
              <>
                <label className="flex items-center gap-1.5 text-xs font-bold text-white/90 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!item.keepOnSamePage}
                    onChange={(e) => updateKeepOnSamePage(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-white/40 bg-white/20 text-indigo-600 focus:ring-0"
                  />
                  Keep on same page
                </label>
                <Button onClick={addTableRow} variant="secondary" size="sm" className="flex items-center gap-1.5 rounded-lg font-bold">
                  <Plus size={14} />
                  Add Row
                </Button>
                <button onClick={onRemove} className="p-1.5 rounded-lg text-white/80 hover:bg-white/20 transition-colors" title="Remove table">
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#4FA3D1] text-white">
                {table.columns.map((col, ci) => (
                  <th key={ci} className="px-3 py-2.5">
                    <input
                      value={col}
                      onChange={(e) => updateColumn(ci, e.target.value)}
                      readOnly={readOnly}
                      className={`bg-transparent text-white font-bold text-center w-full outline-none border-b border-white/30 focus:border-white/80 transition-colors ${readOnly ? "cursor-default" : ""}`}
                    />
                  </th>
                ))}
                <th className={`px-3 py-2.5 text-center font-bold w-12 ${readOnly ? "hidden" : ""}`}></th>
              </tr>
            </thead>
            <tbody>
              {table.rows.length === 0 ? (
                <tr>
                  <td colSpan={readOnly ? table.columns.length : table.columns.length + 1} className="text-center py-6 text-muted-foreground">
                    {readOnly ? "No rows." : 'No rows. Click "Add Row" to create one.'}
                  </td>
                </tr>
              ) : (
                table.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    {row.map((val, ci) => (
                      <td key={ci} className="px-3 py-1.5">
                        <Input
                          value={val}
                          onChange={(e) => updateCell(ri, ci, e.target.value)}
                          className={`h-8 text-xs rounded-md ${ci < 2 ? "text-center" : ""}`}
                          readOnly={readOnly}
                        />
                      </td>
                    ))}
                    <td className={`px-3 py-1.5 text-center ${readOnly ? "hidden" : ""}`}>
                      <button onClick={() => removeTableRow(ri)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors" title="Remove row">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (item.kind === "content" && item.content) {
    const content = item.content;
    const updateText = (text: string) => onUpdate({ kind: "content", content: { ...content, text }, keepOnSamePage: item.keepOnSamePage });

    return (
      <div className="flex items-start gap-2 group">
        <div className="flex flex-col items-start gap-1.5 pt-2 shrink-0 w-28">
          <span className={`text-xs font-bold uppercase ${content.type === "heading" ? "text-indigo-600" : "text-slate-500"}`}>
            {content.type}
          </span>
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          {content.type === "heading" ? (
            <Input
              value={content.text}
              onChange={(e) => updateText(e.target.value)}
              placeholder="Heading text..."
              className="flex-1 rounded-lg font-bold text-base"
              readOnly={readOnly}
            />
          ) : (
            <div className="prose prose-sm max-w-none text-justify [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_li]:my-0.5 [&_p]:my-1 p-2 border border-slate-200 rounded-lg min-h-[40px] bg-white"
              dangerouslySetInnerHTML={{ __html: content.text }}
            />
          )}
        </div>
        {!readOnly && (
          <button
            onClick={onRemove}
            className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors shrink-0 mt-1"
            title="Remove"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    );
  }

  return null;
}

// ─── Report Preview (pixel-perfect paginated docx-like HTML rendering) ───
//
// All measurements converted from docx library units:
//   Font size (half-points) → px:  hp / 2 * 96/72
//   Spacing (twips)         → px:  tw / 20 * 96/72
//   Line spacing (240 base) → ratio:  val / 240
//   Page: A4 portrait 8.27"×11.69" = 794×1122px, margins 1" = 96px
//   Content area: 647×930px

const PX_PER_PT = 96 / 72; // 1.333
const hp = (n: number) => `${(n / 2) * PX_PER_PT}px`; // half-points → px
const tw = (n: number) => `${(n / 20) * PX_PER_PT}px`; // twips → px
const LINE_276 = 276 / 240; // 1.15
const LINE_SINGLE = 1; // Word default single spacing for empty paragraphs

const PAGE_W = 794; // A4 width: 8.27" * 96 = 793.92px -> 794px
const PAGE_H = 1122; // A4 height: 11.69" * 96 = 1122.24px -> 1122px
const MARGIN = 96; // 1 inch = 96px
const LEFT_MARGIN = 115; // stripe width + 10px safety margin
const RIGHT_MARGIN = 32; // right margin of 480 twips = 32px
const CONTENT_W = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN; // 647px
const CONTENT_H = PAGE_H - 2 * MARGIN; // 930px
const PAGE_GAP = 32; // px between preview pages
const PAGE_SHADOW = "0 4px 6px -1px rgba(0,0,0,0.1), 0 10px 15px -3px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)";

const CELL_PADDING = `${tw(40)} ${tw(80)}`;
const SESSION_CELL_PADDING = `${tw(40)} ${tw(20)}`;
const SESSION_TABLE_FONT_SIZE = 20;
const BORDER_CSS = "1px solid #999999";
const PREVIEW_TABLE_CELL_TEXT: React.CSSProperties = {
  boxSizing: "border-box",
  lineHeight: 1.12,
  minWidth: 0,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  whiteSpace: "normal",
};
const PREVIEW_SESSION_COL_WIDTHS = [69, 40, 79, 84];

// ─── Pagination types ───

interface Unit {
  id: string;
  type: "heading" | "paragraph" | "table-title" | "table-header" | "table-row" | "signature-section";
  tableId?: number;
  text?: string;
  format?: "plain" | "bullet" | "number";
  bold?: boolean;
  columns?: string[];
  cells?: string[];
  style?: React.CSSProperties;
  measuredHeight?: number;
  forceNewPage?: boolean;
  keepTogether?: boolean;
}

// ─── Build flat list of paginatable units from report data ───

function buildUnits(data: ReportParams): Unit[] {
  const units: Unit[] = [];
  let tableCounter = 0;
  const sessionCols = data.sessionColumns || ["Date", "Class", "Chapter", "Topic", "Remarks"];

  units.push({
    id: "session-heading",
    type: "heading",
    text: "Session Summary",
    style: { fontWeight: "bold", fontSize: hp(24), color: "#000000", marginTop: tw(240), marginBottom: tw(300) },
  });

  tableCounter++;
  units.push({ id: "session-header", type: "table-header", tableId: tableCounter, columns: sessionCols });

  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i];
    const classSection = row.section ? `${row.className}${row.section}` : row.className;
    units.push({
      id: `session-row-${i}`,
      type: "table-row",
      tableId: tableCounter,
      cells: [row.date, classSection, row.chapterName, row.topicName, row.remarks],
    });
  }

  for (let bi = 0; bi < (data.bodyItems || []).length; bi++) {
    const item = data.bodyItems![bi];
    const forceNewPage = !item.keepOnSamePage;

    if (item.kind === "table" && item.table) {
      tableCounter++;
      units.push({
        id: `body-table-title-${bi}`,
        type: "table-title",
        text: item.table.title,
        style: { fontWeight: "bold", fontSize: hp(24), color: "#000000", marginBottom: tw(300) },
        forceNewPage,
        keepTogether: item.keepOnSamePage,
      });
      units.push({ id: `body-table-header-${bi}`, type: "table-header", tableId: tableCounter, columns: item.table.columns });
      for (let ri = 0; ri < item.table.rows.length; ri++) {
        units.push({ id: `body-table-row-${bi}-${ri}`, type: "table-row", tableId: tableCounter, cells: item.table.rows[ri] });
      }
    } else if (item.kind === "content" && item.content) {
      // Check if the next item wants to stay on same page — if so, this item must keepTogether with it
      const nextItem = bi + 1 < (data.bodyItems || []).length ? data.bodyItems![bi + 1] : null;
      const nextWantsSamePage = !!nextItem?.keepOnSamePage;

      if (item.content.type === "heading") {
        units.push({
          id: `body-heading-${bi}`,
          type: "heading",
          text: item.content.text,
          style: { fontWeight: "bold", fontSize: hp(24), color: "#000000", marginTop: tw(300), marginBottom: tw(120) },
          forceNewPage,
          keepTogether: item.keepOnSamePage || nextWantsSamePage,
        });
      } else {
        units.push({
          id: `body-paragraph-${bi}`,
          type: "paragraph",
          text: item.content.text,
          format: item.content.format,
          bold: item.content.bold,
          style: { fontSize: hp(24), marginTop: tw(80), marginBottom: tw(80), lineHeight: LINE_276 },
          forceNewPage,
          keepTogether: item.keepOnSamePage,
        });
      }
    }
  }

  units.push({
    id: "signature-section",
    type: "signature-section",
    keepTogether: true,
  });

  return units;
}

// ─── Paginate measured units into pages ───

function paginateUnits(units: Unit[], availableHeight: number): Unit[][] {
  const pages: Unit[][] = [];
  let currentPage: Unit[] = [];
  let currentHeight = 0;

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    const unitHeight = unit.measuredHeight || 0;

    if (unit.forceNewPage && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      currentHeight = 0;
    }

    if (currentHeight + unitHeight > availableHeight && currentPage.length > 0) {
      // If this unit has keepTogether, look backward to find the full keepTogether group
      // and move them all to the next page together
      if (unit.keepTogether) {
        // Collect all trailing keepTogether units from the current page
        let groupStart = currentPage.length - 1;
        while (groupStart > 0 && currentPage[groupStart - 1].keepTogether) {
          groupStart--;
        }
        
        // Only move the group if it doesn't take up the entire page,
        // otherwise we would just get an infinite loop of pushing and overflowing.
        if (groupStart > 0) {
          // Move the keepTogether group to the new page
          const keepTogetherGroup = currentPage.splice(groupStart);

          // End current page if it has content, otherwise just reset height
          if (currentPage.length > 0) {
            const lastItem = currentPage[currentPage.length - 1];
            if (lastItem.type === "table-header") {
              currentPage.pop();
              currentHeight -= lastItem.measuredHeight || 0;
              if (currentPage.length > 0) {
                pages.push(currentPage);
              }
              currentPage = [];
              currentHeight = 0;
              currentPage.push(lastItem);
              currentHeight += lastItem.measuredHeight || 0;
            } else {
              pages.push(currentPage);
              currentPage = [];
              currentHeight = 0;
            }
          } else {
            currentPage = [];
            currentHeight = 0;
          }

          // Repeat table headers on new page for any table rows in the group
          const tableIdsInGroup = new Set(
            keepTogetherGroup
              .filter(u => u.type === "table-row" && u.tableId)
              .map(u => u.tableId)
          );
          for (const tid of tableIdsInGroup) {
            if (!currentPage.some(u => u.type === "table-header" && u.tableId === tid)) {
              const header = units.find(u => u.type === "table-header" && u.tableId === tid);
              if (header) {
                currentPage.push({ ...header });
                currentHeight += header.measuredHeight || 0;
              }
            }
          }

          // Add the keepTogether group to the new page
          for (const gUnit of keepTogetherGroup) {
            currentPage.push(gUnit);
            currentHeight += gUnit.measuredHeight || 0;
          }

          // Add the current unit that triggered the overflow
          currentPage.push(unit);
          currentHeight += unitHeight;
          continue;
        }
      }

      // Don't orphan a table header at the bottom of a page
      const lastItem = currentPage[currentPage.length - 1];
      if (lastItem.type === "table-header") {
        currentPage.pop();
        currentHeight -= lastItem.measuredHeight || 0;
      }

      pages.push(currentPage);
      currentPage = [];
      currentHeight = 0;

      // Re-add orphaned header to new page
      if (lastItem.type === "table-header") {
        currentPage.push(lastItem);
        currentHeight += lastItem.measuredHeight || 0;
      }

      // Repeat table header on new page for table rows (tableHeader: true in docx)
      if (unit.type === "table-row" && unit.tableId) {
        const hasHeader = currentPage.some(u => u.type === "table-header" && u.tableId === unit.tableId);
        if (!hasHeader) {
          const header = units.find(u => u.type === "table-header" && u.tableId === unit.tableId);
          if (header) {
            currentPage.push({ ...header });
            currentHeight += header.measuredHeight || 0;
          }
        }
      }
    }

    currentPage.push(unit);
    currentHeight += unitHeight;
  }

  if (currentPage.length > 0) pages.push(currentPage);
  return pages;
}

// ─── Table rendering (shared by measurement and visible pages) ───

function renderTableUnits(units: Unit[], key: string): React.ReactNode {
  const headerUnit = units.find(u => u.type === "table-header");
  const rowUnits = units.filter(u => u.type === "table-row");
  const columns = headerUnit?.columns || [];
  const colCount = columns.length;
  const isSessionSummary = headerUnit?.id === "session-header" && colCount === 5;
  const sessionSummaryWidths = isSessionSummary
    ? PREVIEW_SESSION_COL_WIDTHS
    : [];
  const cellPadding = isSessionSummary ? SESSION_CELL_PADDING : CELL_PADDING;
  const fontSize = isSessionSummary ? hp(SESSION_TABLE_FONT_SIZE) : hp(24);

  return (
    <table key={key} style={{ width: "100%", borderCollapse: "collapse", border: BORDER_CSS, tableLayout: "fixed" }}>
      <colgroup>
        {colCount <= 2
          ? columns.map((_, i) => <col key={i} />)
          : columns.map((_, i) => (
              <col
                key={i}
                style={sessionSummaryWidths[i] ? { width: `${sessionSummaryWidths[i]}px` } : undefined}
              />
            ))
        }
      </colgroup>
      <thead>
        <tr data-unit-id={headerUnit?.id} style={{ backgroundColor: "#4FA3D1" }}>
          {columns.map((col, ci) => (
            <th key={ci} style={{
              ...PREVIEW_TABLE_CELL_TEXT,
              color: "#FFFFFF", fontWeight: "bold", fontSize,
              textAlign: "center", padding: cellPadding, border: BORDER_CSS, verticalAlign: "middle",
            }}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rowUnits.length === 0 ? (
          <tr>
            <td colSpan={colCount} style={{
              ...PREVIEW_TABLE_CELL_TEXT,
              fontSize, textAlign: "center", color: "#999",
              padding: cellPadding, border: BORDER_CSS, verticalAlign: "middle",
            }}>No rows</td>
          </tr>
        ) : (
          rowUnits.map((unit, ri) => (
            <tr key={ri} data-unit-id={unit.id}>
              {unit.cells?.map((val, ci) => (
                <td key={ci} style={{
                  ...PREVIEW_TABLE_CELL_TEXT,
                  fontSize,
                  textAlign: ci < 2 ? "center" : "left",
                  padding: cellPadding, border: BORDER_CSS, verticalAlign: "top",
                }}>{val || ""}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

// ─── Render content for hidden measurement container ───

function renderSignatureSection(dataUnitId?: string): React.ReactNode {
  return (
    <div data-unit-id={dataUnitId} style={{ marginTop: tw(100) }}>
      <div style={{ fontWeight: "bold", fontSize: hp(24) }}>
        Submitted on: {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: tw(40) }}>
        <div style={{ width: "45%" }}>
          <div style={{ fontSize: hp(24), marginBottom: tw(40) }}>Principal's Signature</div>
        </div>
        <div style={{ width: "45%", textAlign: "right" }}>
          <div style={{ height: "100px", width: "180px", marginLeft: "auto" }} />
          <div style={{ fontSize: hp(24) }}>Trainer's Signature</div>
          <div style={{ borderTop: "1px solid #000000", height: "1px", width: "100%", marginTop: "4px" }} />
        </div>
      </div>
    </div>
  );
}

function renderSignatureSectionWithData(signatureUrl: string | null | undefined, dataUnitId?: string): React.ReactNode {
  return (
    <div data-unit-id={dataUnitId} style={{ marginTop: tw(100) }}>
      <div style={{ fontWeight: "bold", fontSize: hp(24) }}>
        Submitted on: {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: tw(40) }}>
        <div style={{ width: "45%" }}>
          <div style={{ fontSize: hp(24), marginBottom: tw(40) }}>Principal's Signature</div>
        </div>
        <div style={{ width: "45%", textAlign: "right" }}>
          {signatureUrl ? (
            <img src={signatureUrl} alt="Signature" style={{ height: "100px", width: "180px", objectFit: "contain", marginLeft: "auto" }} />
          ) : (
            <div style={{ height: "100px", width: "180px", marginLeft: "auto" }} />
          )}
          <div style={{ fontSize: hp(24) }}>Trainer's Signature</div>
          {!signatureUrl && <div style={{ borderTop: "1px solid #000000", height: "1px", width: "100%", marginTop: "4px" }} />}
        </div>
      </div>
    </div>
  );
}

function parseInlineBold(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<strong key={parts.length}>{match[1]}</strong>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

function renderParagraphContent(text: string, format?: "plain" | "bullet" | "number", bold?: boolean): React.ReactNode {
  if (!text) return null;

  // HTML from Tiptap editor — render directly
  if (text.startsWith("<")) {
    return (
      <div
        className="prose prose-sm max-w-none text-justify [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_li]:my-0.5 [&_p]:my-1"
        style={{ textAlign: "justify" }}
        dangerouslySetInnerHTML={{ __html: text }}
      />
    );
  }

  // Legacy plain text with **bold** markdown
  const normalized = text.replace(/\r\n/g, "\n");
  const renderInline = (line: string) => {
    if (bold) return <strong>{line}</strong>;
    if (line.includes("**")) return <>{parseInlineBold(line)}</>;
    return line;
  };

  const renderMultiline = (block: string) => {
    const lines = block.split("\n");
    if (lines.length === 1) return renderInline(lines[0]);
    return (
      <>
        {lines.map((line, idx) => (
          <span key={idx}>
            {idx > 0 && <br />}
            {renderInline(line)}
          </span>
        ))}
      </>
    );
  };

  if (format === "bullet") {
    const items = normalized.split(/\n\n+|\n(?=\s*[•●◦▪➢►‣⁃\-*])\s*/).map(s => s.replace(/^\s*[•●◦▪➢►‣⁃\-*]\s*/, "").trim()).filter(l => l);
    return (
      <ul style={{ margin: 0, paddingLeft: "20px", listStyleType: "disc", textAlign: "justify" }}>
        {items.map((item, idx) => (
          <li key={idx} style={{ marginBottom: "6px" }}>{renderMultiline(item)}</li>
        ))}
      </ul>
    );
  }
  if (format === "number") {
    const items = normalized.split(/\n\n+|\n(?=\s*\d+[.)]\s)/).map(s => s.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(l => l);
    return (
      <ol style={{ margin: 0, paddingLeft: "20px", textAlign: "justify" }}>
        {items.map((item, idx) => (
          <li key={idx} style={{ marginBottom: "6px" }}>{renderMultiline(item)}</li>
        ))}
      </ol>
    );
  }
  return <div style={{ whiteSpace: "pre-wrap", textAlign: "justify" }}>{renderInline(normalized)}</div>;
}

function renderMeasurementContent(units: Unit[]): React.ReactNode {
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < units.length) {
    const unit = units[i];

    if (unit.type === "signature-section") {
      elements.push(renderSignatureSection(unit.id));
      i++;
    } else if (unit.type === "table-header" || unit.type === "table-row") {
      const tableUnits: Unit[] = [];
      let j = i;
      while (j < units.length && (units[j].type === "table-header" || units[j].type === "table-row") && units[j].tableId === unit.tableId) {
        tableUnits.push(units[j]);
        j++;
      }
      elements.push(renderTableUnits(tableUnits, `measure-table-${i}`));
      i = j;
    } else {
      elements.push(
        <div key={unit.id} data-unit-id={unit.id} style={unit.style}>
          {unit.type === "paragraph"
            ? renderParagraphContent(unit.text || "", unit.format, unit.bold)
            : unit.text}
        </div>
      );
      i++;
    }
  }

  return elements;
}

function renderPageContent(units: Unit[], signatureUrl?: string | null): React.ReactNode {
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < units.length) {
    const unit = units[i];

    if (unit.type === "signature-section") {
      elements.push(renderSignatureSectionWithData(signatureUrl, unit.id));
      i++;
    } else if (unit.type === "table-header" || unit.type === "table-row") {
      const tableUnits: Unit[] = [];
      let j = i;
      while (j < units.length && (units[j].type === "table-header" || units[j].type === "table-row") && units[j].tableId === unit.tableId) {
        tableUnits.push(units[j]);
        j++;
      }
      elements.push(renderTableUnits(tableUnits, `page-table-${i}`));
      i = j;
    } else {
      elements.push(
        <div key={unit.id} style={unit.style}>
          {unit.type === "paragraph"
            ? renderParagraphContent(unit.text || "", unit.format, unit.bold)
            : unit.text}
        </div>
      );
      i++;
    }
  }

  return elements;
}

function parseClassLabel(label: string) {
  const match = label.trim().match(/^(\d+)\s*([a-zA-Z]*)$/);
  if (match) {
    return {
      isNumeric: true,
      grade: parseInt(match[1], 10),
      section: match[2].toUpperCase(),
    };
  }
  return {
    isNumeric: false,
    grade: label,
    section: "",
  };
}

function sortClassesLabel(classesLabel: string | undefined | null): string {
  if (!classesLabel) return "—";
  const cleaned = classesLabel.replace(/[\u2014—-]/g, "").trim();
  if (!cleaned) return "—";

  const parts = cleaned.split(",").map(s => s.trim()).filter(Boolean);

  parts.sort((a, b) => {
    const infoA = parseClassLabel(a);
    const infoB = parseClassLabel(b);

    if (infoA.isNumeric && infoB.isNumeric) {
      const gradeA = infoA.grade as number;
      const gradeB = infoB.grade as number;
      if (gradeA !== gradeB) {
        return gradeA - gradeB;
      }
      return infoA.section.localeCompare(infoB.section);
    }

    if (infoA.isNumeric && !infoB.isNumeric) return -1;
    if (!infoA.isNumeric && infoB.isNumeric) return 1;

    return a.localeCompare(b);
  });

  return parts.join(", ");
}

// ─── Cover Page (always page 1) ───

function CoverPage({ data }: { data: ReportParams }) {
  return (
    <div style={{
      width: `${PAGE_W}px`, height: `${PAGE_H}px`,
      paddingTop: `${MARGIN}px`, paddingBottom: `${MARGIN}px`,
      paddingLeft: `${LEFT_MARGIN}px`, paddingRight: `${RIGHT_MARGIN}px`,
      boxSizing: "border-box", fontFamily: "'Times New Roman', serif", color: "#000000", overflow: "hidden",
    }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ marginBottom: tw(200), fontSize: hp(22), lineHeight: LINE_SINGLE }}>&nbsp;</div>
      ))}
      <div style={{ textAlign: "center", marginBottom: tw(80) }}>
        <span style={{ fontWeight: "bold", fontSize: hp(56) }}>Monthly Lesson Completion Report</span>
      </div>
      <div style={{ textAlign: "center", marginBottom: tw(400) }}>
        <span style={{ fontWeight: "bold", fontSize: hp(142), color: "#660000" }}>{data.monthName} {data.year}</span>
      </div>
      <div style={{ marginBottom: tw(100), fontSize: hp(22), lineHeight: LINE_SINGLE }}>&nbsp;</div>
      <div style={{ marginBottom: tw(80), marginTop: tw(80), lineHeight: LINE_276, fontSize: hp(32) }}>
        <span style={{ fontWeight: "bold" }}>From: </span>
        <span style={{ fontWeight: "bold" }}>CREOLEAP TECHNOLOGIES PVT LTD</span>
      </div>
      <div style={{ marginBottom: tw(80), marginTop: tw(80), lineHeight: LINE_276, fontSize: hp(32) }}>
        <span style={{ fontWeight: "bold" }}>Month: </span>{data.monthName} {data.year}
      </div>
      <div style={{ marginBottom: tw(80), marginTop: tw(80), fontSize: hp(32) }}>
        <span style={{ fontWeight: "bold" }}>Submitted by: </span>{data.staffNames[0] || ""}
      </div>
      {data.staffNames.slice(1).map((name, i) => (
        <div key={i} style={{ marginBottom: tw(60), marginLeft: tw(1800), fontSize: hp(32) }}>{name}</div>
      ))}
      <div style={{ marginBottom: tw(400), fontSize: hp(22), lineHeight: LINE_SINGLE }}>&nbsp;</div>
      <div style={{ marginTop: tw(240), marginBottom: tw(120), fontWeight: "bold", fontSize: hp(40) }}>School Information</div>
      {[
        { label: "School Name", value: data.schoolName, bold: true },
        { label: "Class/Grade", value: sortClassesLabel(data.classesLabel), bold: false },
        { label: "Subject/Program", value: data.subjectLabel, bold: false },
        { label: "No. of Sessions/Periods Planned", value: String(data.sessionsPlanned), bold: false },
        { label: "No. of Sessions/Periods Completed", value: String(data.sessionsCompleted), bold: false },
      ].map((row, i) => (
        <div key={i} style={{ marginTop: tw(80), marginBottom: tw(80), lineHeight: LINE_276, fontSize: hp(32) }}>
          <span style={{ fontWeight: "bold" }}>{row.label}: </span>
          <span style={{ fontWeight: row.bold ? "bold" : "normal" }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Report Preview (main component with pagination) ───

interface ReportAssets {
  blueStripe: string | null;
  logo: string | null;
  blueStripeSize: { width: number; height: number };
  logoSize: { width: number; height: number };
  logoOffset: number;
}

const LOGO_LEFT_PX = 3750000 / 9525; // EMUs → px

function PageHeader({ assets }: { assets: ReportAssets | null }) {
  if (!assets) return null;
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0 }}>
      {assets.blueStripe && (
        <img
          src={assets.blueStripe}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: `${assets.blueStripeSize.width}px`,
            height: `${assets.blueStripeSize.height}px`,
            objectFit: "cover",
          }}
        />
      )}
      {assets.logo && (
        <img
          src={assets.logo}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: `${LOGO_LEFT_PX}px`,
            width: `${assets.logoSize.width}px`,
            height: `${assets.logoSize.height}px`,
          }}
        />
      )}
    </div>
  );
}

function ReportPreview({ data, signatureUrl }: { data: ReportParams; signatureUrl?: string | null }) {
  const [pages, setPages] = useState<Unit[][] | null>(null);
  const scale = 1; // Fixed scale for proper page layouts and reading (A4 size: 794x1122 px)
  const [assets, setAssets] = useState<ReportAssets | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const units = useMemo(() => buildUnits(data), [data]);

  // Fetch report header assets
  useEffect(() => {
    let cancelled = false;
    _axios.get("/admin/timetable/report-assets")
      .then(res => {
        if (!cancelled) setAssets(res.data?.data ?? null);
      })
      .catch(() => { /* ignore — preview works without assets */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!measureRef.current) return;

    const measuredUnits = units.map(u => ({ ...u }));

    for (const unit of measuredUnits) {
      const el = measureRef.current.querySelector(`[data-unit-id="${unit.id}"]`) as HTMLElement;
      if (el) {
        if (el.tagName === "TR") {
          unit.measuredHeight = el.getBoundingClientRect().height;
        } else {
          const style = getComputedStyle(el);
          unit.measuredHeight = el.getBoundingClientRect().height
            + parseFloat(style.marginTop)
            + parseFloat(style.marginBottom);
        }
      }
    }

    const paginated = paginateUnits(measuredUnits, CONTENT_H);
    setPages(paginated);
  }, [units]);

  // Scaled height of a page = PAGE_H * scale; used for layout spacing
  const scaledPageH = PAGE_H * scale;
  const scaledPageW = PAGE_W * scale;

  return (
    <div ref={containerRef} className="w-full overflow-x-auto pb-4 flex flex-col items-center">
      {/* Cover Page — scaled */}
      <div style={{ width: `${scaledPageW}px`, height: `${scaledPageH}px`, marginBottom: `${PAGE_GAP}px`, overflow: "hidden" }}>
        <div style={{ width: `${PAGE_W}px`, transformOrigin: "top left", transform: `scale(${scale})` }}>
          <div data-report-page="cover" style={{ position: "relative", width: `${PAGE_W}px`, height: `${PAGE_H}px`, background: "white", boxShadow: PAGE_SHADOW, overflow: "hidden" }}>
            <PageHeader assets={assets} />
            <CoverPage data={data} />
          </div>
        </div>
      </div>

      {/* Content Pages — scaled */}
      {pages ? (
        pages.map((pageUnits, i) => {
          return (
          <div key={i} style={{ width: `${scaledPageW}px`, height: `${scaledPageH}px`, marginBottom: `${PAGE_GAP}px`, overflow: "hidden" }}>
            <div style={{ width: `${PAGE_W}px`, transformOrigin: "top left", transform: `scale(${scale})` }}>
              <div data-report-page="content" style={{ position: "relative", width: `${PAGE_W}px`, height: `${PAGE_H}px`, background: "white", boxShadow: PAGE_SHADOW, overflow: "hidden" }}>
                <PageHeader assets={assets} />
                <div style={{
                  position: "relative", zIndex: 1,
                  width: `${PAGE_W}px`, height: `${PAGE_H}px`,
                  paddingTop: `${MARGIN}px`, paddingBottom: `${MARGIN}px`,
                  paddingLeft: `${LEFT_MARGIN}px`, paddingRight: `${RIGHT_MARGIN}px`,
                  boxSizing: "border-box", fontFamily: "'Times New Roman', serif", color: "#000000", overflow: "hidden",
                }}>
                  {renderPageContent(pageUnits, signatureUrl)}
                </div>
              </div>
            </div>
          </div>
          );
        })
      ) : (
        <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
          <Loader2 className="animate-spin mx-auto" size={24} />
        </div>
      )}

      {/* Hidden measurement container — fixed at content width for accurate text wrapping */}
      <div ref={measureRef} style={{
        position: "absolute", visibility: "hidden", left: "-9999px",
        width: `${CONTENT_W}px`, fontFamily: "'Times New Roman', serif", color: "#000000",
      }}>
        {renderMeasurementContent(units)}
      </div>
    </div>
  );
}

// ─── Submitted Reports View (admin/superadmin) ───

function SubmittedReportsView({
  institutionId,
  isSuperAdmin,
  staffList,
  institutions,
}: {
  institutionId?: string;
  isSuperAdmin: boolean;
  staffList: { _id: string; name: string; salutation?: string; type?: string }[];
  institutions: { _id: string; name: string }[];
}) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [filterStaffId, setFilterStaffId] = useState<string>("");
  const [filterInstitutionId, setFilterInstitutionId] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");
  const [rejectDialog, setRejectDialog] = useState<{ report: any; comment: string } | null>(null);

  // View state
  const [viewingSubmission, setViewingSubmission] = useState<{
    reportData: ReportParams;
    signatureUrl: string | null;
    staffName: string;
    staffId: string | null;
    monthName: string;
    year: number;
  } | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  useEffect(() => {
    setLoading(true);
    let url = `/admin/timetable/submitted-reports`;
    const params: string[] = [];
    const instId = isSuperAdmin ? (filterInstitutionId && filterInstitutionId !== "all" ? filterInstitutionId : "") : institutionId;
    if (instId) params.push(`institutionId=${instId}`);
    if (filterStaffId && filterStaffId !== "all") params.push(`staffId=${filterStaffId}`);
    if (filterMonth && filterMonth !== "all") params.push(`month=${filterMonth}`);
    if (filterYear && filterYear !== "all") params.push(`year=${filterYear}`);
    if (params.length > 0) url += `?${params.join("&")}`;

    _axios.get(url)
      .then((res) => {
        if (res.data?.success) {
          setReports(res.data.data || []);
        }
      })
      .catch(() => {
        setReports([]);
      })
      .finally(() => setLoading(false));
  }, [institutionId, filterInstitutionId, filterStaffId, filterMonth, filterYear, isSuperAdmin]);

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      await _axios.post("/admin/timetable/approve-report", { submissionId: id });
      toast.success("Report approved successfully");
      setReports((prev) => prev.map((r) => r.id === id ? { ...r, adminApproval: "verified" } : r));
    } catch {
      toast.error("Failed to approve report");
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectDialog) return;
    const { report, comment } = rejectDialog;
    try {
      await _axios.post("/admin/timetable/reject-report", { submissionId: report.id, comment });
      toast.success("Report rejected");
      setReports((prev) => prev.map((r) => r.id === report.id ? { ...r, adminApproval: "rejected", adminComment: comment } : r));
    } catch {
      toast.error("Failed to reject report");
    } finally {
      setRejectDialog(null);
    }
  };

  const handleRejectClick = (report: any) => {
    setRejectDialog({ report, comment: "" });
  };

  const handleDownloadDocx = async (id: string) => {
    setDownloadingId(id);
    try {
      const res = await _axios.get(`/admin/timetable/download-submitted-report?id=${id}`, {
        responseType: "blob",
      });
      const docxBlob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const reportItem = reports.find((x) => x.id === id);
      const monthName = reportItem ? MONTH_NAMES[(reportItem.month || 1) - 1] : "Report";
      const year = reportItem?.year || "";

      const url = window.URL.createObjectURL(docxBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Monthly_Report_${monthName}_${year}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      toast.success("Report downloaded as DOCX");
    } catch (err) {
      console.error(err);
      toast.error("Failed to download report");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleViewInApp = async (r: any) => {
    setViewLoading(true);
    try {
      const [dataRes, sigRes] = await Promise.all([
        _axios.get(`/admin/timetable/submission-data?id=${r.id}`),
        r.staffId
          ? _axios.get(`/admin/timetable/staff-signature?staffId=${r.staffId}`).catch(() => null)
          : Promise.resolve(null),
      ]);

      const reportData = dataRes.data?.data?.reportData as ReportParams | undefined;
      if (!reportData) {
        toast.error("No report data found");
        return;
      }

      let signatureUrl: string | null = null;
      const sigKey = sigRes?.data?.data?.signatureKey;
      if (sigKey) {
        signatureUrl = `${Config.proxyUrl}${encodeURIComponent(sigKey)}`;
      }

      setViewingSubmission({
        reportData,
        signatureUrl,
        staffName: r.staffName || "Unknown",
        staffId: r.staffId || null,
        monthName: MONTH_NAMES[(r.month || 1) - 1],
        year: r.year,
      });
    } catch {
      toast.error("Failed to load report data");
    } finally {
      setViewLoading(false);
    }
  };

  const downloadPreviewPdf = useCallback(async () => {
    if (!viewingSubmission) return;
    try {
      const staffParam = viewingSubmission.staffId ? `?staffId=${viewingSubmission.staffId}` : "";
      const res = await _axios.post(
        `/admin/timetable/generate-report-pdf${staffParam}`,
        viewingSubmission.reportData,
        { responseType: "blob" },
      );
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Monthly_Report_${viewingSubmission.monthName}_${viewingSubmission.year}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      toast.success("PDF downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    }
  }, [viewingSubmission]);

  const hasActiveFilter =
    (filterStaffId && filterStaffId !== "all") ||
    (filterInstitutionId && filterInstitutionId !== "all") ||
    (filterMonth && filterMonth !== "all") ||
    (filterYear && filterYear !== "all");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (reports.length === 0 && !hasActiveFilter) {
    return (
      <div className="neo-card rounded-2xl border border-slate-200/80 p-12 text-center">
        <Inbox className="h-12 w-12 text-slate-400 mx-auto mb-3" />
        <p className="text-slate-600 font-semibold text-lg">No submitted reports yet</p>
        <p className="text-muted-foreground text-sm mt-1">Submitted reports by teachers will appear here.</p>
      </div>
    );
  }

  return (
    <>
      <div className="neo-card rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 px-5 py-4">
          <h2 className="text-lg font-extrabold text-white tracking-wide">Submitted Reports</h2>
          <p className="text-sm text-white/80">
            {isSuperAdmin ? "All schools" : "Your school"} — {reports.length} report{reports.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Filters */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 space-y-3">
          {/* Row 1: School + Teacher + Clear */}
          <div className="flex flex-wrap items-center gap-3">
            {isSuperAdmin && (
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                  <Building2 size={16} />
                </div>
                <Select value={filterInstitutionId} onValueChange={setFilterInstitutionId}>
                  <SelectTrigger className="w-56 rounded-xl">
                    <SelectValue placeholder="All Schools" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Schools</SelectItem>
                    {institutions.map((inst) => (
                      <SelectItem key={inst._id} value={inst._id}>
                        {inst.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="p-2 bg-violet-100 rounded-lg text-violet-600">
                <Users size={16} />
              </div>
              <Select value={filterStaffId} onValueChange={setFilterStaffId}>
                <SelectTrigger className="w-56 rounded-xl">
                  <SelectValue placeholder="All Teachers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teachers</SelectItem>
                  {staffList.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.salutation ? `${s.salutation} ` : ""}{s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilter && (
              <button
                onClick={() => {
                  setFilterStaffId("");
                  setFilterInstitutionId("");
                  setFilterMonth("");
                  setFilterYear("");
                }}
                className="text-xs text-slate-500 hover:text-slate-700 underline flex items-center gap-1"
              >
                <X size={12} />
                Clear all filters
              </button>
            )}
          </div>

          {/* Row 2: Month + Year */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                <Calendar size={16} />
              </div>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-40 rounded-xl">
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-32 rounded-xl">
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 font-medium">No reports match your filters</p>
            <p className="text-slate-400 text-xs mt-1">Try adjusting your filter criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-center font-bold text-slate-700">Teacher</th>
                  {isSuperAdmin && <th className="px-4 py-3 text-center font-bold text-slate-700">School</th>}
                  <th className="px-4 py-3 text-center font-bold text-slate-700">Month</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-700">Submitted On</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => (
                  <tr key={r.id || i} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-center font-medium">
                      {r.staffSalutation ? `${r.staffSalutation} ` : ""}{r.staffName || "Unknown"}
                    </td>
                    {isSuperAdmin && <td className="px-4 py-3 text-center text-slate-600">{r.institutionName || "—"}</td>}
                    <td className="px-4 py-3 text-center">
                      {MONTH_NAMES[(r.month || 1) - 1]} {r.year}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">
                      {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.adminApproval === "verified" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                          <ShieldCheck size={12} />
                          Verified
                        </span>
                      ) : r.adminApproval === "rejected" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-2 py-1 rounded-lg" title={r.adminComment || ""}>
                          <ShieldX size={12} />
                          Rejected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
                          <Clock size={12} />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => handleViewInApp(r)}
                          disabled={viewLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-semibold text-xs hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                          {viewLoading ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Eye size={14} />
                          )}
                          View
                        </button>
                        <button
                          onClick={() => handleViewInApp(r)}
                          disabled={viewLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 font-semibold text-xs hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          {viewLoading ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Download size={14} />
                          )}
                          PDF
                        </button>
                        <button
                          onClick={() => handleDownloadDocx(r.id)}
                          disabled={downloadingId === r.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-semibold text-xs hover:bg-emerald-100 transition-colors disabled:opacity-50"
                        >
                          {downloadingId === r.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Download size={14} />
                          )}
                          DOCX
                        </button>
                        {r.adminApproval !== "verified" && (
                          <button
                            onClick={() => handleApprove(r.id)}
                            disabled={approvingId === r.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-semibold text-xs hover:bg-emerald-100 transition-colors disabled:opacity-50"
                          >
                            {approvingId === r.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <ShieldCheck size={14} />
                            )}
                            Approve
                          </button>
                        )}
                        {r.adminApproval !== "rejected" && (
                          <button
                            onClick={() => handleRejectClick(r)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 font-semibold text-xs hover:bg-red-100 transition-colors"
                          >
                            <ShieldX size={14} />
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Report Preview Dialog */}
      <Dialog open={!!viewingSubmission} onOpenChange={(open) => { if (!open) setViewingSubmission(null); }}>
        <DialogContent className="sm:max-w-[90vw] max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold">
                {viewingSubmission?.staffName} — {viewingSubmission?.monthName} {viewingSubmission?.year}
              </DialogTitle>
            </div>
            <Button onClick={downloadPreviewPdf} size="sm" className="bg-red-600 hover:bg-red-700 text-white gap-1.5">
              <Download size={14} />
              Download PDF
            </Button>
          </DialogHeader>
          <div className="overflow-auto max-h-[calc(90vh-80px)] px-6 pb-6">
            {viewingSubmission && (
              <ReportPreview data={viewingSubmission.reportData} signatureUrl={viewingSubmission.signatureUrl} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => { if (!open) setRejectDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Report</DialogTitle>
            <DialogDescription>
              Provide feedback for the trainer on why this report is being rejected. This comment will be visible to the trainer in their submissions view.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={rejectDialog?.comment || ""}
              onChange={(e) => setRejectDialog((prev) => prev ? { ...prev, comment: e.target.value } : null)}
              placeholder="Enter rejection reason..."
              className="min-h-[100px] rounded-lg"
            />
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <DialogClose asChild>
              <Button variant="outline" size="sm">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleRejectConfirm}
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700 font-bold"
            >
              Reject Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── My Submissions View (teacher) ───

function PrincipalSignedUpload({ r, onRefresh }: { r: any; onRefresh: () => void }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const submittedAt = r.submittedAt;
  const daysSince = submittedAt ? (Date.now() - new Date(submittedAt).getTime()) / (1000 * 60 * 60 * 24) : Infinity;
  const canEdit = daysSince <= 10;
  const hasSigned = !!r.principalSignedKey;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { toast.error("Only PDF files are accepted"); return; }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("submissionId", r.id);
    setUploading(true);
    try {
      const res = await _axios.post("/admin/timetable/upload-principal-signed-report", formData);
      if (res.data?.success) { toast.success("Principal signed report uploaded"); onRefresh(); }
      else toast.error(res.data?.message || "Upload failed");
    } catch (err: any) { toast.error(err?.response?.data?.message || "Failed to upload"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="application/pdf" onChange={handleUpload} className="hidden" />
      {canEdit ? (
        hasSigned ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => window.open(`/admin/timetable/download-principal-signed-report?id=${r.id}`, "_blank")}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-50 text-violet-700 font-semibold text-[10px] hover:bg-violet-100 transition-colors"
            >
              <Download size={12} />
              Signed
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-50 text-violet-700 font-semibold text-[10px] hover:bg-violet-100 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-50 text-violet-700 font-semibold text-[10px] hover:bg-violet-100 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? "Uploading..." : "Signed PDF"}
          </button>
        )
      ) : (
        hasSigned ? (
          <button
            onClick={() => window.open(`/admin/timetable/download-principal-signed-report?id=${r.id}`, "_blank")}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-50 text-violet-700 font-semibold text-[10px] hover:bg-violet-100 transition-colors"
          >
            <Download size={12} />
            Signed
          </button>
        ) : (
          <span className="text-[10px] text-slate-400 italic">Expired</span>
        )
      )}
    </>
  );
}

function MySubmissionsView({ onView }: { onView: (id: string) => void }) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // View state
  const [viewingSubmission, setViewingSubmission] = useState<{
    reportData: ReportParams;
    signatureUrl: string | null;
    staffName: string;
    staffId: string | null;
    monthName: string;
    year: number;
    adminComment?: string;
  } | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewingRejectionComment, setViewingRejectionComment] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    _axios.get("/admin/timetable/my-submissions")
      .then((res) => {
        if (res.data?.success) {
          setSubmissions(res.data.data || []);
        }
      })
      .catch(() => {
        setSubmissions([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDownloadDocx = async (id: string) => {
    setDownloadingId(id);
    try {
      const res = await _axios.get(`/admin/timetable/download-submitted-report?id=${id}`, {
        responseType: "blob",
      });
      const docxBlob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const submissionItem = submissions.find((x) => x.id === id);
      const monthName = submissionItem ? MONTH_NAMES[(submissionItem.month || 1) - 1] : "Report";
      const year = submissionItem?.year || "";

      const url = window.URL.createObjectURL(docxBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Monthly_Report_${monthName}_${year}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      toast.success("Report downloaded as DOCX");
    } catch (err) {
      console.error(err);
      toast.error("Failed to download report");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleViewInApp = async (r: any) => {
    setViewLoading(true);
    try {
      const [dataRes, sigRes] = await Promise.all([
        _axios.get(`/admin/timetable/submission-data?id=${r.id}`),
        r.staffId
          ? _axios.get(`/admin/timetable/staff-signature?staffId=${r.staffId}`).catch(() => null)
          : Promise.resolve(null),
      ]);

      const reportData = dataRes.data?.data?.reportData as ReportParams | undefined;
      if (!reportData) {
        toast.error("No report data found");
        return;
      }

      let signatureUrl: string | null = null;
      const sigKey = sigRes?.data?.data?.signatureKey;
      if (sigKey) {
        signatureUrl = `${Config.proxyUrl}${encodeURIComponent(sigKey)}`;
      }

      const adminComment = dataRes.data?.data?.adminComment || r.adminComment || null;
      setViewingSubmission({
        reportData,
        signatureUrl,
        staffName: "My Report",
        staffId: r.staffId || null,
        monthName: MONTH_NAMES[(r.month || 1) - 1],
        year: r.year,
        adminComment,
      });
      setViewingRejectionComment(adminComment);
    } catch {
      toast.error("Failed to load report data");
    } finally {
      setViewLoading(false);
    }
  };

  const downloadPreviewPdf = useCallback(async () => {
    if (!viewingSubmission) return;
    try {
      const staffParam = viewingSubmission.staffId ? `?staffId=${viewingSubmission.staffId}` : "";
      const res = await _axios.post(
        `/admin/timetable/generate-report-pdf${staffParam}`,
        viewingSubmission.reportData,
        { responseType: "blob" },
      );
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Monthly_Report_${viewingSubmission.monthName}_${viewingSubmission.year}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      toast.success("PDF downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    }
  }, [viewingSubmission]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="neo-card rounded-2xl border border-slate-200/80 p-12 text-center">
        <Inbox className="h-12 w-12 text-slate-400 mx-auto mb-3" />
        <p className="text-slate-600 font-semibold text-lg">No submitted reports yet</p>
        <p className="text-muted-foreground text-sm mt-1">Generate a report and click "Submit Report" to see it here.</p>
      </div>
    );
  }

  return (
    <>
      <div className="neo-card rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 px-5 py-4">
          <h2 className="text-lg font-extrabold text-white tracking-wide">My Submissions</h2>
          <p className="text-sm text-white/80">{submissions.length} report{submissions.length !== 1 ? "s" : ""} submitted</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-center font-bold text-slate-700">Month</th>
                <th className="px-4 py-3 text-center font-bold text-slate-700">Submitted On</th>
                <th className="px-4 py-3 text-center font-bold text-slate-700">Status</th>
                <th className="px-4 py-3 text-center font-bold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((r, i) => (
                <tr key={r.id || i} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-center font-medium">
                    {MONTH_NAMES[(r.month || 1) - 1]} {r.year}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">
                    {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.adminApproval === "verified" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                        <ShieldCheck size={12} />
                        Verified
                      </span>
                    ) : r.adminApproval === "rejected" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-2 py-1 rounded-lg" title={r.adminComment || ""}>
                        <ShieldX size={12} />
                        Rejected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
                        <Clock size={12} />
                        Pending
                      </span>
                    )}
                    {r.adminApproval === "rejected" && r.adminComment && (
                      <div className="text-[10px] text-red-600 mt-1 max-w-[150px] leading-tight truncate" title={r.adminComment}>
                        {r.adminComment}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => r.adminApproval === "verified" ? handleViewInApp(r) : onView(r.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-semibold text-xs hover:bg-indigo-100 transition-colors"
                      >
                        <Eye size={14} />
                        {r.adminApproval === "verified" ? "View" : "View / Edit"}
                      </button>
                      <button
                        onClick={() => handleViewInApp(r)}
                        disabled={viewLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 font-semibold text-xs hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {viewLoading ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Download size={14} />
                        )}
                        PDF
                      </button>
                      <button
                        onClick={() => handleDownloadDocx(r.id)}
                        disabled={downloadingId === r.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-semibold text-xs hover:bg-emerald-100 transition-colors disabled:opacity-50"
                      >
                        {downloadingId === r.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Download size={14} />
                        )}
                        DOCX
                      </button>
                      {r.adminApproval === "verified" && (
                        <PrincipalSignedUpload r={r} onRefresh={() => { setLoading(true); _axios.get("/admin/timetable/my-submissions").then((res) => { if (res.data?.success) setSubmissions(res.data.data || []); }).catch(() => setSubmissions([])).finally(() => setLoading(false)); }} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Preview Dialog */}
      <Dialog open={!!viewingSubmission} onOpenChange={(open) => { if (!open) setViewingSubmission(null); }}>
        <DialogContent className="sm:max-w-[90vw] max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold">
                {viewingSubmission?.staffName} — {viewingSubmission?.monthName} {viewingSubmission?.year}
              </DialogTitle>
              {viewingRejectionComment && (
                <div className="flex items-start gap-1.5 mt-2 text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg max-w-lg">
                  <MessageSquare size={14} className="shrink-0 mt-0.5" />
                  <span>{viewingRejectionComment}</span>
                </div>
              )}
            </div>
            <Button onClick={downloadPreviewPdf} size="sm" className="bg-red-600 hover:bg-red-700 text-white gap-1.5">
              <Download size={14} />
              Download PDF
            </Button>
          </DialogHeader>
          <div className="overflow-auto max-h-[calc(90vh-80px)] px-6 pb-6">
            {viewingSubmission && (
              <ReportPreview data={viewingSubmission.reportData} signatureUrl={viewingSubmission.signatureUrl} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
