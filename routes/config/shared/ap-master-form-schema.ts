import { z } from "zod";
import type { TranslationFn } from "@/lib/i18n-schema";

function baseSchema(
  tv: TranslationFn,
  tf: TranslationFn,
  maxCode: number,
  maxDescription: number,
  slash = false,
) {
  return z.object({
    code: z
      .string()
      .trim()
      .min(1, tv("required", { field: tf("code") }))
      .max(maxCode, tv("maxLength", { field: tf("code"), max: maxCode }))
      .regex(
        slash ? /^[A-Z0-9/-]+$/ : /^[A-Z0-9-]+$/,
        tv("invalidFormat", { field: tf("code") }),
      ),
    description: z
      .string()
      .trim()
      .min(1, tv("required", { field: tf("description") }))
      .max(
        maxDescription,
        tv("maxLength", { field: tf("description"), max: maxDescription }),
      ),
    is_active: z.boolean(),
  });
}
const dimensions = z.array(
  z.object({
    dimension_id: z.string().uuid(),
    dimension_value_id: z.string().uuid(),
  }),
);
const mapping = {
  chart_of_accounts_id: z.string().uuid().nullable(),
  cost_center_id: z.string().uuid().nullable(),
  dimensions,
};

export function paymentTypeSchema(tv: TranslationFn, tf: TranslationFn) {
  return baseSchema(tv, tf, 10, 50)
    .extend({
      ...mapping,
      chart_of_accounts_id: z
        .string()
        .uuid(tv("required", { field: tf("glAccount") })),
      available_ap: z.boolean(),
      available_ar: z.boolean(),
      bank_account_id: z.string().uuid().nullable(),
      is_cheque: z.boolean(),
      cheque_form_id: z.string().uuid().nullable(),
    })
    .superRefine((value, ctx) => {
      if (!value.available_ap && !value.available_ar)
        ctx.addIssue({
          code: "custom",
          path: ["available_ap"],
          message: tv("required", { field: "AP / AR" }),
        });
      if (value.is_cheque && !value.cheque_form_id)
        ctx.addIssue({
          code: "custom",
          path: ["cheque_form_id"],
          message: tv("required", { field: tf("chequeForm") }),
        });
    });
}
export function whtFormSchema(tv: TranslationFn, tf: TranslationFn) {
  return baseSchema(tv, tf, 15, 100, true).extend(mapping);
}
export function whtServiceTypeSchema(tv: TranslationFn, tf: TranslationFn) {
  return baseSchema(tv, tf, 15, 255).extend({
    rate_percent: z
      .number()
      .min(0, tv("minNumber", { field: tf("rate"), min: 0 }))
      .max(100, tv("maxNumber", { field: tf("rate"), max: 100 }))
      .refine(
        (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.0000001,
        tv("invalidFormat", { field: tf("rate") }),
      ),
  });
}
export type PaymentTypeValues = z.infer<ReturnType<typeof paymentTypeSchema>>;
export type WhtFormValues = z.infer<ReturnType<typeof whtFormSchema>>;
export type WhtServiceTypeValues = z.infer<
  ReturnType<typeof whtServiceTypeSchema>
>;
