import { z } from "zod";
import type { TranslationFn } from "@/lib/i18n-schema";

export function createCostCenterSchema(tv: TranslationFn, tf: TranslationFn) {
  return z.object({
    code: z
      .string()
      .trim()
      .min(1, tv("required", { field: tf("code") })),
    name: z
      .string()
      .trim()
      .min(1, tv("required", { field: tf("name") })),
    // ไม่บังคับ — "" = ไม่ระบุกลุ่ม (ส่งเป็น null)
    cost_center_group_id: z.string(),
    description: z.string().optional(),
    note: z.string().optional(),
    is_active: z.boolean(),
  });
}

export type CostCenterFormValues = z.infer<
  ReturnType<typeof createCostCenterSchema>
>;
