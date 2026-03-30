import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { useMemo } from "react";

export interface ContentProgressEntry {
  contentId: string;
  chapterId: string;
  isCompleted: boolean;
  completedAt?: string;
  videoTimestamp?: number;
  pdfPage?: number;
  lastAccessedAt: string;
}

interface TeachingProgressData {
  overallPercentage: number;
  lastAccessedContentId: string | null;
  contentProgress: ContentProgressEntry[];
}

export function useTeachingProgress(classId: string, gradeBookId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["teaching-progress", classId, gradeBookId];

  const progressQuery = useQuery<TeachingProgressData>({
    queryKey,
    queryFn: async () => {
      const res = await _axios.get(
        `/admin/teaching-progress/${classId}/${gradeBookId}`
      );
      return res.data.data;
    },
    enabled: !!classId && !!gradeBookId,
    staleTime: 30000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      contentId,
      data,
    }: {
      contentId: string;
      data: { isCompleted?: boolean; videoTimestamp?: number; pdfPage?: number };
    }) => {
      const res = await _axios.put(
        `/admin/teaching-progress/${classId}/${gradeBookId}/content/${contentId}`,
        data
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (contentId: string) => {
      const res = await _axios.post(
        `/admin/teaching-progress/${classId}/${gradeBookId}/content/${contentId}/complete`
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const completedContentIds = useMemo(() => {
    const set = new Set<string>();
    if (progressQuery.data?.contentProgress) {
      for (const p of progressQuery.data.contentProgress) {
        if (p.isCompleted) set.add(p.contentId);
      }
    }
    return set;
  }, [progressQuery.data]);

  const progressByContentId = useMemo(() => {
    const map = new Map<string, ContentProgressEntry>();
    if (progressQuery.data?.contentProgress) {
      for (const p of progressQuery.data.contentProgress) {
        map.set(p.contentId, p);
      }
    }
    return map;
  }, [progressQuery.data]);

  return {
    progressQuery,
    updateMutation,
    completeMutation,
    completedContentIds,
    progressByContentId,
    lastAccessedContentId: progressQuery.data?.lastAccessedContentId || null,
    overallPercentage: progressQuery.data?.overallPercentage || 0,
  };
}
