import { useBusinessUnit } from "@/hooks/use-business-unit";
import { useProfile } from "@/hooks/use-profile";
import { RECIPE_CARD_PORTRAIT_TEMPLATE_ID } from "@/lib/print-document";
import { resolvePrintFormTemplateId } from "@/lib/print-form-config";
import type { BusinessUnitDetail } from "@/types/business-unit";

/**
 * template ที่ปุ่ม Print หน้าสูตรใช้ — BU เลือกที่ Default Setting → แบบฟอร์มการพิมพ์ → Recipe
 * (ตัวเลือกคือ template กลุ่ม "Recipe" ที่ admin สร้างใน platform เหมือนแถว PR / PO)
 * ยังไม่ได้เลือก = Recipe Card Report Portrait ของระบบ
 *
 * Recipe ไม่มี endpoint พิมพ์เฉพาะที่ backend เลือก template ให้แบบเอกสารอื่น ค่าเริ่มต้นจึงอยู่ที่นี่
 * · เดิมมี dropdown แนวกระดาษ / ไม่พิมพ์วิธีทำ / ไม่พิมพ์วัตถุดิบ ของตัวเอง — เลิกแล้ว
 * แต่ละแบบให้ทำเป็น template แยกใน platform แทน
 *
 * @param config - `config` จาก BusinessUnitDetail
 * @returns report template id
 */
export function recipePrintTemplateId(
  config: BusinessUnitDetail["config"] | undefined,
): string {
  return (
    resolvePrintFormTemplateId(config, "RECIPE") ??
    RECIPE_CARD_PORTRAIT_TEMPLATE_ID
  );
}

/** template ของ BU ที่ใช้งานอยู่ (BU เดียวกับที่ usePrintDocument อ่านใบพิมพ์) */
export function useRecipePrintTemplateId(): string {
  const { defaultBu } = useProfile();
  const { data: businessUnit } = useBusinessUnit(defaultBu?.id);
  return recipePrintTemplateId(businessUnit?.config);
}
