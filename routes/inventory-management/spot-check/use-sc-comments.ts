import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { httpClient } from "@/lib/http-client";
import { fetchAllComments } from "@/hooks/use-comment-crud";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type { CommentItem } from "@/components/ui/comment-sheet";

/* ── Spot Check Detail (per-item) comments ───────────────────────── */

export function useSpotCheckDetailComments(detailId: string | undefined) {
  const buCode = useBuCode();

  return useQuery<CommentItem[]>({
    queryKey: [QUERY_KEYS.SPOT_CHECK_DETAIL_COMMENTS, buCode, detailId],
    queryFn: async () => {
      if (!buCode || !detailId)
        throw new Error("Missing buCode or spot check detail id");
      return fetchAllComments(
        API_ENDPOINTS.SPOT_CHECK_DETAIL_COMMENT(buCode, detailId),
      );
    },
    enabled: !!buCode && !!detailId,
  });
}

export function useSaveSpotCheckDetailComment(detailId: string) {
  const buCode = useBuCode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      message: string;
      type: string;
      files: File[];
    }) => {
      if (!buCode) throw new Error("Missing business unit code");
      const formData = new FormData();
      formData.append("message", payload.message);
      formData.append("type", payload.type);
      for (const file of payload.files) {
        formData.append("files", file, file.name);
      }
      const res = await httpClient.post(
        API_ENDPOINTS.SPOT_CHECK_DETAIL_COMMENT(buCode, detailId),
        formData,
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to save spot check note");
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.SPOT_CHECK_DETAIL_COMMENTS, buCode, detailId],
      });
    },
  });
}

/* ── Spot Check (header level) comments ──────────────────────────── */

/* ── TODO (เมื่อต้องใช้) ──────────────────────────────────────────
 * - PATCH /spot-check-detail-comment/{id}      (update message + add/remove attachments)
 * - DELETE /spot-check-detail-comment/{id}     (delete comment)
 * - POST   /spot-check-detail-comment/{id}/attachment           (add attachments)
 * - DELETE /spot-check-detail-comment/{id}/attachment/{fileToken} (remove attachment)
 * (และ counterpart ของ spot-check-comment header level)
 */
