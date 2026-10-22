import type { PosImportStatus } from "./pos-sale-types";

/** สีของ dot สถานะการนำเข้า */
export type ImportStatusTone = "success" | "warning" | "destructive";

/** สถานะการยืนยันตัดสต็อกของการนำเข้าหนึ่งรายการ */
export type ConfirmationState =
  | "replaced"
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
 * ถูกเขียนทับ (ยกเลิกพร้อม `replaced_by_id`) → `replaced` · ถูกยกเลิก → `cancelled` · ไม่ใช่ `success` → `not_applicable` (ไม่มีอะไรให้ยืนยัน)
 * · ยืนยันแล้ว 0 บรรทัด → `pending` · ยืนยันบางส่วน → `partial` · ครบ → `confirmed`
 *
 * @param row - ฟิลด์ที่ใช้ตัดสินจากแถวประวัติ
 * @returns สถานะการยืนยัน
 */
export function confirmationState(row: {
  status: PosImportStatus;
  cancelled_at: string | null;
  replaced_by_id: string | null;
  line_count: number;
  confirmed_line_count: number;
}): ConfirmationState {
  if (row.cancelled_at !== null && row.replaced_by_id !== null) {
    return "replaced";
  }
  if (row.cancelled_at !== null) return "cancelled";
  if (row.status !== "success") return "not_applicable";
  if (row.confirmed_line_count === 0) return "pending";
  if (row.confirmed_line_count < row.line_count) return "partial";
  return "confirmed";
}

/**
 * path ของใบ Stock Out ที่การยืนยันตัดสต็อกสร้าง
 *
 * @param stockOutId id ของใบ Stock Out
 * @returns path หน้ารายละเอียดใบปรับสต็อกแบบขาออก
 */
export function stockOutPath(stockOutId: string): string {
  return `/inventory-management/inventory-adjustment/${stockOutId}?type=stock-out`;
}

/**
 * ป้ายสถานะการนำเข้า — สถานะที่ยังไม่มีข้อความแปล (backend เพิ่มใหม่) ใช้ค่าดิบแทนการขึ้นชื่อคีย์
 *
 * @param t - translator ของ `posSale.importStatus`
 * @param status - สถานะที่ backend คืนมา
 * @returns ข้อความที่แปลแล้ว หรือสถานะดิบเมื่อไม่มีคีย์
 */
export function importStatusLabel(
  t: { (key: string): string; has?: (key: string) => boolean },
  status: string,
): string {
  return t.has?.(status) === false ? status : t(status);
}

/**
 * perpage ที่ส่งให้ backend — อ่านจาก URL ได้ค่าใดก็ได้ จึงบีบให้อยู่ใน 1..100
 *
 * @param perpage - ค่า perpage จาก `useDataGridState`
 * @param fallback - ค่าเมื่อไม่ใช่ตัวเลข
 * @returns จำนวนเต็ม 1..100
 */
export function clampPerpage(perpage: unknown, fallback: number): number {
  const n = Math.trunc(Number(perpage));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 100) : fallback;
}
