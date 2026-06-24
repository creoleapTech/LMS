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
  const [reportData, setReportData] = useState<ReportParams | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<{ submitted: boolean; submittedAt?: string; submissionId?: string } | null>(null);

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
      if (!data.sessionColumns) data.sessionColumns = ["Date", "Class/Section", "Chapter Name", "Topic Name", "Remarks"];
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
        setSubmissionStatus({ submitted: true, submittedAt: res.data.data?.submittedAt, submissionId: res.data.data?.id });
      } else {
        throw new Error("Submit failed");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to submit report";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
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
          setSubmissionStatus({ submitted: true, submittedAt: sub.submittedAt, submissionId: sub.id });
        } else {
          setSubmissionStatus({ submitted: false });
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
          setSubmissionStatus({ submitted: true, submittedAt: res.data.data.submittedAt, submissionId });
        }
      }
    } catch {
      toast.error("Failed to load submission data");
    }
  }, []);

  return {
    isGenerating,
    isDownloading,
    isSubmitting,
    reportData,
    signatureUrl,
    submissionStatus,
    generateReport,
    downloadDocx,
    uploadSignature,
    fetchSignature,
    fetchStaffSignature,
    submitReport,
    checkSubmissionStatus,
    loadSubmissionData,
    updateField,
    updateRow,
    addRow,
    removeRow,
    updateSessionColumn,
    addBodyItem,
    updateBodyItem,
    removeBodyItem,
    clearReport,
  };
}
