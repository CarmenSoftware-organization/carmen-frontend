import { useBusinessUnit } from "@/hooks/use-business-unit";
import { useProfile } from "@/hooks/use-profile";
import {
  RECIPE_CARD_LANDSCAPE_TEMPLATE_ID,
  RECIPE_CARD_TEMPLATE_ID,
} from "@/lib/print-document";
import { resolveBuConfigValue } from "@/lib/print-form-config";
import type { BusinessUnitDetail } from "@/types/business-unit";

export interface RecipePrintFormat {
  /** แนวตั้ง = Recipe Card Report (ตัวเดียวกับหน้ารายการรายงาน) · แนวนอน = Recipe Card Report Landscape */
  templateId: string;
  /** micro-report ใส่ค่านี้ลงทุกแถว · "N" = template ไม่พิมพ์ส่วนนั้น */
  filters: { ShowPreparation: "Y" | "N"; ShowIngredients: "Y" | "N" };
}

/**
 * รูปแบบการพิมพ์ Recipe Card จาก Default Setting ของ BU (หมวด Print Forms แถว Recipe) — ยังไม่ได้ตั้ง =
 * ค่าเริ่มต้นของ registry (แนวตั้ง แสดงครบ)
 *
 * `recipe.print-content`: `all` แสดงครบ · `preparation` ข้อมูล + วิธีทำ · `ingredients` ข้อมูล + วัตถุดิบ
 * (ส่วนข้อมูลสูตร รูป ต้นทุน และ Remark พิมพ์ทุกแบบ)
 *
 * @param config - `config` จาก BusinessUnitDetail
 * @returns template ที่จะพิมพ์ และตัวเลือกที่ส่งไปกับ filters
 */
export function recipePrintFormat(
  config: BusinessUnitDetail["config"] | undefined,
): RecipePrintFormat {
  const content = resolveBuConfigValue(config, "recipe.print-content");
  return {
    templateId:
      resolveBuConfigValue(config, "recipe.print-orientation") === "landscape"
        ? RECIPE_CARD_LANDSCAPE_TEMPLATE_ID
        : RECIPE_CARD_TEMPLATE_ID,
    filters: {
      ShowPreparation: content === "ingredients" ? "N" : "Y",
      ShowIngredients: content === "preparation" ? "N" : "Y",
    },
  };
}

/** รูปแบบการพิมพ์ Recipe Card ของ BU ที่ใช้งานอยู่ (BU เดียวกับที่ usePrintDocument อ่านใบพิมพ์) */
export function useRecipePrintFormat(): RecipePrintFormat {
  const { defaultBu } = useProfile();
  const { data: businessUnit } = useBusinessUnit(defaultBu?.id);
  return recipePrintFormat(businessUnit?.config);
}
