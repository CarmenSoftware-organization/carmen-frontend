import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";
import type {
  BusinessUnitDetail,
  BusinessUnitPatch,
} from "@/types/business-unit";

/**
 * Hook ดึงรายละเอียด Business Unit ปัจจุบันจาก `GET api/business-units`
 *
 * backend หา BU จาก context (token/x-app-id) — ไม่มี id ใน URL. query เปิดทำงาน
 * เมื่อมี `buId` (จาก `useProfile().defaultBu.id`) และใช้เป็น cache key เพื่อ
 * refetch อัตโนมัติเมื่อสลับ BU
 *
 * @param buId - UUID ของ business unit (undefined = ยังไม่พร้อม, query ถูก disable)
 * @returns UseQueryResult ของ BusinessUnitDetail
 * @example
 * ```ts
 * const { defaultBu } = useProfile();
 * const { data, isLoading } = useBusinessUnit(defaultBu?.id);
 * ```
 */
export function useBusinessUnit(buId: string | undefined) {
  return useQuery<BusinessUnitDetail>({
    queryKey: [QUERY_KEYS.BUSINESS_UNIT_DETAIL, buId],
    queryFn: async () => {
      const res = await httpClient.get(API_ENDPOINTS.BUSINESS_UNIT);
      if (!res.ok) throw new Error("Failed to fetch business unit");
      const json = await res.json();
      return json.data;
    },
    enabled: !!buId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook แก้ไข Business Unit แบบ partial ผ่าน `PATCH api/business-units`
 *
 * ส่งเฉพาะ field ที่เปลี่ยน (payload ที่ caller สร้างจาก diff) — onSuccess
 * invalidate ทั้ง detail และ profile (เพราะ config บาง field เช่น date/currency
 * ถูก cache ใน profile ด้วย)
 *
 * @param buId - UUID ของ business unit
 * @returns UseMutationResult รับ `BusinessUnitPatch` (partial)
 * @example
 * ```ts
 * const update = useUpdateBusinessUnit(defaultBu?.id);
 * update.mutate({ name: "New name" });
 * ```
 */
export function useUpdateBusinessUnit(buId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, BusinessUnitPatch>({
    mutationFn: async (payload) => {
      const res = await httpClient.patch(API_ENDPOINTS.BUSINESS_UNIT, payload);
      if (!res.ok) {
        let serverMessage: string | undefined;
        try {
          const err = await res.json();
          serverMessage = err.message;
        } catch {
          // JSON parse failed
        }
        throw await ApiError.from(
          res,
          serverMessage || "Failed to update business unit",
        );
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PROFILE] });
      // คืน promise ของ refetch — mutation ยัง pending จนข้อมูล BU ชุดใหม่มาถึง แล้ว callback ของ
      // ผู้เรียก (ปิดโหมดแก้) ค่อยทำงาน · ไม่รอแล้วหน้า Company Profile / Default Setting กลับเป็นโหมดดู
      // พร้อมค่าเก่าอยู่ 1–3 วินาที และถ้ากด Edit แล้ว Save ซ้ำในช่วงนั้นจะส่ง doc_version เก่าไปชน 409
      return queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.BUSINESS_UNIT_DETAIL, buId],
      });
    },
  });
}
