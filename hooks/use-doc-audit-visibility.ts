import { useBusinessUnit } from "@/hooks/use-business-unit";
import { useProfile } from "@/hooks/use-profile";
import {
  resolveDocAuditVisibility,
  type DocAuditVisibility,
} from "@/lib/doc-audit-visibility";

const HIDDEN: DocAuditVisibility = { showAudit: false, showRevision: false };

/**
 * สวิตช์แสดง audit / rev. ในหัวเอกสารของ BU ที่ใช้งานอยู่ (หน้า Default Setting)
 * ระหว่างโหลด config ครั้งแรก = ซ่อนไว้ก่อน — BU ที่ปิดไว้จะไม่เห็นตารางแวบขึ้นมา
 * (cache อุ่นตั้งแต่เข้าแอปโดย `BusinessUnitPrefetch` จึงแทบไม่เคยรอ) · โหลดพลาด / ไม่มี BU
 * ปัจจุบัน (404) = กลับไปใช้ค่าตั้งต้น คือแสดงทั้งคู่
 */
export function useDocAuditVisibility(): DocAuditVisibility {
  const { defaultBu } = useProfile();
  const { data: businessUnit, isLoading } = useBusinessUnit(defaultBu?.id);
  if (isLoading) return HIDDEN;
  return resolveDocAuditVisibility(businessUnit?.config);
}
