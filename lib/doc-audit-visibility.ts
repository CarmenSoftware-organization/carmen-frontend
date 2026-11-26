import { resolveBuConfigValue } from "@/lib/print-form-config";
import type { BusinessUnitDetail } from "@/types/business-unit";

/**
 * สวิตช์แสดงตาราง audit ในการ์ดหัวเอกสาร — ตั้งราย BU ที่หน้า Default Setting (section General)
 * registry คู่กันอยู่ที่ routes/system-admin/company-profile/company-profile-config-registry.ts
 * ค่าตั้งต้นเปิดทั้งคู่: ไม่เคยตั้ง / ยังโหลด config ไม่เสร็จ = แสดง (เหมือนก่อนมีสวิตช์)
 */
export const DOC_AUDIT_SHOW_KEY = "general.show-doc-audit";
export const DOC_REVISION_SHOW_KEY = "general.show-doc-revision";

export interface DocAuditVisibility {
  /** แถว "สร้างโดย / แก้ไขล่าสุดโดย" */
  readonly showAudit: boolean;
  /** ช่อง rev.x */
  readonly showRevision: boolean;
}

/** ปิดเฉพาะเมื่อ BU ตั้งเป็น "false" ชัด ๆ */
export function resolveDocAuditVisibility(
  config: BusinessUnitDetail["config"] | undefined,
): DocAuditVisibility {
  return {
    showAudit: resolveBuConfigValue(config, DOC_AUDIT_SHOW_KEY) !== "false",
    showRevision:
      resolveBuConfigValue(config, DOC_REVISION_SHOW_KEY) !== "false",
  };
}
