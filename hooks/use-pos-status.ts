import { useQuery } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { useInterfaceEntitlement } from "@/hooks/use-interface-entitlement";
import { httpClient } from "@/lib/http-client";
import { ApiError } from "@/lib/api-error";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { CACHE_STATIC } from "@/lib/cache-config";
import type { PosBrand } from "@/types/pos-sale";
import type { PosStatusResult } from "@/types/sales-consumption";

/**
 * แบรนด์ POS ที่ BU เปิดใช้ — ใช้ตัดสินว่าจะแสดงเมนู Sales Consumption ไหม
 *
 * ยิงเฉพาะเมื่ออ่าน config POS ได้ (`canReadConfig` ของ simphony หรือ micros3700)
 * ไม่มีสิทธิ์อ่าน = `isEnabled: false` โดยไม่ยิง endpoint (กัน 403 เด้ง PermissionDeniedDialog)
 *
 * @returns `enabledBrands`, `isEnabled` (มีอย่างน้อยหนึ่งแบรนด์), `isLoading`
 */
export function usePosStatus(): {
  enabledBrands: PosBrand[];
  isEnabled: boolean;
  isLoading: boolean;
} {
  const buCode = useBuCode();
  const { canReadConfig, isLoading: licenseLoading } = useInterfaceEntitlement();
  const canRead =
    canReadConfig("pos", "simphony") || canReadConfig("pos", "micros3700");

  const { data, isLoading } = useQuery<PosBrand[]>({
    queryKey: [QUERY_KEYS.POS_SALE_STATUS, buCode],
    queryFn: async () => {
      const res = await httpClient.get(API_ENDPOINTS.POS_SALE_STATUS(buCode!));
      if (!res.ok) throw await ApiError.from(res, "Failed to load POS status");
      const json = (await res.json()) as { data: PosStatusResult };
      return json.data.enabled_brands;
    },
    ...CACHE_STATIC,
    retry: false,
    enabled: !!buCode && canRead,
  });

  const enabledBrands = canRead ? (data ?? []) : [];
  return {
    enabledBrands,
    isEnabled: enabledBrands.length > 0,
    isLoading: licenseLoading || (canRead && isLoading),
  };
}
