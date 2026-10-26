import { useQuery } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { httpClient } from "@/lib/http-client";
import { buildUrl } from "@/lib/build-query-string";
import { ApiError } from "@/lib/api-error";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { CACHE_DYNAMIC } from "@/lib/cache-config";
import type { PaginatedResponse } from "@/types/params";
import type {
  ScCalendarDay,
  ScDetail,
  ScListItem,
  ScListParams,
  ScPostResult,
  ScUpdateLinesInput,
  ScVerifyResult,
  ScVoidResult,
} from "@/types/sales-consumption";

async function getJson<T>(url: string, fallback: string): Promise<T> {
  const res = await httpClient.get(url);
  if (!res.ok) throw await ApiError.from(res, fallback);
  return res.json();
}

/** ทุก mutation ของ SC กระทบรายการ/รายละเอียด/ปฏิทินพร้อมกัน */
const SC_KEYS = [
  QUERY_KEYS.SALES_CONSUMPTION,
  QUERY_KEYS.SALES_CONSUMPTIONS,
  QUERY_KEYS.SALES_CONSUMPTION_CALENDAR,
] as const;

/** รายการ Sales Consumption รายวัน (แบ่งหน้า ล่าสุดก่อน) */
export function useSalesConsumptions(params: ScListParams | undefined) {
  const buCode = useBuCode();
  return useQuery<PaginatedResponse<ScListItem>>({
    queryKey: [QUERY_KEYS.SALES_CONSUMPTIONS, buCode, params],
    queryFn: () =>
      getJson(
        buildUrl(API_ENDPOINTS.SALES_CONSUMPTIONS(buCode!), { ...params }),
        "Failed to load sales consumptions",
      ),
    ...CACHE_DYNAMIC,
    enabled: !!buCode,
  });
}

/** ปฏิทินของเดือน (`YYYY-MM`) */
export function useSalesConsumptionCalendar(month: string) {
  const buCode = useBuCode();
  return useQuery<ScCalendarDay[]>({
    queryKey: [QUERY_KEYS.SALES_CONSUMPTION_CALENDAR, buCode, month],
    queryFn: async () =>
      (
        await getJson<{ data: ScCalendarDay[] }>(
          buildUrl(API_ENDPOINTS.SALES_CONSUMPTION_CALENDAR(buCode!), {
            month,
          }),
          "Failed to load sales consumption calendar",
        )
      ).data,
    ...CACHE_DYNAMIC,
    enabled: !!buCode && !!month,
  });
}

/** รายละเอียด Sales Consumption หนึ่งใบ */
export function useSalesConsumption(id: string | undefined) {
  const buCode = useBuCode();
  return useQuery<ScDetail>({
    queryKey: [QUERY_KEYS.SALES_CONSUMPTION, buCode, id],
    queryFn: async () =>
      (
        await getJson<{ data: ScDetail }>(
          API_ENDPOINTS.SALES_CONSUMPTION(buCode!, id!),
          "Failed to load sales consumption",
        )
      ).data,
    ...CACHE_DYNAMIC,
    enabled: !!buCode && !!id,
  });
}

/**
 * แก้บรรทัดของ SC (location / สูตร / ไม่นับ)
 * `set_item_default` บันทึกเป็นค่าตั้งต้นของเมนู POS ด้วย จึง invalidate รายการเมนูเสมอ
 */
export function useUpdateScLines(id: string) {
  return useApiMutation<ScUpdateLinesInput, { data: unknown }>({
    mutationFn: (body, buCode) =>
      httpClient.patch(API_ENDPOINTS.SALES_CONSUMPTION_LINES(buCode, id), body),
    invalidateKeys: [...SC_KEYS, QUERY_KEYS.POS_SALE_ITEMS],
    errorMessage: "Failed to update sales consumption lines",
  });
}

/** ตรวจ on-hand ของวัตถุดิบที่จะตัด — ผลถูกบันทึกกับ SC (refresh รายละเอียดด้วย) */
export function useVerifyScOnhand(id: string) {
  return useApiMutation<void, { data: ScVerifyResult }>({
    mutationFn: (_v, buCode) =>
      httpClient.post(API_ENDPOINTS.SALES_CONSUMPTION_VERIFY(buCode, id)),
    invalidateKeys: [...SC_KEYS],
    errorMessage: "Failed to verify on-hand",
  });
}

/** Post SC → สร้าง Stock Out หนึ่งใบต่อ location (`doc_version` = ที่ผู้ใช้เห็นล่าสุด) */
export function usePostSalesConsumption(id: string) {
  return useApiMutation<{ doc_version: number }, { data: ScPostResult }>({
    mutationFn: (body, buCode) =>
      httpClient.post(API_ENDPOINTS.SALES_CONSUMPTION_POST(buCode, id), body),
    invalidateKeys: [...SC_KEYS, QUERY_KEYS.INVENTORY_ADJUSTMENTS],
    errorMessage: "Failed to post sales consumption",
  });
}

/** Void SC ที่ posted — คืนสต็อก และอาจสร้าง SC pending ใหม่ (`new_sc_id`) */
export function useVoidSalesConsumption(id: string) {
  return useApiMutation<
    { void_reason: string; doc_version: number },
    { data: ScVoidResult }
  >({
    mutationFn: (body, buCode) =>
      httpClient.post(API_ENDPOINTS.SALES_CONSUMPTION_VOID(buCode, id), body),
    invalidateKeys: [...SC_KEYS, QUERY_KEYS.INVENTORY_ADJUSTMENTS],
    errorMessage: "Failed to void sales consumption",
  });
}
