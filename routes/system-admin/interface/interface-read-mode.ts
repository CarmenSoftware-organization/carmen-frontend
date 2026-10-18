import { createContext, useContext } from "react";

/**
 * โหมดอ่านของหน้า interface (ก่อนกด Edit) — `InterfacePageLayout` เป็นผู้ให้ค่า
 *
 * field ใช้ค่านี้แทน placeholder ตัวอย่าง (เช่น `1000`, "Select GL Account") ด้วย
 * `READ_MODE_EMPTY` เพื่อให้ช่องที่ยังไม่ตั้งค่าทุกชนิดแสดงเหมือนกันว่า "ว่าง" — ตัวอย่างใน
 * โหมดอ่านดูเหมือนค่าที่ตั้งไว้จริง ส่วนคำสั่ง "Select …" ชวนให้กดทั้งที่ช่องถูกปิดอยู่
 */
export const InterfaceReadModeContext = createContext(false);

/** ข้อความของช่องว่างในโหมดอ่าน */
export const READ_MODE_EMPTY = "—";

/** @returns true เมื่อหน้ากำลังอยู่ในโหมดอ่าน */
export function useInterfaceReadMode() {
  return useContext(InterfaceReadModeContext);
}
