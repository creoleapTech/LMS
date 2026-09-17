import { useState, useCallback } from "react";
import { _axios } from "@/lib/axios";
import { Config } from "@/lib/config";
import { toast } from "sonner";

export interface ReportRow {
  date: string;
  className: string;
  section: string;
  chapterName: string;
  topicName: string;
  remarks: string;
}

export interface ReportTable {
  title: string;
  columns: string[];
  rows: string[][];
}

export interface ContentBlock {
  type: "heading" | "paragraph";
  text: string;
  format?: "plain" | "bullet" | "number";
  bold?: boolean;
}

export type BodyItem =
  | { kind: "table"; table: ReportTable; keepOnSamePage?: boolean }
  | { kind: "content"; content: ContentBlock; keepOnSamePage?: boolean };

export interface ReportParams {
  monthName: string;
  year: number;
  staffNames: string[];
  schoolName: string;
  classesLabel: string;
  subjectLabel: string;
  sessionsPlanned: number;
  sessionsCompleted: number;
  rows: ReportRow[];
  sessionColumns?: string[];
  bodyItems?: BodyItem[];
  submittedOn?: string;
  staffId?: string | null;
}

export function useReportEditor() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [reportData, setReportData] = useState<ReportParams | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<{ submitted: boolean; submittedAt?: string; submissionId?: string; hasDraft?: boolean; draftId?: string; adminApproval?: string; adminComment?: string; principalSignedKey?: string; principalSignedAt?: string } | null>(null);

  const generateReport = useCallback(async (params: {
    year: number;
    month: number;
    staffId?: string | null;
    institutionId?: string | null;
  }) => {
    setIsGenerating(true);
    try {
      const isAdminView = !!params.staffId && !!params.institutionId;
      const url = isAdminView
        ? `/admin/timetable/staff-monthly-report-data?staffId=${params.staffId}&institutionId=${params.institutionId}&year=${params.year}&month=${params.month}`
        : `/admin/timetable/my-monthly-report-data?year=${params.year}&month=${params.month}${params.institutionId ? `&institutionId=${params.institutionId}` : ""}`;

      const response = await _axios.get(url);
      const data = response.data?.data as ReportParams;
      if (!data) throw new Error("No report data returned");
      if (!data.sessionColumns) data.sessionColumns = ["Date", "Class", "Chapter", "Topic", "Remarks"];
      if (!data.bodyItems) data.bodyItems = [];
      data.staffId = params.staffId || null;
      setReportData(data);
      toast.success("Report generated successfully");
    } catch {
      toast.error("Failed to generate report");
      setReportData(null);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const downloadDocx = useCallback(async (data: ReportParams) => {
    setIsDownloading(true);
    try {
      const response = await _axios.post(
        "/admin/timetable/generate-report-docx",
        data,
        { responseType: "blob" },
      );

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Monthly_Report_${data.monthName}_${data.year}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);

      toast.success("Report downloaded successfully");
    } catch {
      toast.error("Failed to download report");
    } finally {
      setIsDownloading(false);
    }
  }, []);

  const updateField = useCallback(<K extends keyof ReportParams>(field: K, value: ReportParams[K]) => {
    setReportData((prev) => prev ? { ...prev, [field]: value } : prev);
  }, []);

  const updateRow = useCallback((index: number, field: keyof ReportRow, value: string) => {
    setReportData((prev) => {
      if (!prev) return prev;
      const rows = [...prev.rows];
      rows[index] = { ...rows[index], [field]: value };
      return { ...prev, rows };
    });
  }, []);

  const addRow = useCallback(() => {
    setReportData((prev) => {
      if (!prev) return prev;
      const newRow: ReportRow = {
        date: "",
        className: "",
        section: "",
        chapterName: "",
        topicName: "",
        remarks: "",
      };
      return { ...prev, rows: [...prev.rows, newRow] };
    });
  }, []);

  const removeRow = useCallback((index: number) => {
    setReportData((prev) => {
      if (!prev) return prev;
      const rows = prev.rows.filter((_, i) => i !== index);
      return { ...prev, rows };
    });
  }, []);

  const insertRowBelow = useCallback((index: number) => {
    setReportData((prev) => {
      if (!prev) return prev;
      const newRow: ReportRow = {
        date: "",
        className: "",
        section: "",
        chapterName: "",
        topicName: "",
        remarks: "",
      };
      const rows = [...prev.rows];
      rows.splice(index + 1, 0, newRow);
      return { ...prev, rows };
    });
  }, []);

  const moveRow = useCallback((fromIndex: number, toIndex: number) => {
    setReportData((prev) => {
      if (!prev) return prev;
      if (fromIndex === toIndex) return prev;
      if (fromIndex < 0 || fromIndex >= prev.rows.length) return prev;
      if (toIndex < 0 || toIndex >= prev.rows.length) return prev;
      const rows = [...prev.rows];
      const [moved] = rows.splice(fromIndex, 1);
      rows.splice(toIndex, 0, moved);
      return { ...prev, rows };
    });
  }, []);

  const updateSessionColumn = useCallback((index: number, value: string) => {
    setReportData((prev) => {
      if (!prev || !prev.sessionColumns) return prev;
      const cols = [...prev.sessionColumns];
      cols[index] = value;
      return { ...prev, sessionColumns: cols };
    });
  }, []);

  const addBodyItem = useCallback((item: BodyItem) => {
    setReportData((prev) => {
      if (!prev) return prev;
      return { ...prev, bodyItems: [...(prev.bodyItems || []), item] };
    });
  }, []);

  const updateBodyItem = useCallback((index: number, item: BodyItem) => {
    setReportData((prev) => {
      if (!prev || !prev.bodyItems) return prev;
      const items = [...prev.bodyItems];
      items[index] = item;
      return { ...prev, bodyItems: items };
    });
  }, []);

  const removeBodyItem = useCallback((index: number) => {
    setReportData((prev) => {
      if (!prev || !prev.bodyItems) return prev;
      const items = prev.bodyItems.filter((_, i) => i !== index);
      return { ...prev, bodyItems: items };
    });
  }, []);

  const moveBodyItem = useCallback((fromIndex: number, toIndex: number) => {
    setReportData((prev) => {
      if (!prev || !prev.bodyItems) return prev;
      const items = [...prev.bodyItems];
      const [moved] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, moved);
      return { ...prev, bodyItems: items };
    });
  }, []);

  const clearReport = useCallback(() => {
    setReportData(null);
    setSubmissionStatus(null);
  }, []);

  const uploadSignature = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("signature", file);
    const res = await _axios.post("/admin/timetable/signature", formData);
    if (res.data?.success) {
      const key = res.data.data.signatureKey;
      setSignatureUrl(key ? `${Config.proxyUrl}${encodeURIComponent(key)}` : null);
      toast.success("Signature uploaded successfully");
    } else {
      throw new Error("Upload failed");
    }
  }, []);

  const fetchSignature = useCallback(async () => {
    try {
      const res = await _axios.get("/admin/timetable/signature");
      if (res.data?.success) {
        const key = res.data.data?.signatureKey;
        setSignatureUrl(key ? `${Config.proxyUrl}${encodeURIComponent(key)}` : null);
      }
    } catch {
      // silent fail
    }
  }, []);

  const fetchStaffSignature = useCallback(async (staffId?: string | null) => {
    if (!staffId) {
      setSignatureUrl(null);
      return;
    }

    try {
      const res = await _axios.get(`/admin/timetable/staff-signature?staffId=${staffId}`);
      if (res.data?.success) {
        const key = res.data.data?.signatureKey;
        setSignatureUrl(key ? `${Config.proxyUrl}${encodeURIComponent(key)}` : null);
      }
    } catch {
      setSignatureUrl(null);
    }
  }, []);

  const submitReport = useCallback(async (data: ReportParams) => {
    setIsSubmitting(true);
    try {
      const res = await _axios.post("/admin/timetable/submit-report", data);
      if (res.data?.success) {
        toast.success("Report submitted successfully");
        setSubmissionStatus({ submitted: true, submittedAt: res.data.data?.submittedAt, submissionId: res.data.data?.id, adminApproval: "pending", adminComment: undefined });
      } else {
        throw new Error("Submit failed");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to submit report";
      toast.error(msg);
      // Network-cut safety: submit may have succeeded server-side while the
      // response never reached us. Re-read server truth so a later Save Draft
      // doesn't silently recall submitted->draft on stale client state.
      try {
        const monthNum =
          ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(data.monthName) + 1;
        if (data.year && monthNum) {
          const st = await _axios.get(`/admin/timetable/report-submission?year=${data.year}&month=${monthNum}`);
          const sub = st.data?.data;
          if (sub?.status && sub.status !== "draft") {
            setSubmissionStatus({ submitted: true, submittedAt: sub.submittedAt, submissionId: sub.id, hasDraft: false, adminApproval: sub.adminApproval, adminComment: sub.adminComment, principalSignedKey: sub.principalSignedKey, principalSignedAt: sub.principalSignedAt });
          }
        }
      } catch {
        // ignore refresh failure, original error toast already shown
      }
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const saveDraft = useCallback(async (data: ReportParams, opts?: { forceRecall?: boolean; staffId?: string | null; institutionId?: string | null; successMessage?: string }) => {
    setIsSavingDraft(true);
    try {
      const payload: ReportParams & { forceRecall?: boolean; institutionId?: string | null } =
        opts?.forceRecall ? { ...data, forceRecall: true } : { ...data };
      if (opts?.staffId) payload.staffId = opts.staffId;
      if (opts?.institutionId) payload.institutionId = opts.institutionId;
      const res = await _axios.post("/admin/timetable/save-report-draft", payload);
      if (res.data?.success) {
        toast.success(opts?.successMessage || "Draft saved successfully");
        setSubmissionStatus((prev) => ({ ...prev, submitted: false, hasDraft: true, draftId: res.data.data?.id }));
      } else {
        throw new Error("Save draft failed");
      }
    } catch (err: any) {
      // 409 = server already has this month as submitted (e.g. submit succeeded
      // but client saw a network cut). Don't overwrite — refresh to submitted truth.
      if (err?.response?.status === 409) {
        toast.warning("Already submitted — showing submitted state instead of overwriting with a draft.");
        try {
          const monthNum =
            ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(data.monthName) + 1;
          if (data.year && monthNum) {
            const st = await _axios.get(`/admin/timetable/report-submission?year=${data.year}&month=${monthNum}${opts?.staffId ? `&staffId=${opts.staffId}` : ""}`);
            const sub = st.data?.data;
            if (sub) {
              if (sub.status === "draft") {
                setSubmissionStatus({ submitted: false, hasDraft: true, draftId: sub.id });
              } else {
                setSubmissionStatus({ submitted: true, submittedAt: sub.submittedAt, submissionId: sub.id, hasDraft: false, adminApproval: sub.adminApproval, adminComment: sub.adminComment, principalSignedKey: sub.principalSignedKey, principalSignedAt: sub.principalSignedAt });
              }
              return;
            }
          }
        } catch {
          // fall through to generic message below
        }
      }
      const msg = err?.response?.data?.message || "Failed to save draft";
      toast.error(msg);
    } finally {
      setIsSavingDraft(false);
    }
  }, []);

  const checkSubmissionStatus = useCallback(async (params: {
    year: number;
    month: number;
    staffId?: string | null;
  }) => {
    try {
      const url = `/admin/timetable/report-submission?year=${params.year}&month=${params.month}${params.staffId ? `&staffId=${params.staffId}` : ""}`;
      const res = await _axios.get(url);
      if (res.data?.success) {
        const sub = res.data.data;
        if (sub) {
          if (sub.status === "draft") {
            setSubmissionStatus({ submitted: false, hasDraft: true, draftId: sub.id });
          } else {
            setSubmissionStatus({ submitted: true, submittedAt: sub.submittedAt, submissionId: sub.id, hasDraft: false, adminApproval: sub.adminApproval, adminComment: sub.adminComment, principalSignedKey: sub.principalSignedKey, principalSignedAt: sub.principalSignedAt });
          }
        } else {
          setSubmissionStatus({ submitted: false, hasDraft: false });
        }
      }
    } catch {
      setSubmissionStatus(null);
    }
  }, []);

  const loadSubmissionData = useCallback(async (submissionId: string) => {
    try {
      const res = await _axios.get(`/admin/timetable/submission-data?id=${submissionId}`);
      if (res.data?.success) {
        const rd = res.data.data.reportData;
        if (rd && typeof rd === "object") {
          setReportData(rd as ReportParams);
          setSubmissionStatus({ submitted: true, submittedAt: res.data.data.submittedAt, submissionId, adminApproval: res.data.data.adminApproval, adminComment: res.data.data.adminComment, principalSignedKey: res.data.data.principalSignedKey, principalSignedAt: res.data.data.principalSignedAt });
        }
      }
    } catch {
      toast.error("Failed to load submission data");
    }
  }, []);

  const loadDraftData = useCallback(async (draftId: string) => {
    try {
      const res = await _axios.get(`/admin/timetable/submission-data?id=${draftId}`);
      if (res.data?.success) {
        const rd = res.data.data.reportData;
        if (rd && typeof rd === "object") {
          setReportData(rd as ReportParams);
          setSubmissionStatus({ submitted: false, hasDraft: true, draftId });
        }
      }
    } catch {
      toast.error("Failed to load draft data");
    }
  }, []);

  return {
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
    fetchStaffSignature,
    submitReport,
    saveDraft,
    checkSubmissionStatus,
    loadSubmissionData,
    loadDraftData,
    updateField,
    updateRow,
    addRow,
    removeRow,
    insertRowBelow,
    moveRow,
    updateSessionColumn,
    addBodyItem,
    updateBodyItem,
    removeBodyItem,
    moveBodyItem,
    clearReport,
  };
}
