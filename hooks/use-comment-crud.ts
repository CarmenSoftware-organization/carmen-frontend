import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { httpClient } from "@/lib/http-client";
import { ApiError, ERROR_CODES } from "@/lib/api-error";
import { buildUrl } from "@/lib/build-query-string";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import type { CacheProfile } from "@/lib/cache-config";
import type {
  CommentAttachment,
  CommentItem,
} from "@/components/ui/comment-sheet";

/**
 * ดึง comment ของเอกสารหนึ่งใบให้ครบทุกหน้า
 *
 * endpoint comment ทุกตัวแบ่งหน้า (ไม่ส่ง perpage = 10) แต่แผง comment แสดงเป็นรายการ
 * เดียวไม่มีปุ่มหน้าถัดไป — อ่านแค่ `json.data` ของหน้าแรก = เอกสารที่มี comment เกิน 10
 * อันจะเห็นแค่ 10 อันล่าสุดโดยไม่มีอะไรบอกว่าขาด · `perpage=-1` โดน gateway ตอบ 400
 * จึงต้องวนหน้า (ทีละ 100 — ใบปกติจบในหน้าเดียว)
 */
export function fetchAllComments(url: string): Promise<CommentItem[]> {
  return fetchAllPages<CommentItem>(async (page, perpage) => {
    const res = await httpClient.get(buildUrl(url, { page, perpage }));
    if (!res.ok) throw await ApiError.from(res, "Failed to fetch comments");
    return res.json();
  });
}

interface CommentCrudOptions {
  queryKey: string;
  commentEndpoint: (buCode: string, entityId?: string) => string;
  idFieldName: string;
  label: string;
  cacheProfile?: CacheProfile;
}

export function createCommentCrud({
  queryKey,
  commentEndpoint,
  idFieldName,
  label,
  cacheProfile,
}: CommentCrudOptions) {
  function useComments(
    entityId: string | undefined,
  ): UseQueryResult<CommentItem[]> {
    const buCode = useBuCode();

    return useQuery<CommentItem[]>({
      queryKey: [queryKey, buCode, entityId],
      queryFn: async () => {
        if (!buCode || !entityId)
          throw new ApiError(
            ERROR_CODES.VALIDATION_ERROR,
            `Missing buCode or ${label} id`,
          );
        return fetchAllComments(commentEndpoint(buCode, entityId));
      },
      ...cacheProfile,
      enabled: !!buCode && !!entityId,
    });
  }

  function useCreate() {
    return useApiMutation<{
      [key: string]: unknown;
      message: string;
      type: string;
      files: File[];
    }>({
      mutationFn: (data, buCode) => {
        // multipart คำขอเดียว — ข้อความกับไฟล์ไปพร้อมกัน ไม่มีขั้นอัปโหลดแยก
        const formData = new FormData();
        formData.append("message", data.message);
        formData.append("type", data.type);
        for (const file of data.files) formData.append("files", file);
        const entityId = data[idFieldName] as string | undefined;
        return httpClient.post(commentEndpoint(buCode, entityId), formData);
      },
      invalidateKeys: [queryKey],
      errorMessage: "Failed to add comment",
    });
  }

  function useUpdate() {
    return useApiMutation<{
      id: string;
      message: string;
      attachments: CommentAttachment[];
      [key: string]: unknown;
    }>({
      mutationFn: ({ id, ...data }, buCode) => {
        const entityId = data[idFieldName] as string | undefined;
        return httpClient.patch(
          `${commentEndpoint(buCode, entityId)}/${id}`,
          data,
        );
      },
      invalidateKeys: [queryKey],
      errorMessage: "Failed to update comment",
    });
  }

  function useDelete() {
    return useApiMutation<string | { id: string; entityId?: string }>({
      mutationFn: (payload, buCode) => {
        const id = typeof payload === "string" ? payload : payload.id;
        const entityId =
          typeof payload === "string" ? undefined : payload.entityId;
        return httpClient.delete(`${commentEndpoint(buCode, entityId)}/${id}`);
      },
      invalidateKeys: [queryKey],
      errorMessage: "Failed to delete comment",
    });
  }

  return {
    useComments,
    useCreate,
    useUpdate,
    useDelete,
    idFieldName,
  };
}
