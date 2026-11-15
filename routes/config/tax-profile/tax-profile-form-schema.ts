import { z } from "zod";
import type { TranslationFn } from "@/lib/i18n-schema";
import type { TaxProfile } from "@/types/tax-profile";

export function createTaxProfileSchema(tv: TranslationFn, tf: TranslationFn) {
  return z.object({
    name: z.string().min(1, tv("required", { field: tf("name") })),
    tax_rate: z.number().min(0, tv("taxRatePositive")),
    is_active: z.boolean(),
  });
}

export type TaxProfileFormValues = z.infer<
  ReturnType<typeof createTaxProfileSchema>
>;

export const EMPTY_FORM: TaxProfileFormValues = {
  name: "",
  tax_rate: 0,
  is_active: true,
};

export function getDefaultValues(
  taxProfile?: TaxProfile | null,
): TaxProfileFormValues {
  if (!taxProfile) return { ...EMPTY_FORM };
  return {
    name: taxProfile.name,
    tax_rate: taxProfile.tax_rate,
    is_active: taxProfile.is_active,
  };
}
