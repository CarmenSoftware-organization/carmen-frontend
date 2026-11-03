import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { useBuCode } from "@/hooks/use-bu-code";
import { ApiError } from "@/lib/api-error";
import { buildUrl } from "@/lib/build-query-string";
import { CACHE_DYNAMIC } from "@/lib/cache-config";
import { httpClient } from "@/lib/http-client";

export interface InventoryPeriodOptions {
  /** รหัสงวดที่เลือกได้ ใหม่สุดก่อน เช่น `["2602", "2601"]` */
  readonly codes: readonly string[];
  /** รหัสของงวดที่ token `@current_period` / `@previous_period` ชี้อยู่ตอนนี้ */
  readonly current?: string;
  readonly previous?: string;
}

/**
 * รหัสงวดที่เลือกได้ใน widget dashboard — ชุดเดียวกับตัวเลือกงวดของรายงาน
 * (`GET /api/:bu_code/reports/lookups?types=period` = งวดที่ปิดแล้ว + งวด active
 * ใหม่สุดก่อน) งวดอนาคตที่สร้างล่วงหน้าไว้จึงไม่โผล่ให้เลือก · พ่วงงวดปัจจุบัน /
 * งวดก่อน (กติกาเดียวกับ backend) ให้ป้าย token บอกได้ว่าตอนนี้คืองวดไหน
 *
 * @param enabled - false = ยังไม่ดึง (รอเปิด popover)
 * @returns query ของรหัสงวด + งวดปัจจุบัน / งวดก่อน
 */
export function useInventoryPeriodOptions(enabled = true) {
  const buCode = useBuCode();
  return useQuery<InventoryPeriodOptions, ApiError>({
    // คีย์แยกจาก useReportListLookups — ตัวนั้นเก็บ payload รูปอื่นไว้ใต้ prefix เดียวกัน
    queryKey: [QUERY_KEYS.REPORT_LOOKUPS, buCode, "period", "dashboard"],
    queryFn: async () => {
      const url = buildUrl(API_ENDPOINTS.REPORT_LOOKUPS(buCode!), {
        types: "period,current-period,previous-period",
      });
      const res = await httpClient.get(url);
      if (!res.ok) {
        throw await ApiError.from(res, "Failed to fetch periods");
      }
      const json = await res.json();
      const raw = (json.data ?? json) as Record<string, unknown>;
      const items = Array.isArray(raw.period) ? raw.period : [];
      const codeOf = (v: unknown) =>
        (v as { period?: string } | null)?.period || undefined;
      return {
        codes: (items as Array<{ code?: unknown }>)
          .map((it) => String(it.code ?? ""))
          .filter(Boolean),
        current: codeOf(raw["current-period"]),
        previous: codeOf(raw["previous-period"]),
      };
    },
    enabled: enabled && !!buCode,
    ...CACHE_DYNAMIC,
  });
}
