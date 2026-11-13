import { z } from "zod";
import type { TranslationFn } from "@/lib/i18n-schema";
import {
  CHART_OF_ACCOUNT_TYPE,
  ACCOUNT_NATURE,
  ACCOUNT_CATEGORIES,
  type AccountCategory,
} from "@/types/chart-of-accounts";

export function natureFor(category: AccountCategory): ACCOUNT_NATURE {
  return category === "liability" || category === "equity" || category === "revenue"
    ? ACCOUNT_NATURE.CREDIT
    : ACCOUNT_NATURE.DEBIT;
}

export function createCoaSchema(tv: TranslationFn, tf: TranslationFn) {
  return z.object({
    code: z.string().min(1, tv("required", { field: tf("code") })),
    description_1: z
      .string()
      .min(1, tv("required", { field: tf("description") })),
    // บรรทัดที่สองไม่บังคับ — ฟอร์มเก็บเป็น string ว่าง แล้วค่อยแปลงเป็น null ตอนส่ง
    description_2: z.string(),
    nature: z.enum(ACCOUNT_NATURE, {
      error: tv("required", { field: tf("nature") }),
    }),
    type: z.enum(CHART_OF_ACCOUNT_TYPE, {
      error: tv("required", { field: tf("type") }),
    }),
    category: z.enum(ACCOUNT_CATEGORIES, {
      error: tv("required", { field: tf("category") }),
    }),
    account_group_id: z.string(),
    req_cost_center: z.boolean().optional(),
    allowed_cost_center_codes: z.array(z.string()).optional(),
    req_dim: z.boolean().optional(),
    allowed_dimensions: z.array(z.string()).optional(),
    dimension_rules: z.record(z.string(), z.enum(["mandatory", "optional", "prohibited"])),
    attributes: z.record(z.string(), z.string()).optional(),
    grouping_path: z
      .array(
        z.object({
          code: z.string(),
          name: z.string(),
          level: z.number(),
        }),
      )
      .optional(),
    is_active: z.boolean(),
  });
}

export type CoaFormValues = z.infer<ReturnType<typeof createCoaSchema>>;
