import { isoToDateInput } from "@/lib/date-utils";

/** เหลือไม่เกินกี่วันถึงนับว่า "ใกล้ถึงรอบ" */
export const MAINTENANCE_DUE_SOON_DAYS = 14;

export type MaintenanceState = "overdue" | "due-soon" | "ok" | "unset";

export interface MaintenanceStatus {
  readonly state: MaintenanceState;
  /** จำนวนวันจากวันนี้ถึงวันนัด (ติดลบ = เลยมาแล้ว) · `unset` เป็น 0 */
  readonly days: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" → เลขวันแบบไม่มีเวลา (กัน DST/เวลาในวันทำให้ปัดเพี้ยน) */
function dayNumber(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/**
 * สถานะรอบซ่อมบำรุงจาก `next_maintenance_date`
 *
 * เทียบเป็น**วันตามปฏิทินท้องถิ่น** ไม่ใช่ช่วงเวลา — วันนัดวันนี้ต้องเป็น 0 วัน
 * ไม่ว่าตอนนี้กี่โมง · แปลงผ่าน `isoToDateInput` ตัวเดียวกับที่ date picker ใช้
 * จึงตรงกับวันที่ที่เห็นในฟอร์มเสมอ
 *
 * @param next - วันนัดซ่อมถัดไป (ISO หรือ YYYY-MM-DD) · ว่าง/อ่านไม่ออก = `unset`
 * @param today - วันอ้างอิง (ส่งเข้ามาได้เพื่อเทสต์)
 */
export function getMaintenanceStatus(
  next: string | null | undefined,
  today: Date = new Date(),
): MaintenanceStatus {
  const nextYmd = next ? isoToDateInput(next) : "";
  if (!nextYmd) return { state: "unset", days: 0 };

  const days =
    dayNumber(nextYmd) - dayNumber(isoToDateInput(today.toISOString()));
  if (days < 0) return { state: "overdue", days };
  if (days <= MAINTENANCE_DUE_SOON_DAYS) return { state: "due-soon", days };
  return { state: "ok", days };
}
