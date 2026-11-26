import { useBusinessUnit } from "@/hooks/use-business-unit";
import { useProfile } from "@/hooks/use-profile";
import {
  resolveDocAuditVisibility,
  type DocAuditVisibility,
} from "@/lib/doc-audit-visibility";

/** สวิตช์แสดง audit / rev. ในหัวเอกสารของ BU ที่ใช้งานอยู่ (หน้า Default Setting) */
export function useDocAuditVisibility(): DocAuditVisibility {
  const { defaultBu } = useProfile();
  const { data: businessUnit } = useBusinessUnit(defaultBu?.id);
  return resolveDocAuditVisibility(businessUnit?.config);
}
