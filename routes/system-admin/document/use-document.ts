import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { httpClient } from "@/lib/http-client";
import { buildUrl } from "@/lib/build-query-string";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { ApiError } from "@/lib/api-error";
import type {
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
    return (json.data ?? json) as BulkDeleteResult;
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
        const r = await post({
          file_tokens: variables.file_tokens.slice(
            i,
            i + BULK_DELETE_TOKEN_CHUNK,
          ),
        });
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
