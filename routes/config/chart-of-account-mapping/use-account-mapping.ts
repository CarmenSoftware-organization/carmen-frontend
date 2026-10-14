import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { httpClient } from "@/lib/http-client";
import { buildUrl } from "@/lib/build-query-string";
import { ApiError } from "@/lib/api-error";
import type { ApiErrorMeta } from "@/lib/api-error-handler";
import { CACHE_DYNAMIC } from "@/lib/cache-config";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { useBuCode } from "@/hooks/use-bu-code";
import { cleanServerMessage } from "@/hooks/use-api-mutation";
import type {
  AccountMappingListResponse,
  AccountMappingRow,
  MappingCounts,
  MappingMovement,
  MappingStatus,
  MappingType,
} from "@/types/chart-of-account-mapping";

/**
 * query param ของ `GET /api/:bu_code/account-mapping` — backend รับเป็น key แยก
 * (ไม่ใช่ clause ใน `filter=`) — key ของ entity (location / category / sub-category /
 * item group / adjustment type) รับหลาย id คั่นด้วย `,` ส่วน key อื่นรับค่าเดียว
 */
export interface AccountMappingListParams {
  mapping_type: MappingType;
  page?: number;
  perpage?: number;
  search?: string;
  location_id?: string;
  location_type?: "inventory" | "direct";
  category_id?: string;
  sub_category_id?: string;
  product_item_group_id?: string;
  movement?: MappingMovement;
  adjustment_type_id?: string;
  status?: MappingStatus;
  /** `<column id>:asc|desc` — backend รับเฉพาะคอลัมน์ใน whitelist (ไม่รวม status) */
  sort?: string;
}

export const EMPTY_COUNTS: MappingCounts = {
  incomplete: 0,
  overridden: 0,
  default: 0,
  unreviewed: 0,
};

/**
 * รายการ mapping ของแท็บเดียว (AP หรือ GL) แบบแบ่งหน้าที่ server
 *
 * `counts` มาจาก `summary.counts` ของ response (นับทั้งแท็บ ไม่ใช่แค่หน้านี้)
 */
export function useAccountMappingList(params: AccountMappingListParams) {
  const buCode = useBuCode();
  return useQuery<AccountMappingListResponse, ApiError>({
    queryKey: [QUERY_KEYS.ACCOUNT_MAPPING, buCode, params],
    queryFn: async () => {
      if (!buCode)
        throw new ApiError("MISSING_REQUIRED_FIELD", "Missing buCode");
      const res = await httpClient.get(
        buildUrl(API_ENDPOINTS.ACCOUNT_MAPPING(buCode), params),
      );
      if (!res.ok)
        throw await ApiError.from(res, "Failed to fetch account mapping");
      const json = await res.json();
      return {
        data: json?.data ?? [],
        paginate: json?.paginate ?? {
          total: 0,
          page: params.page ?? 1,
          perpage: params.perpage ?? 0,
          pages: 0,
        },
        counts: { ...EMPTY_COUNTS, ...json?.summary?.counts },
      };
    },
    ...CACHE_DYNAMIC,
    enabled: !!buCode,
  });
}

/**
 * mutation ของ account mapping — เหมือน `useApiMutation` แต่ unwrap `.data`
 * ของ response ให้ (`{ data: X }` → `X`) และ invalidate list ทุกครั้งที่จบ
 */
function useAccountMappingMutation<TVariables, TResult>(
  send: (variables: TVariables, buCode: string) => Promise<Response>,
  errorMessage: string,
  meta?: ApiErrorMeta,
) {
  const buCode = useBuCode();
  const queryClient = useQueryClient();
  return useMutation<TResult, ApiError, TVariables>({
    meta,
    mutationFn: async (variables) => {
      if (!buCode)
        throw new ApiError("MISSING_REQUIRED_FIELD", "Missing buCode");
      const res = await send(variables, buCode);
      if (!res.ok)
        throw await ApiError.from(res, errorMessage, cleanServerMessage);
      const json = await res.json();
      return json?.data as TResult;
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ACCOUNT_MAPPING] }),
  });
}

export interface UpdateAccountMappingVariables {
  id: string;
  doc_version: number;
  /** `null` = ล้างค่าแก้ทับ กลับไปใช้ค่าเริ่มต้น · ไม่ส่ง = ไม่แตะ */
  account_code?: string | null;
  cost_center_id?: string | null;
}

/** PATCH แถวเดียว — 409 (doc_version ชน) / 422 (รหัสบัญชีไม่อยู่ใน COA) ให้ sheet แสดงเอง */
export function useUpdateAccountMapping() {
  return useAccountMappingMutation<
    UpdateAccountMappingVariables,
    AccountMappingRow
  >(
    ({ id, ...body }, buCode) =>
      httpClient.patch(`${API_ENDPOINTS.ACCOUNT_MAPPING(buCode)}/${id}`, body),
    "Failed to update account mapping",
    { skipGlobalErrorToast: true },
  );
}

export function useReviewAccountMapping() {
  return useAccountMappingMutation<{ ids: string[] }, { updated: number }>(
    (body, buCode) =>
      httpClient.post(`${API_ENDPOINTS.ACCOUNT_MAPPING(buCode)}/review`, body),
    "Failed to review account mapping",
  );
}

export interface BatchUpdateAccountMappingVariables {
  items: { id: string; doc_version: number }[];
  /** `null` = คืนค่าเริ่มต้น · ไม่ส่ง = ไม่แตะ */
  account_code?: string | null;
  cost_center_id?: string | null;
}

export interface BatchUpdateAccountMappingResult {
  updated: { id: string; doc_version: number }[];
  /** doc_version ไม่ตรง — มีคนแก้ไปก่อน */
  conflicts: string[];
  /** ถูกลบไปแล้ว */
  not_found: string[];
}

/** POST batch-update — บันทึกเท่าที่ได้; 422 (ค่าเป้าหมายใช้ไม่ได้) ให้ sheet แสดงเอง */
export function useBatchUpdateAccountMapping() {
  return useAccountMappingMutation<
    BatchUpdateAccountMappingVariables,
    BatchUpdateAccountMappingResult
  >(
    (body, buCode) =>
      httpClient.post(
        `${API_ENDPOINTS.ACCOUNT_MAPPING(buCode)}/batch-update`,
        body,
      ),
    "Failed to batch update account mapping",
    { skipGlobalErrorToast: true },
  );
}

export interface GenerateAccountMappingResult {
  created: Record<MappingType, number>;
  existing: Record<MappingType, number>;
}

/** สร้างแถวที่ยังไม่มี — ไม่ส่ง `mapping_type` = ทั้ง AP และ GL */
export function useGenerateAccountMapping() {
  return useAccountMappingMutation<
    { mapping_type?: MappingType; mode: "all" | "used" },
    GenerateAccountMappingResult
  >(
    (body, buCode) =>
      httpClient.post(
        `${API_ENDPOINTS.ACCOUNT_MAPPING(buCode)}/generate`,
        body,
      ),
    "Failed to generate account mapping",
  );
}
