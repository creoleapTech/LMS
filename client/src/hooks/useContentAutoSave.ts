import { useCallback, useEffect, useRef } from "react";
import { _axios } from "@/lib/axios";

const DEBOUNCE_MS = 5000;

export function useContentAutoSave(
  classId: string,
  gradeBookId: string,
  contentId: string | undefined
) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedRef = useRef<string>("");
  const pendingDataRef = useRef<any>(null);

  const save = useCallback(
    (data: { videoTimestamp?: number; pdfPage?: number }) => {
      if (!contentId || !classId || !gradeBookId) return;

      const key = JSON.stringify(data);
      if (key === lastSavedRef.current) return;

      pendingDataRef.current = data;

      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await _axios.put(
            `/admin/teaching-progress/${classId}/${gradeBookId}/content/${contentId}`,
            data
          );
          lastSavedRef.current = key;
          pendingDataRef.current = null;
        } catch (e) {
          console.error("Auto-save failed:", e);
        }
      }, DEBOUNCE_MS);
    },
    [classId, gradeBookId, contentId]
  );

  // Flush on unmount or contentId change
  useEffect(() => {
    return () => {
      clearTimeout(saveTimerRef.current);
      if (pendingDataRef.current && contentId && classId && gradeBookId) {
        const url = `/api/admin/teaching-progress/${classId}/${gradeBookId}/content/${contentId}`;
        const data = JSON.stringify(pendingDataRef.current);
        // Use sendBeacon for reliable delivery on unmount
        try {
          const blob = new Blob([data], { type: "application/json" });
          const baseUrl = _axios.defaults.baseURL?.replace(/\/api$/, "") || "http://localhost:4000";
          const token = localStorage.getItem("user-auth-storage");
          let authToken = "";
          if (token) {
            try {
              const parsed = JSON.parse(token);
              authToken = parsed?.state?.user?.token || "";
            } catch {}
          }
          // sendBeacon can't set headers, so fall back to sync fetch
          fetch(`${baseUrl}${url}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: data,
            keepalive: true,
          }).catch(() => {});
        } catch {}
        pendingDataRef.current = null;
      }
      lastSavedRef.current = "";
    };
  }, [classId, gradeBookId, contentId]);

  return { save };
}
