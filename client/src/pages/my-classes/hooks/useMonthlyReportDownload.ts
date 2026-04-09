import { useState } from "react";
import { _axios } from "@/lib/axios";
import { toast } from "sonner";

export function useMonthlyReportDownload() {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadReport = async (params: {
    year: number;
    month: number;
    staffId?: string | null;
    institutionId?: string | null;
  }) => {
    setIsDownloading(true);
    try {
      const isAdminView = !!params.staffId && !!params.institutionId;
      const url = isAdminView
        ? `/admin/timetable/staff-monthly-report?staffId=${params.staffId}&institutionId=${params.institutionId}&year=${params.year}&month=${params.month}`
        : `/admin/timetable/my-monthly-report?year=${params.year}&month=${params.month}`;

      const response = await _axios.get(url, { responseType: "blob" });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", `Monthly_Report_${params.year}_${params.month}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);

      toast.success("Report downloaded successfully");
    } catch {
      toast.error("Failed to download report");
    } finally {
      setIsDownloading(false);
    }
  };

  return { downloadReport, isDownloading };
}
