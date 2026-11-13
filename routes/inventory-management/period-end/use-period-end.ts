import { useQuery } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { httpClient } from "@/lib/http-client";
import { buildUrl } from "@/lib/build-query-string";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type {
  PeriodEnd,
  PeriodEndReview,
  ReviewTransactionKey,
  ReviewTransactionStat,
  StartCountingResult,
} from "@/types/period-end";
import type { ParamsDto, PaginatedResponse } from "@/types/params";
import { CACHE_DYNAMIC } from "@/lib/cache-config";

export function usePeriodEnd(params?: ParamsDto) {
  const buCode = useBuCode();

  return useQuery<PaginatedResponse<PeriodEnd>>({
    queryKey: [QUERY_KEYS.PERIOD_ENDS, buCode, params],
    queryFn: async () => {
      const url = buildUrl(API_ENDPOINTS.PERIOD_ENDS(buCode!), params);
      const res = await httpClient.get(url);
      if (!res.ok) throw new Error("Failed to fetch period ends");
      return res.json();
    },
    enabled: !!buCode,
    ...CACHE_DYNAMIC,
  });
}

export function usePeriodEndCurrent() {
  const buCode = useBuCode();

  return useQuery<PeriodEnd>({
    queryKey: [QUERY_KEYS.PERIOD_ENDS, buCode, "current"],
    queryFn: async () => {
      const res = await httpClient.get(
        API_ENDPOINTS.PERIOD_END_CURRENT(buCode!),
      );
      if (!res.ok) throw new Error("Failed to fetch current period end");
      const json: { data: PeriodEnd } = await res.json();
      return json.data;
    },
    enabled: !!buCode,
    ...CACHE_DYNAMIC,
  });
}

type RawTransactionStat = Omit<ReviewTransactionStat, "is_complete"> & {
  is_complete: boolean | "true" | "false";
};
type RawPeriodEndReview = Omit<PeriodEndReview, "details"> & {
  details: {
    transaction: Record<ReviewTransactionKey, RawTransactionStat>;
    physical_count: PeriodEndReview["details"]["physical_count"];
  };
};

export function usePeriodEndReview() {
  const buCode = useBuCode();

  return useQuery<PeriodEndReview>({
    queryKey: [QUERY_KEYS.PERIOD_ENDS, buCode, "review"],
    queryFn: async () => {
      const res = await httpClient.get(
        API_ENDPOINTS.PERIOD_END_REVIEW(buCode!),
      );
      if (!res.ok) throw new Error("Failed to fetch period end review");
      const json: { data: RawPeriodEndReview } = await res.json();
      const raw = json.data;
      const transaction = Object.fromEntries(
        (Object.keys(raw.details.transaction) as ReviewTransactionKey[]).map(
          (key) => {
            const stat = raw.details.transaction[key];
            return [
              key,
              {
                ...stat,
                is_complete:
                  stat.is_complete === true || stat.is_complete === "true",
              },
            ];
          },
        ),
      ) as Record<ReviewTransactionKey, ReviewTransactionStat>;
      return {
        ...raw,
        details: { transaction, physical_count: raw.details.physical_count },
      };
    },
    enabled: !!buCode,
    ...CACHE_DYNAMIC,
  });
}

export function useClosePeriodEnd() {
  return useApiMutation<void>({
    mutationFn: (_data, buCode) =>
      httpClient.post(API_ENDPOINTS.PERIOD_ENDS(buCode)),
    // ปิดงวดตั้งรอบตรวจนับทุกอันเป็น completed ด้วย — ถ้าไม่ล้าง key นี้
    // หน้า Physical Count จะค้างโชว์ counting ทั้งที่งวดปิดไปแล้ว
    // ปิดงวดแล้ว backend เติมรอบใหม่ต่อท้ายให้ครบ 12 — หน้า Inventory Period ต้องเห็นทันที
    invalidateKeys: [
      QUERY_KEYS.PERIOD_ENDS,
      QUERY_KEYS.PHYSICAL_COUNT_PERIOD_CURRENT,
      QUERY_KEYS.INVENTORY_PERIODS,
    ],
    errorMessage: "Failed to close period end",
  });
}

/**
 * Hook เปิดรอบตรวจนับของงวดปัจจุบัน (Start Counting)
 *
 * ยิง `POST /period-ends/start-counting` ซึ่งจะตรวจเอกสารที่กระทบสต๊อกก่อน แล้วเลื่อน
 * รอบตรวจนับจาก `draft` เป็น `counting` — ใบนับรายคลังสร้างได้ก็ต่อเมื่อรอบเป็น `counting`
 *
 * ปิด toast กลางไว้ (`skipGlobalErrorToast`) เพราะเคส 422 เราเอา `error.details`
 * ไปเรนเดอร์เป็นรายการเอกสารที่ค้างเองใน dialog ซึ่งบอกอะไรได้มากกว่า toast บรรทัดเดียว
 *
 * @returns UseMutationResult ที่ไม่รับ variable
 * @example
 * ```ts
 * const start = useStartPeriodCounting();
 * start.mutate(undefined, { onSuccess: () => navigate("/inventory-management/period-end/review") });
 * ```
 */
export function useStartPeriodCounting() {
  return useApiMutation<void, { data: StartCountingResult }>({
    mutationFn: (_data, buCode) =>
      httpClient.post(API_ENDPOINTS.PERIOD_END_START_COUNTING(buCode)),
    invalidateKeys: [
      QUERY_KEYS.PERIOD_ENDS,
      QUERY_KEYS.PHYSICAL_COUNT_PERIOD_CURRENT,
    ],
    errorMessage: "Failed to start counting",
    meta: { skipGlobalErrorToast: true },
  });
}
