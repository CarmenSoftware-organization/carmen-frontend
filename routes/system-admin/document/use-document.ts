import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { httpClient } from "@/lib/http-client";
import { buildUrl } from "@/lib/build-query-string";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { ApiError } from "@/lib/api-error";
import type {
  BulkDeleteDryRunResult,
  BulkDeleteResult,
  BulkDeleteVariables,
  DocumentListParams,
  DocumentListResponse,
  DocumentSummary,
} from "@/types/document";
import { CACHE_DYNAMIC } from "@/lib/cache-config";

/**
 * Hook ดึงรายการไฟล์เอกสารแบบแบ่งหน้าตาม buCode
 * ใช้ CACHE_DYNAMIC (staleTime 1 นาที) เพราะไฟล์อัปโหลด/ลบบ่อย
 * จะไม่ fetch ถ้า buCode ยังไม่พร้อม
 * @param params - พารามิเตอร์ pagination/filter/search
 * @param options - ตัวเลือก enabled เพื่อควบคุมการ fetch
 * @returns UseQueryResult ของ DocumentListResponse (paginate.total_size = ขนาดรวมของทุกแถวที่ตรงตัวกรอง)
 * @example
 * const { data } = useDocument({ page: 1, perpage: 20 });
 */
export function useDocument(
  params?: DocumentListParams,
  options?: { enabled?: boolean },
) {
  const buCode = useBuCode();

  return useQuery<DocumentListResponse>({
    queryKey: [QUERY_KEYS.DOCUMENTS, buCode, params],
    queryFn: async () => {
      if (!buCode) throw new Error("Missing buCode");
      const url = buildUrl(API_ENDPOINTS.DOCUMENTS(buCode), params);
      const res = await httpClient.get(url);
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
    ...CACHE_DYNAMIC,
    enabled: !!buCode && (options?.enabled ?? true),
  });
}

/** จำนวนไฟล์ต่อรอบที่เลื่อนถึงท้าย */
export const DOCUMENT_PAGE_SIZE = 30;

/**
 * รายการไฟล์แบบ lazy load (โหลดเพิ่มทีละ DOCUMENT_PAGE_SIZE เมื่อเลื่อนถึงท้าย)
 *
 * ใช้ useInfiniteQuery แทน useGridPagination โดยตั้งใจ: ตัวนั้นต่อหน้าเข้า state เองและกันซ้ำ
 * ด้วย `id` ซึ่ง DocumentFile ไม่มี — ลบไฟล์แล้ว invalidate หน้าเดิมจะถูกต่อท้ายซ้ำ และแถวที่ลบ
 * ค้างอยู่ ส่วน useInfiniteQuery refetch ทุกหน้าที่โหลดไว้ใหม่ทั้งชุดเมื่อ invalidate
 * key ขึ้นต้น QUERY_KEYS.DOCUMENTS → mutation เดิมทั้งหมด (upload/delete/bulk) invalidate ถึง
 *
 * @param params - ตัวกรอง/ค้นหา (page/perpage ถูกแทนด้วยค่าของ hook)
 */
export function useDocumentInfinite(params: DocumentListParams) {
  const buCode = useBuCode();
  const { page: _page, perpage: _perpage, ...filters } = params;

  return useInfiniteQuery<DocumentListResponse>({
    queryKey: [QUERY_KEYS.DOCUMENTS, buCode, "infinite", filters],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      if (!buCode) throw new Error("Missing buCode");
      const url = buildUrl(API_ENDPOINTS.DOCUMENTS(buCode), {
        ...filters,
        page: pageParam as number,
        perpage: DOCUMENT_PAGE_SIZE,
      });
      const res = await httpClient.get(url);
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
    getNextPageParam: (last) => {
      const { page, pages } = last.paginate ?? { page: 1, pages: 1 };
      return page < pages ? page + 1 : undefined;
    },
    ...CACHE_DYNAMIC,
    enabled: !!buCode,
  });
}

/**
 * Hook สำหรับอัปโหลดไฟล์เอกสารผ่าน multipart/form-data
 * ใช้ fetch โดยตรงเพราะต้อง bypass http-client JSON serializer
 * หลัง success จะ invalidate QUERY_KEYS.DOCUMENTS เพื่อ refresh รายการ
 * @returns UseMutationResult รับ File
 * @example
 * const upload = useUploadDocument();
 * upload.mutate(fileInput.files[0]);
 */
export function useUploadDocument() {
  const buCode = useBuCode();
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, File>({
    mutationFn: async (file) => {
      if (!buCode) throw new Error("Missing buCode");
      const formData = new FormData();
      formData.append("file", file);
      const res = await httpClient.post(
        `${API_ENDPOINTS.DOCUMENTS(buCode)}/upload`,
        formData,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to upload document");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DOCUMENTS] });
    },
  });
}

/**
 * Hook สำหรับลบไฟล์เอกสารตาม fileToken (รองรับ token ที่มี buCode prefix เช่น "T02/uuid")
 * จะ strip prefix ออกก่อนส่ง request เพราะ endpoint มี buCode อยู่แล้ว
 * @returns UseMutationResult รับ fileToken (string)
 * @example
 * const del = useDeleteDocument();
 * del.mutate("T02/abc-123");
 */
export function useDeleteDocument() {
  const buCode = useBuCode();

  return useApiMutation<string>({
    mutationFn: (fileToken) => {
      // fileToken อาจมี buCode prefix เช่น "T02/uuid" — ตัดออกเพราะ endpoint มี buCode อยู่แล้ว
      const id = fileToken.includes("/")
        ? fileToken.split("/").pop()!
        : fileToken;
      return httpClient.delete(`${API_ENDPOINTS.DOCUMENTS(buCode!)}/${id}`);
    },
    invalidateKeys: [QUERY_KEYS.DOCUMENTS],
    errorMessage: "Failed to delete document",
  });
}

/** server รับ file_tokens ได้ไม่เกิน 100 ต่อคำขอ */
const BULK_DELETE_TOKEN_CHUNK = 100;

/**
 * Hook ลบหลายไฟล์ — เลือกเป็นรายการ (file_tokens) หรือตามตัวกรอง (filter + expected_count)
 *
 * โหมดตัวกรอง server resolve เอง และบังคับ `expected_count` (ไม่ตรง → 409
 * DOCUMENT_BULK_DELETE_COUNT_CHANGED, เกินเพดาน → 422 DOCUMENT_BULK_DELETE_TOO_MANY)
 * โหมด token ตัดเป็นก้อนละ 100 แล้วรวมผล — ถ้าก้อนหลังพัง ก้อนก่อนหน้าลบไปแล้ว จึง invalidate
 * ทุกกรณี (onSettled) ไม่ใช่เฉพาะ success
 *
 * ไม่ผ่าน toast กลาง (skipGlobalErrorToast): dialog แสดง 409/422 เองโดยไม่ปิด
 * invalidate QUERY_KEYS.DOCUMENTS ซึ่งรวมยอดสรุป (key ขึ้นต้นเหมือนกัน) ด้วย
 * @returns UseMutationResult<BulkDeleteResult, ApiError, BulkDeleteVariables>
 */
export function useBulkDeleteDocuments() {
  const buCode = useBuCode();
  const queryClient = useQueryClient();

  const post = async (body: unknown): Promise<BulkDeleteResult> => {
    const res = await httpClient.post(
      API_ENDPOINTS.DOCUMENTS_BULK_DELETE(buCode!),
      body,
    );
    if (!res.ok) throw await ApiError.from(res, "Failed to delete documents");
    const json = await res.json();
    const payload = json?.data as BulkDeleteResult | undefined;
    if (!payload || !Array.isArray(payload.failed)) {
      throw new Error("Unexpected bulk-delete response shape");
    }
    return payload;
  };

  return useMutation<BulkDeleteResult, ApiError, BulkDeleteVariables>({
    meta: { skipGlobalErrorToast: true },
    mutationFn: async (variables) => {
      if (!buCode)
        throw new ApiError("MISSING_REQUIRED_FIELD", "Missing buCode");
      if ("filter" in variables) return post(variables);
      const total: BulkDeleteResult = { deleted: 0, failed: [], freed_size: 0 };
      for (
        let i = 0;
        i < variables.file_tokens.length;
        i += BULK_DELETE_TOKEN_CHUNK
      ) {
        const chunk = variables.file_tokens.slice(
          i,
          i + BULK_DELETE_TOKEN_CHUNK,
        );
        let r: BulkDeleteResult;
        try {
          r = await post({ file_tokens: chunk });
        } catch (err) {
          // ก้อนแรกพัง = ยังไม่มีอะไรถูกลบ → โยนต่อเหมือนเดิม
          // ก้อนหลังพัง = ก้อนก่อนหน้าลบไปแล้ว: รายงานที่เหลือเป็น failed แล้วคืนผลรวม
          // เพื่อให้ผู้ใช้เห็นว่าลบไปกี่ไฟล์ (toast บางส่วน) และล้างการเลือกที่ token หายไปแล้ว
          if (total.deleted === 0 && total.failed.length === 0) throw err;
          for (const fileToken of variables.file_tokens.slice(i)) {
            total.failed.push({
              fileToken,
              fileName: fileToken,
              reason: "DELETE_FAILED",
            });
          }
          break;
        }
        total.deleted += r.deleted;
        total.failed.push(...r.failed);
        total.freed_size += r.freed_size;
      }
      return total;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DOCUMENTS] });
    },
  });
}

/**
 * Hook ดึงยอดสรุปขนาดไฟล์แนบของทั้ง BU
 *
 * ยอดนี้เป็นของทั้ง BU เสมอ ไม่ผูกกับ search/filter/หน้าของตาราง จึงไม่รับ params
 * query key ขึ้นต้นด้วย QUERY_KEYS.DOCUMENTS เหมือน useDocument โดยตั้งใจ —
 * TanStack Query จับคู่ key แบบ prefix การ invalidate หลัง upload/delete ที่มีอยู่แล้ว
 * จึงล้างยอดสรุปให้ด้วยโดยไม่ต้องแก้อะไรเพิ่ม
 *
 * `retry: false` เพราะเคสพังที่คาดไว้คือ 401 จาก app allowlist ที่ยังไม่เติมตอน deploy
 * ซึ่ง retry แล้วก็ไม่หาย มีแต่จะยิงซ้ำเปล่า ๆ
 *
 * @returns UseQueryResult ของ DocumentSummary
 * @example
 * const { data: summary, isLoading } = useDocumentSummary();
 */
export function useDocumentSummary() {
  const buCode = useBuCode();

  return useQuery<DocumentSummary>({
    queryKey: [QUERY_KEYS.DOCUMENTS, buCode, "summary"],
    queryFn: async () => {
      if (!buCode) throw new Error("Missing buCode");
      const res = await httpClient.get(API_ENDPOINTS.DOCUMENTS_SUMMARY(buCode));
      if (!res.ok) throw new Error("Failed to fetch document summary");
      const json = await res.json();
      return json.data as DocumentSummary;
    },
    ...CACHE_DYNAMIC,
    enabled: !!buCode,
    retry: false,
  });
}

/**
 * นับล่วงหน้าก่อนลบแบบตัวกรอง (dry_run: true) — endpoint + body เดียวกับลบจริง แต่ไม่ลบอะไร
 * in_use / platform_blocked = null แปลว่า lookup ล้มเหลว (freed_size ประมาณ)
 * ไม่ invalidate: ไม่มีอะไรเปลี่ยน
 */
export function useBulkDeleteDryRun() {
  const buCode = useBuCode();
  return useMutation<BulkDeleteDryRunResult, ApiError, BulkDeleteVariables>({
    meta: { skipGlobalErrorToast: true },
    mutationFn: async (variables) => {
      if (!buCode)
        throw new ApiError("MISSING_REQUIRED_FIELD", "Missing buCode");
      const res = await httpClient.post(
        API_ENDPOINTS.DOCUMENTS_BULK_DELETE(buCode),
        { ...variables, dry_run: true },
      );
      if (!res.ok) throw await ApiError.from(res, "Failed to count documents");
      const json = await res.json();
      const payload = json?.data as BulkDeleteDryRunResult | undefined;
      if (!payload || typeof payload.matched !== "number") {
        throw new Error("Unexpected dry-run response shape");
      }
      return payload;
    },
  });
}
