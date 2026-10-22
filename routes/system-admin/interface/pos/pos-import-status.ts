import type { PosImportStatus } from "./pos-sale-types";

/** สีของ dot สถานะการนำเข้า */
export type ImportStatusTone = "success" | "warning" | "destructive";

/** สถานะการยืนยันตัดสต็อกของการนำเข้าหนึ่งรายการ */
export type ConfirmationState =
  | "cancelled"
  | "not_applicable"
  | "pending"
  | "partial"
  | "confirmed";

/**
 * สีสถานะของผลการนำเข้า
 *
 * `success` = เขียว · ไฟล์ซ้ำ (`rejected_duplicate`) = เหลือง
 * เพราะไม่ใช่ความผิดพลาด แค่มีของเดิมอยู่แล้ว · ที่เหลือ = แดง
 *
 * @param status - สถานะที่ backend คืนมา
 * @returns tone สำหรับ `StatusDotBadge`
 */
export function importStatusTone(status: PosImportStatus): ImportStatusTone {
  if (status === "success") return "success";
  if (status === "rejected_duplicate") return "warning";
  return "destructive";
}

/**
 * สถานะการยืนยันตัดสต็อกของแถวประวัติ
 *
 * ถูกยกเลิก → `cancelled` · ไม่ใช่ `success` → `not_applicable` (ไม่มีอะไรให้ยืนยัน)
 * · ยืนยันแล้ว 0 บรรทัด → `pending` · ยืนยันบางส่วน → `partial` · ครบ → `confirmed`
 *
 * @param row - ฟิลด์ที่ใช้ตัดสินจากแถวประวัติ
 * @returns สถานะการยืนยัน
 */
export function confirmationState(row: {
  status: PosImportStatus;
  cancelled_at: string | null;
  line_count: number;
  confirmed_line_count: number;
}): ConfirmationState {
  if (row.cancelled_at !== null) return "cancelled";
  if (row.status !== "success") return "not_applicable";
  if (row.confirmed_line_count === 0) return "pending";
  if (row.confirmed_line_count < row.line_count) return "partial";
  return "confirmed";
}
