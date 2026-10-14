import { z } from "zod";
import type { TranslationFn } from "@/lib/i18n-schema";

export function createCostCenterGroupSchema(
  tv: TranslationFn,
  tf: TranslationFn,
) {
  return z.object({
    code: z
      .string()
      .trim()
      .min(1, tv("required", { field: tf("code") })),
    name: z
      .string()
      .trim()
      .min(1, tv("required", { field: tf("name") })),
    description: z.string().optional(),
    note: z.string().optional(),
    is_active: z.boolean(),
  });
}

export type CostCenterGroupFormValues = z.infer<
  ReturnType<typeof createCostCenterGroupSchema>
>;
