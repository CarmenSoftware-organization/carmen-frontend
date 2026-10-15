import { useInfiniteQuery } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { httpClient } from "@/lib/http-client";
import { ApiError, ERROR_CODES } from "@/lib/api-error";
import { buildUrl } from "@/lib/build-query-string";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import type { CacheProfile } from "@/lib/cache-config";
import type { PaginatedResponse } from "@/types/params";
import type {
  CommentAttachment,
  CommentItem,
} from "@/components/ui/comment-sheet";

/**
 * ดึง comment ของเอกสารหนึ่งใบให้ครบทุกหน้า — ใช้กับ notes dialog รายบรรทัด
 * (spot-check / physical-count) ที่ไม่มี lazy load · แผง comment ของเอกสารใช้
 * `createCommentCrud().useComments` ที่โหลดทีละหน้าแทน
 *
 * endpoint comment ทุกตัวแบ่งหน้า (ไม่ส่ง perpage = 10) — อ่านแค่ `json.data` ของหน้าแรก
 * = เห็นแค่ 10 อันล่าสุดโดยไม่มีอะไรบอกว่าขาด · `perpage=-1` โดน gateway ตอบ 400
 * จึงต้องวนหน้า (ทีละ 100 — ใบปกติจบในหน้าเดียว)
 */
export function fetchAllComments(url: string): Promise<CommentItem[]> {
  return fetchAllPages<CommentItem>(async (page, perpage) => {
    const res = await httpClient.get(buildUrl(url, { page, perpage }));
    if (!res.ok) throw await ApiError.from(res, "Failed to fetch comments");
    return res.json();
  });
}

/** จำนวน comment ต่อหน้าของแผง — พอเต็มจอหนึ่งรอบ ที่เหลือโหลดตอนเลื่อนถึงท้าย */
const COMMENT_PAGE_SIZE = 20;

/**
 * ใหม่ → เก่า ส่งไปให้ชัด — backend ทุกตัวเรียงแบบนี้เป็นค่าเริ่มต้นอยู่แล้ว (บางตัวผ่าน
 * `withDefaultSort` บางตัวเป็น fallback ของ orderBy) แต่ lazy load พังทันทีถ้าลำดับ
 * ไม่นิ่งระหว่างหน้า จึงไม่ฝากความถูกต้องไว้กับค่าเริ่มต้นของ service ที่อาจถูกแก้ทีหลัง
 */
const COMMENT_SORT = "created_at:desc";

export interface CommentListResult {
  /** comment ที่โหลดมาแล้วทุกหน้า เรียงใหม่ → เก่า */
  comments: CommentItem[];
  /** จำนวนทั้งหมดตาม backend — ไม่ใช่จำนวนที่โหลดมาแล้ว */
  total: number;
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
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
  /**
   * comment ของเอกสารหนึ่งใบแบบโหลดทีละหน้า (ใหม่ → เก่า)
   *
   * หัวเอกสารกับแผง comment เรียก hook นี้ด้วย key เดียวกัน จึงแชร์ cache — หัวเอกสาร
   * ใช้แค่ `total` (หน้าแรกพอ) ส่วนแผงเรียก `fetchNextPage` ตอนเลื่อนถึงท้าย
   * mutation ทุกตัว invalidate key นี้ → refetch ทุกหน้าที่โหลดไว้ ลำดับหลังเพิ่ม/ลบจึงยังถูก
   */
  function useComments(entityId: string | undefined): CommentListResult {
    const buCode = useBuCode();

    const query = useInfiniteQuery<PaginatedResponse<CommentItem>, ApiError>({
      queryKey: [queryKey, buCode, entityId],
      initialPageParam: 1,
      queryFn: async ({ pageParam }) => {
        if (!buCode || !entityId)
          throw new ApiError(
            ERROR_CODES.VALIDATION_ERROR,
            `Missing buCode or ${label} id`,
          );
        const res = await httpClient.get(
          buildUrl(commentEndpoint(buCode, entityId), {
            page: pageParam as number,
            perpage: COMMENT_PAGE_SIZE,
            sort: COMMENT_SORT,
          }),
        );
        if (!res.ok) throw await ApiError.from(res, "Failed to fetch comments");
        return res.json();
      },
      getNextPageParam: (last) =>
        last?.paginate && last.paginate.page < last.paginate.pages
          ? last.paginate.page + 1
          : undefined,
      ...cacheProfile,
      enabled: !!buCode && !!entityId,
    });

    const pages = query.data?.pages ?? [];
    return {
      comments: pages.flatMap((p) => (Array.isArray(p?.data) ? p.data : [])),
      total: pages[0]?.paginate?.total ?? 0,
      isLoading: query.isLoading,
      hasNextPage: query.hasNextPage,
      isFetchingNextPage: query.isFetchingNextPage,
      fetchNextPage: () => void query.fetchNextPage(),
    };
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
