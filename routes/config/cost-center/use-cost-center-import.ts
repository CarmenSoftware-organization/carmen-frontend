import { useApiMutation } from "@/hooks/use-api-mutation";
import { httpClient } from "@/lib/http-client";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";

/**
 * ผลลัพธ์ของการนำเข้าศูนย์ต้นทุน — ตัวนับกับรายการแถวที่ผิด
 *
 * ฝั่ง backend เขียนแบบ all-or-nothing: ถ้ามีแถวผิดแม้แถวเดียวจะไม่เขียนอะไรเลย
 * และตอบ 400 พร้อม `errors` ชุดเดียวกันนี้ `in_use` คือจำนวนที่ไม่ถูกลบเพราะยังถูกใช้งาน
 */
export interface CostCenterImportResult {
  summary: {
    total_rows: number;
    created: number;
    updated: number;
    skipped: number;
    deleted: number;
    in_use: number;
    errors: number;
  };
  errors: { row: number; column?: string; message: string }[];
  deleted_codes: string[];
  in_use_codes: string[];
}

/**
 * ดึงศูนย์ต้นทุนจาก Carmen 4 ตามคอนฟิก `interface_accounting_carmen_gl` ของ BU
 *
 * **ไม่รับพารามิเตอร์ใด ๆ โดยตั้งใจ** — นโยบายรหัสซ้ำ/รหัสที่มีเฉพาะฝั่งเราอยู่ใน
 * `sync_policy` ของคอนฟิกนั้น การกดปุ่มกับการรันตามกำหนดเวลาจึงให้ผลเหมือนกัน
 *
 * `skipGlobalErrorToast` เพราะปุ่ม import แสดง error เองพร้อมรายละเอียดแถวที่ผิด
 */
export function useImportCostCenterFromCarmenGl() {
  return useApiMutation<void, { data: CostCenterImportResult }>({
    mutationFn: (_vars, buCode) =>
      httpClient.post(API_ENDPOINTS.GL_COST_CENTERS_IMPORT_CARMEN_GL(buCode)),
    invalidateKeys: [QUERY_KEYS.COST_CENTERS],
    errorMessage: "Failed to import cost centers",
    meta: { skipGlobalErrorToast: true },
  });
}
