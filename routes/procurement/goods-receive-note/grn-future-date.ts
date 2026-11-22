import { isoToDateInput } from "@/lib/date-utils";

/**
 * วันที่รับสินค้ายังมาไม่ถึงหรือเปล่า — เทียบเป็น "วัน" ตามเวลาเครื่อง ไม่ใช่เวลาเป๊ะ ๆ
 *
 * ใช้ถามผู้ใช้ก่อน Save / Commit เท่านั้น ไม่บล็อก: หลังบ้านรับใบที่ลงวันที่ในงวดถัดไปที่เปิดอยู่
 * ได้ตามแบบ (ใบ AVG รอการยกยอดก่อนลงสต๊อก) แต่ใบที่ลงวันที่รับล่วงหน้าแล้ว commit ทันที
 * ทำให้ Committed Date มาก่อน Rec Date (BLAVG GRN261100001: สร้าง + commit 21/10 ลงวันที่รับ 11/11)
 * รับ "วันนี้" ไม่นับว่าล่วงหน้า · เทียบผ่าน `isoToDateInput` ไม่ใช่ตัดสตริง ISO เพราะค่าที่เก็บเป็น UTC
 * — วันที่เลือกจากปฏิทินบนเครื่อง UTC+7 เก็บเป็น 17:00Z ของวันก่อนหน้า (เหตุผลเดียวกับ `isExpiredOn`)
 *
 * @param grnDate - วันที่รับสินค้าบนใบ (ISO) ว่าง = ยังไม่กรอก = ไม่ถาม
 * @param today - วันที่ใช้เทียบ ค่าเริ่มต้นคือวันนี้
 * @returns true เมื่อวันที่รับอยู่หลังวันนี้
 */
export function isFutureReceiveDate(
  grnDate: string | null | undefined,
  today: Date = new Date(),
): boolean {
  if (!grnDate) return false;
  const day = isoToDateInput(grnDate);
  if (!day) return false;
  return day > isoToDateInput(today.toISOString());
}
