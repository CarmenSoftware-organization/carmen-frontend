import { useInfiniteQuery } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { httpClient } from "@/lib/http-client";
import { ApiError, ERROR_CODES } from "@/lib/api-error";
import { buildUrl } from "@/lib/build-query-string";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { CACHE_DYNAMIC } from "@/lib/cache-config";
import type { PaginatedResponse } from "@/types/params";
import type {
  ReviewDocument,
  ReviewGroupCounts,
  ReviewGroupFilter,
  ReviewTransactionKey,
} from "@/types/period-end";

// เพดานฝั่ง backend คือ 100 (เกินแล้ว 400) — ส่งค่านี้ทุกครั้งแทนพึ่ง default
export const REVIEW_DOCUMENTS_PERPAGE = 50;

export type ReviewDocumentsPage = PaginatedResponse<ReviewDocument> & {
  summary: ReviewGroupCounts;
};

/**
 * เอกสารของโมดูลหนึ่งใน review แบบโหลดทีละหน้า กรองตามกลุ่มสถานะ
 *
 * queryKey ขึ้นต้นเหมือน `usePeriodEndReview` เพื่อให้ invalidate ทีเดียวล้างทั้งคู่
 * `summary` ของทุกหน้าเป็นตัวเลขกลุ่มรวมของโมดูล (ไม่ขึ้นกับ filter) อ่านจากหน้าแรกพอ
 */
export function useReviewDocuments(
  module: ReviewTransactionKey | null,
  group: ReviewGroupFilter,
  enabled: boolean,
) {
  const buCode = useBuCode();

  return useInfiniteQuery<ReviewDocumentsPage, ApiError>({
    queryKey: [
      QUERY_KEYS.PERIOD_ENDS,
      buCode,
      "review",
      module,
      "documents",
      group,
    ],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      if (!buCode || !module)
        throw new ApiError(
          ERROR_CODES.VALIDATION_ERROR,
          "Missing buCode or module",
        );
      const res = await httpClient.get(
        buildUrl(API_ENDPOINTS.PERIOD_END_REVIEW_DOCUMENTS(buCode, module), {
          group,
          page: pageParam as number,
          perpage: REVIEW_DOCUMENTS_PERPAGE,
        }),
      );
      if (!res.ok)
        throw await ApiError.from(res, "Failed to fetch review documents");
      return res.json();
    },
    getNextPageParam: (last) =>
      last?.paginate && last.paginate.page < last.paginate.pages
        ? last.paginate.page + 1
        : undefined,
    ...CACHE_DYNAMIC,
    enabled: enabled && !!module && !!buCode,
  });
}
