import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { useBuCode } from "@/hooks/use-bu-code";
import { ApiError } from "@/lib/api-error";
import { CACHE_STATIC } from "@/lib/cache-config";
import { httpClient } from "@/lib/http-client";
import type {
  DashboardWidgetListResponse,
  SystemWidgetConfigListResponse,
} from "@/types/dashboard-widget";

async function fetchBundledWidgets(
  buCode: string,
  module: string,
): Promise<SystemWidgetConfigListResponse> {
  const res = await httpClient.get(API_ENDPOINTS.DASHBOARD_WIDGETS(buCode, module));
  if (!res.ok)
    throw await ApiError.from(
      res,
      `Failed to fetch ${module} dashboard widgets`,
    );
  const json = await res.json();
  return json.data as DashboardWidgetListResponse;
}

/**
 * รายชื่อ system widget ของ module (config เปล่า ไม่มีค่า dataset)
 *
 * เดิมหน้า module dashboard ยิง `/dashboard-widgets/{module}` ตัวเดียวแล้ว gateway
 * ไป `Promise.all` exec dataset ทุกตัว (สูงสุด 12 ตัว) — response กลับเมื่อตัวช้าสุด
 * เสร็จ ตัวเดียวช้า/พัง = ค้างทั้งหน้า และชน timeout 30 วิของ http-client ได้
 *
 * ตอนนี้แยกเป็นสองจังหวะ: ตัวนี้คืน config ล้วน (gateway ไม่แตะ DB เลย) ให้วาดกริด
 * ได้ทันที แล้วแต่ละใบค่อยยิง dataset ของตัวเองตอนเลื่อนถึง (ดู `LazyWidgetCard`)
 *
 * ใช้ CACHE_STATIC เพราะ config hardcode อยู่ที่ gateway ไม่เปลี่ยนระหว่าง session
 *
 * @param module - ชื่อ module ของ dashboard เช่น `procurement`
 * @returns UseQueryResult ของรายการ config
 */
function useDashboardWidgetConfigs(module: string) {
  const buCode = useBuCode();
  return useQuery<SystemWidgetConfigListResponse>({
    queryKey: [QUERY_KEYS.DASHBOARD_WIDGET_CONFIGS, buCode, module],
    queryFn: async () => {
      const res = await httpClient.get(
        API_ENDPOINTS.DASHBOARD_WIDGET_CONFIGS(buCode!, module),
      );
      // gateway ที่ยังไม่ได้ deploy route นี้ตอบ 404 ("Cannot GET ..." ของ Express)
      // — ถอยไป endpoint รวมเดิมแทนที่จะให้ทั้งหน้าแดง
      if (res.status === 404) return fetchBundledWidgets(buCode!, module);
      if (!res.ok)
        throw await ApiError.from(
          res,
          `Failed to fetch ${module} dashboard widgets`,
        );
      const json = await res.json();
      return json.data as SystemWidgetConfigListResponse;
    },
    enabled: !!buCode,
    ...CACHE_STATIC,
  });
}

export function useProcurementWidgets() {
  return useDashboardWidgetConfigs("procurement");
}

export function useInventoryWidgets() {
  return useDashboardWidgetConfigs("inventory");
}

export function useProductWidgets() {
  return useDashboardWidgetConfigs("product");
}

export function useConfigWidgets() {
  return useDashboardWidgetConfigs("config");
}

export function useVendorWidgets() {
  return useDashboardWidgetConfigs("vendor-management");
}

export function useOperationPlanWidgets() {
  return useDashboardWidgetConfigs("operation-plan");
}

export function useStoreOperationWidgets() {
  return useDashboardWidgetConfigs("store-operation");
}
