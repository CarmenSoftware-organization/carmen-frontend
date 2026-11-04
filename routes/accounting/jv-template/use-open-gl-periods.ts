import { useMemo } from "react";
import { useGlPeriods } from "@/hooks/use-accounting-master";
import type { GlPeriodMaster } from "@/types/accounting-master";

/** งวดบัญชีที่ยังเปิดอยู่ เรียงตามปี/งวด — ใช้เลือกงวดตอน generate JV */
export function useOpenGlPeriods(): {
  periods: GlPeriodMaster[];
  isLoading: boolean;
} {
  const query = useGlPeriods();
  const periods = useMemo(
    () =>
      (query.data ?? [])
        .filter((p) => p.status === "open")
        .sort(
          (a, b) =>
            a.fiscal_year - b.fiscal_year || a.period_number - b.period_number,
        ),
    [query.data],
  );
  return { periods, isLoading: query.isPending };
}
