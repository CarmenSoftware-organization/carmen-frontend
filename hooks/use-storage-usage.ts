import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { httpClient } from "@/lib/http-client";
import type { BuStorageUsage } from "@/types/storage-usage";

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * ผลวัดพื้นที่เก็บข้อมูล (database + ไฟล์แนบ) ของ BU ปัจจุบัน — ใช้ร่วมกันระหว่างแถบเตือน
 * ใน root-layout กับหน้า `/system-admin/document` จึงอยู่ใน `hooks/`
 *
 * โหลดไม่สำเร็จ (รวมกรณี api_name ยังไม่อยู่ใน allowlist) = `data` เป็น undefined เงียบ ๆ
 * ผู้เรียกต้องไม่แสดงอะไร ไม่ใช่ error state
 */
export function useStorageUsage() {
  const buCode = useBuCode();

  return useQuery<BuStorageUsage>({
    queryKey: [QUERY_KEYS.STORAGE_USAGE, buCode],
    queryFn: async () => {
      if (!buCode) throw new Error("Missing buCode");
      const res = await httpClient.get(API_ENDPOINTS.STORAGE_USAGE(buCode));
      if (!res.ok) throw new Error("Failed to fetch storage usage");
      const json = await res.json();
      return json.data as BuStorageUsage;
    },
    staleTime: FIVE_MINUTES,
    refetchOnWindowFocus: true,
    enabled: !!buCode,
    retry: false,
  });
}

/**
 * สั่งวัดพื้นที่ใหม่ทันที — backend ตอบ 429 ถ้าวัดไปแล้วภายใน 10 นาที (httpClient โยน
 * `ApiError` status 429) ผู้เรียกใช้ `error` ปิดปุ่ม
 */
export function useMeasureStorage() {
  const buCode = useBuCode();
  const queryClient = useQueryClient();

  return useMutation<BuStorageUsage>({
    mutationFn: async () => {
      if (!buCode) throw new Error("Missing buCode");
      const res = await httpClient.post(
        API_ENDPOINTS.STORAGE_USAGE_MEASURE(buCode),
      );
      if (!res.ok) throw new Error("Failed to measure storage");
      const json = await res.json();
      return json.data as BuStorageUsage;
    },
    onSuccess: (data) => {
      queryClient.setQueryData([QUERY_KEYS.STORAGE_USAGE, buCode], data);
    },
  });
}
