import { CalendarX, HardDrive, Lock, Users } from "lucide-react";
import type { DeniedReason } from "@/components/permission-denied-dialog";

interface DeniedReasonIconProps {
  readonly reason: Exclude<DeniedReason, "permission">;
}

/**
 * ไอคอนของเหตุผล `"license"` / `"expired"` ใน `PermissionDeniedDialog`
 *
 * แยกออกมาเป็นไฟล์ต่างหาก (แทนที่จะเป็น ternary เดียวในไฟล์เดิม) เพื่อให้
 * path `reason === "permission"` ใน `permission-denied-dialog.tsx` เหลือ
 * `<ShieldOff>` ตัวเดิมพร้อม class สีแดงเดิมไม่ถูกแตะเลยแม้บรรทัดเดียว —
 * `permission-denied-dialog.test.tsx` (describe "chrome stays flat and
 * single-signal") ล็อกสตริงต้นฉบับของไฟล์นั้นตรง ๆ (นับจำนวนครั้งที่ Tailwind
 * class สีแดงปรากฏ + เช็คบรรทัด `<ShieldOff>` เป๊ะ) เพื่อกันสัญญาณสีแดงซ้อน
 * หลายจุดกลับมา (ประวัติเก่าเคยมี 9 จุด)
 *
 * สีแดงยังอยู่ที่ไอคอนจุดเดียวเหมือนเดิมตาม docs/DESIGN.md แค่ย้ายมาไว้คนละไฟล์
 * — `permission-denied-icon.test.tsx` ล็อกไฟล์นี้ด้วยกติกาเดียวกัน เพราะการ
 * แยกไฟล์ทำให้ describe ข้างต้นไม่คุ้มครองไฟล์นี้อีกต่อไป
 *
 * เพิ่ม `"seat"` (Task 5.3, SEAT_LIMIT_EXCEEDED) ด้วย `Users` — ยังใช้ class สีแดงเดิม
 * เส้นเดียวกับสองเหตุผลก่อนหน้า (ไม่เพิ่มจำนวนครั้งที่คำนั้นปรากฏในไฟล์นี้เลย ไม่ว่าจะมีกี่
 * reason ก็ตาม) ไม่กระทบเทสต์ "chrome stays flat and single-signal" ด้านล่าง
 */
export function DeniedReasonIcon({ reason }: DeniedReasonIconProps) {
  const Icon =
    reason === "license"
      ? Lock
      : reason === "seat"
        ? Users
        : reason === "storage"
          ? HardDrive
          : CalendarX;
  return <Icon className="text-destructive" aria-hidden />;
}
