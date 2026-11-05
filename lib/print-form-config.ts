import type { PrintDocumentType } from "@/lib/print-document";
import type {
  BusinessUnitConfigItem,
  BusinessUnitDetail,
} from "@/types/business-unit";

/**
 * document type ที่ตั้งค่าแบบฟอร์มการพิมพ์ได้ — ลำดับเดียวกับที่แสดงในหน้า
 * Default Setting และตรงกับ `report_group` ของ report template ฝั่ง backend
 */
export const PRINT_FORM_DOCUMENT_TYPES: readonly PrintDocumentType[] = [
  "PR",
  "PO",
  "GRN",
  "SR",
  "CN",
  "SI",
  "SO",
  "IA",
  "PC",
  "SC",
  "RFP",
  "EOP",
] as const;

export function printFormConfigKey(type: PrintDocumentType): string {
  return `print-form.${type.toLowerCase()}`;
}

/**
 * อ่าน report template id ที่ BU ตั้งไว้สำหรับ document type นั้น
 *
 * ค่าว่างหรือไม่มี key = ยังไม่ได้ตั้งค่า → คืน undefined เพื่อให้ backend ใช้
 * mapping เริ่มต้นตามเดิม (GET อาจคืน config เป็น `{}` จึงต้องเช็ค isArray)
 *
 * @param config - `config` จาก BusinessUnitDetail
 * @param type - document type ที่กำลังจะพิมพ์
 * @returns UUID ของ report template หรือ undefined
 */
export function resolvePrintFormTemplateId(
  config: BusinessUnitDetail["config"] | undefined,
  type: PrintDocumentType,
): string | undefined {
  return resolveBuConfigValue(config, printFormConfigKey(type));
}

/**
 * อ่านค่า config ของ BU ตาม key — ค่าว่างหรือไม่มี key = ยังไม่ได้ตั้ง → undefined
 * (ผู้เรียกใช้ค่าเริ่มต้นของ registry เอง) · GET อาจคืน config เป็น `{}` จึงต้องเช็ค isArray
 *
 * @param config - `config` จาก BusinessUnitDetail
 * @param key - config key เช่น `print-form.pr`, `recipe.print-orientation`
 * @returns ค่าที่ตั้งไว้ หรือ undefined
 */
export function resolveBuConfigValue(
  config: BusinessUnitDetail["config"] | undefined,
  key: string,
): string | undefined {
  if (!Array.isArray(config)) return undefined;
  const value = (config as BusinessUnitConfigItem[]).find(
    (i) => i.key === key,
  )?.value;
  return value ? value : undefined;
}
