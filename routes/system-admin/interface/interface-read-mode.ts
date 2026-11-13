import { createContext, useContext } from "react";

/**
 * โหมดอ่านของหน้า interface (ก่อนกด Edit) — `InterfacePageLayout` เป็นผู้ให้ค่า
 *
 * field ใน `interface-fields.tsx` ใช้ค่านี้เลือกว่าจะแสดงค่าเป็นข้อความ (โหมดอ่าน) หรือเป็น
 * ช่องกรอก (โหมดแก้) — form component อ่านเองไม่ได้ เพราะมันเป็นแม่ของ provider
 */
export const InterfaceReadModeContext = createContext(false);

/** @returns true เมื่อหน้ากำลังอยู่ในโหมดอ่าน */
export function useInterfaceReadMode() {
  return useContext(InterfaceReadModeContext);
}
