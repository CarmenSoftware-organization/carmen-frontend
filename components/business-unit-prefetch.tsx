import { useBusinessUnit } from "@/hooks/use-business-unit";
import { useProfile } from "@/hooks/use-profile";

/**
 * โหลด BU detail (config ราย BU) ครั้งเดียวตอนเข้าแอป ให้ cache อุ่นก่อนเปิดหน้าเอกสาร —
 * หัวเอกสารทุกหน้าอ่านสวิตช์แสดง audit / rev. จาก query นี้ (hooks/use-doc-audit-visibility.ts)
 * จึงไม่ต้องรอ request ของตัวเองตอนเปิดหน้า · คอมโพเนนต์แยกไว้ไม่ให้ shell re-render ตาม query
 */
export function BusinessUnitPrefetch() {
  const { defaultBu } = useProfile();
  useBusinessUnit(defaultBu?.id);
  return null;
}
