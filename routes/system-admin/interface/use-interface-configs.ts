import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { fetchAppConfigByKey } from "@/hooks/use-app-config";
import { ApiError } from "@/lib/api-error";
import { QUERY_KEYS } from "@/constant/query-keys";
import { CACHE_STATIC } from "@/lib/cache-config";
import type { AppConfig } from "@/types/app-config";
import { useInterfaceEntitlement } from "@/hooks/use-interface-entitlement";
import { INTERFACE_CATEGORIES } from "./interface-registry";

/** config key ของทุก brand คู่กับ category — คงที่ตลอดอายุแอป จึงคำนวณครั้งเดียวนอก component */
const BRAND_KEYS = INTERFACE_CATEGORIES.flatMap((c) =>
  c.brands.map((b) => ({
    categoryKey: c.key,
    brandKey: b.key,
    configKey: b.configKey,
  })),
);

/**
 * อ่าน app-config ของทุก interface แบบรายคีย์
 *
 * ใช้แทน `useAppConfigs()` เพราะ list endpoint (`GET /app-config`) ผูกกับ
 * `configuration.app_config` ไม่ใช่ `interface` และตั้งแต่ 2026-09-20 มันไม่คืนคีย์
 * `interface_*` อีกแล้ว (gateway กรองออก) การยิงรายคีย์จึงเป็นทางเดียวที่เหลือ และ
 * ตรงกับ license ที่หน้านี้ถืออยู่จริง
 *
 * 404 = ยังไม่เคยตั้งค่า ไม่ใช่ข้อผิดพลาด — คืนเป็น "ไม่มีแถว" เหมือนที่ list เคยทำ
 *
 * **ยิงเฉพาะ brand ที่ BU มีสิทธิ์ (entitlement ≠ `none`)** — backend ตอบ 403 ให้ brand ที่ BU
 * ไม่ได้ซื้อ ถ้ายิงครบทุกคีย์ หน้าทั้งหน้าจะกลายเป็น error และ `PermissionDeniedDialog` เด้ง
 * ทั้งที่ brand พวกนั้นถูก `interfaceGroups` ซ่อนอยู่แล้ว · รอ license ก่อนเสมอ เพราะระหว่างนั้น
 * ทุก brand ตัดสินเป็น `none`
 */
export function useInterfaceConfigs() {
  const buCode = useBuCode();
  const queryClient = useQueryClient();
  const { isEntitled, isLoading: isLicenseLoading } = useInterfaceEntitlement();
  const configKeys = isLicenseLoading
    ? []
    : BRAND_KEYS.filter((b) => isEntitled(b.categoryKey, b.brandKey)).map(
        (b) => b.configKey,
      );
  const results = useQueries({
    queries: configKeys.map((key) => ({
      queryKey: [QUERY_KEYS.APP_CONFIGS, buCode, key],
      queryFn: async (): Promise<AppConfig | null> => {
        try {
          return await fetchAppConfigByKey(buCode!, key);
        } catch (error) {
          if (error instanceof ApiError && error.statusCode === 404)
            return null;
          throw error;
        }
      },
      ...CACHE_STATIC,
      enabled: !!buCode,
    })),
  });

  return {
    data: results
      .map((r) => r.data)
      .filter((row): row is AppConfig => row != null),
    isLoading: isLicenseLoading || results.some((r) => r.isPending),
    isError: results.some((r) => r.isError),
    refetch: () => {
      // Invalidate each interface config key individually with exact: true to avoid
      // accidentally invalidating other queries that share the same prefix (saved views,
      // report_email, email profiles/templates, etc.). React Query does partial match
      // by default, so prefix-only invalidation would drag unrelated queries along.
      configKeys.forEach(
        (key) =>
          void queryClient.invalidateQueries({
            queryKey: [QUERY_KEYS.APP_CONFIGS, buCode, key],
            exact: true,
          }),
      );
    },
  };
}
