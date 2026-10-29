import { isoToDateInput } from "@/lib/date-utils";
import type { GrnFormValues } from "./grn-form-schema";

type GrnLine = GrnFormValues["items"][number];

/**
 * วันหมดอายุผ่านไปแล้วหรือยัง — เทียบเป็น "วัน" ตามเวลาเครื่อง ไม่ใช่เวลาเป๊ะ ๆ
 *
 * หมดอายุ "วันนี้" ยังไม่นับว่าหมด (ยังขาย/ใช้ได้ทั้งวัน) · เทียบผ่าน `isoToDateInput`
 * ไม่ใช่ตัดสตริง ISO เพราะค่าที่เก็บเป็น UTC — วันที่เลือกจากปฏิทินบนเครื่อง UTC+7
 * เก็บเป็น 17:00Z ของวันก่อนหน้า ตัดสตริงดิบจะได้คนละวัน
 *
 * @param expiredAt - วันหมดอายุของบรรทัด (ISO) ว่าง = ไม่ได้กรอก = ไม่นับ
 * @param today - วันที่ใช้เทียบ ค่าเริ่มต้นคือวันนี้
 * @returns true เมื่อวันหมดอายุอยู่ก่อนวันนี้
 */
export function isExpiredOn(
  expiredAt: string | null | undefined,
  today: Date = new Date(),
): boolean {
  if (!expiredAt) return false;
  const day = isoToDateInput(expiredAt);
  if (!day) return false;
  return day < isoToDateInput(today.toISOString());
}

/**
 * บรรทัดที่กรอกวันหมดอายุเป็นวันที่ผ่านมาแล้ว — ใช้ถามผู้ใช้ก่อนสร้างใบและก่อน commit
 *
 * เตือนอย่างเดียว ไม่บล็อก: ผู้ใช้ยืนยันแล้วบันทึกต่อได้ (ของที่รับมาอาจหมดอายุจริง
 * และต้องลงรับไว้ก่อนเพื่อทำเรื่องคืน)
 *
 * @param items - รายการในฟอร์ม
 * @param today - วันที่ใช้เทียบ ค่าเริ่มต้นคือวันนี้
 * @returns บรรทัดที่หมดอายุแล้ว ตามลำดับในฟอร์ม
 */
export function findExpiredLines(
  items: readonly GrnLine[] | undefined,
  today: Date = new Date(),
): GrnLine[] {
  return (items ?? []).filter((item) => isExpiredOn(item.expired_at, today));
}
