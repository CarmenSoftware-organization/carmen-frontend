import { z } from "zod";
import type { FieldArrayWithId } from "react-hook-form";
import type { TranslationFn } from "@/lib/i18n-schema";
import { priceListTaxParts } from "@/lib/price-list-tax";
import type { PriceList } from "@/types/price-list";

function createPriceListDetailSchema(tv: TranslationFn, tf: TranslationFn) {
  return z.object({
    id: z.string().optional(),
    doc_version: z.coerce.number().optional(),
    product_id: z.string().min(1, tv("required", { field: tf("product") })),
    unit_id: z.string().min(1, tv("required", { field: tf("unit") })),
    moq_qty: z.coerce.number().min(0),
    price: z.coerce.number().min(0),
    price_without_tax: z.coerce.number().min(0),
    tax_profile_id: z
      .string()
      .min(1, tv("required", { field: tf("taxProfile") })),
    tax_rate: z.coerce.number().min(0),
    tax_amt: z.coerce.number().min(0),
    lead_time_days: z.coerce.number().min(0),
    is_preferred: z.boolean(),
  });
}

export function createPriceListSchema(tv: TranslationFn, tf: TranslationFn) {
  return z
    .object({
      name: z.string().min(1, tv("required", { field: tf("name") })),
      description: z.string(),
      status: z.enum(["draft", "submitted", "active", "inactive"]),
      vendor_id: z.string().min(1, tv("required", { field: tf("vendor") })),
      currency_id: z.string().min(1, tv("required", { field: tf("currency") })),
      effective_from_date: z
        .string()
        .min(1, tv("required", { field: tf("startDate") })),
      effective_to_date: z
        .string()
        .min(1, tv("required", { field: tf("endDate") })),
      note: z.string(),
      pricelist_detail: z.array(createPriceListDetailSchema(tv, tf)),
    })
    .refine(
      (data) =>
        !data.effective_from_date ||
        !data.effective_to_date ||
        new Date(data.effective_to_date) >= new Date(data.effective_from_date),
      {
        message: tv("endDateAfterStart"),
        path: ["effective_to_date"],
      },
    )
    .superRefine((data, ctx) => {
      // MOQ tier ต่อ product+unit เดียวกัน: ชั้นที่ MOQ สูงกว่าต้องราคาไม่แพงกว่า
      const groups = new Map<string, number[]>();
      data.pricelist_detail.forEach((d, i) => {
        const key = `${d.product_id}::${d.unit_id}`;
        const bucket = groups.get(key);
        if (bucket) bucket.push(i);
        else groups.set(key, [i]);
      });
      for (const indices of groups.values()) {
        const sorted = [...indices].sort(
          (a, b) =>
            data.pricelist_detail[a].moq_qty - data.pricelist_detail[b].moq_qty,
        );
        for (let k = 1; k < sorted.length; k++) {
          const prev = data.pricelist_detail[sorted[k - 1]];
          const cur = data.pricelist_detail[sorted[k]];
          if (cur.moq_qty === prev.moq_qty) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: tv("moqDuplicate"),
              path: ["pricelist_detail", sorted[k], "moq_qty"],
            });
          } else if (cur.price > prev.price) {
            // เทียบ price (gross) ที่ vendor กรอกจริง — MOQ สูงกว่าต้องราคาไม่แพงกว่า
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: tv("moqTierPrice"),
              path: ["pricelist_detail", sorted[k], "price"],
            });
          }
        }
      }
    });
}

export type PriceListFormValues = z.infer<
  ReturnType<typeof createPriceListSchema>
>;

export type PriceListDetailField = FieldArrayWithId<
  PriceListFormValues,
  "pricelist_detail",
  "id"
>;

const EMPTY_FORM: PriceListFormValues = {
  name: "",
  description: "",
  status: "draft",
  vendor_id: "",
  currency_id: "",
  effective_from_date: "",
  effective_to_date: "",
  note: "",
  pricelist_detail: [],
};

export function getDefaultValues(
  priceList?: PriceList,
  options?: { defaultCurrencyId?: string },
): PriceListFormValues {
  if (priceList) {
    const parts = priceList.effectivePeriod.split(" - ");
    // เก็บ ISO string ดิบไว้ (แค่ validate ว่า parse ได้) — อย่า round-trip ผ่าน
    // toISOString().split() เพราะมันบีบเป็น UTC date ทำให้ effective date หล่นไป 1 วัน
    // บน timezone บวก (UTC+7) เทียบกับ list ที่ formatDate() อ่าน local ตรง ๆ
    const fmt = (s: string) => {
      const trimmed = s.trim();
      return Number.isNaN(new Date(trimmed).getTime()) ? "" : trimmed;
    };
    const from = parts.length === 2 ? fmt(parts[0]) : "";
    const to = parts.length === 2 ? fmt(parts[1]) : "";

    return {
      name: priceList.name,
      description: priceList.description ?? "",
      status: priceList.status as PriceListFormValues["status"],
      vendor_id: priceList.vendor?.id ?? "",
      currency_id: priceList.currency?.id ?? "",
      effective_from_date: from,
      effective_to_date: to,
      note: priceList.note ?? "",
      pricelist_detail:
        priceList.pricelist_detail?.map((d) => ({
          id: d.id,
          doc_version: d.doc_version,
          product_id: d.product?.id ?? "",
          unit_id: d.unit?.id ?? "",
          moq_qty: d.moq_qty,
          price: d.price,
          price_without_tax: d.price_without_tax,
          tax_profile_id: d.tax_profile?.id ?? "",
          tax_rate: d.tax_rate ?? 0,
          tax_amt: d.tax_amt,
          lead_time_days: d.lead_time_days,
          is_preferred: d.is_preferred ?? false,
        })) ?? [],
    };
  }

  return {
    ...EMPTY_FORM,
    currency_id: options?.defaultCurrencyId ?? "",
  };
}

export const PRICE_LIST_DETAIL_EMPTY = {
  product_id: "",
  unit_id: "",
  moq_qty: 1,
  price: 0,
  price_without_tax: 0,
  tax_profile_id: "",
  tax_rate: 0,
  tax_amt: 0,
  lead_time_days: 0,
  is_preferred: false,
} satisfies PriceListFormValues["pricelist_detail"][number];

export function mapDetailToPayload(
  d: PriceListFormValues["pricelist_detail"][number],
  index: number,
) {
  // Input คือ price ก่อนภาษี (add VAT) — derive tax_amt ที่ submit
  // (cell ไม่ sync field พวกนี้ระหว่างพิมพ์) · price_without_tax = price
  const { price, priceWithoutTax, taxAmt } = priceListTaxParts(
    d.price,
    d.tax_rate,
  );
  return {
    ...(d.doc_version != null ? { doc_version: d.doc_version } : {}),
    sequence_no: index + 1,
    product_id: d.product_id,
    price,
    price_without_tax: priceWithoutTax,
    unit_id: d.unit_id,
    tax_profile_id: d.tax_profile_id || "",
    tax_rate: d.tax_rate,
    tax_amt: taxAmt,
    lead_time_days: d.lead_time_days,
    moq_qty: d.moq_qty,
    is_preferred: d.is_preferred,
  };
}
