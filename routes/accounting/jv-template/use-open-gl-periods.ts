import { useMemo } from "react";
import { useGlPeriods } from "@/hooks/use-accounting-master";
import type { GlPeriodMaster } from "@/types/accounting-master";

/** งวดบัญชีที่ยังเปิดอยู่ เรียงตามปี/งวด — ใช้เลือกงวดตอน generate JV */
export function useOpenGlPeriods(): {
  periods: GlPeriodMaster[];
  isLoading: boolean;
  error: Error | null;
} {
  const query = useGlPeriods();
  const periods = useMemo(
    () =>
      (query.data ?? [])
        // งวด 13 (ปรับปรุงปลายปี) เปิดได้แต่ generate ไม่รองรับ — backend ปฏิเสธเสมอ
        .filter((p) => p.status === "open" && p.period_number <= 12)
        .sort(
          (a, b) =>
            a.fiscal_year - b.fiscal_year || a.period_number - b.period_number,
        ),
    [query.data],
  );
  return { periods, isLoading: query.isPending, error: query.error };
}
