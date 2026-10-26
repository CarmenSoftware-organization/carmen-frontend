import { z } from "zod";
import { stableStringify } from "@/lib/form-helpers";
import type { TranslationFn } from "@/lib/i18n-schema";
import type {
  BusinessUnitConfigItem,
  BusinessUnitDetail,
  BusinessUnitNumberFormat,
  BusinessUnitPatch,
} from "@/types/business-unit";
import { SEEDED_ITEMS } from "./company-profile-config-registry";

const numberFormatSchema = z.object({
  locales: z.string(),
  minimumIntegerDigits: z.coerce.number().int(),
});

const configItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  datatype: z.string(),
  value: z.string(),
});

export function createBusinessSettingSchema(
  tv: TranslationFn,
  tf: TranslationFn,
) {
  const optionalEmail = z
    .string()
    .refine(
      (v) => v === "" || z.string().email().safeParse(v).success,
      tv("invalidEmail"),
    );

  return z.object({
    code: z.string().min(1, tv("required", { field: tf("code") })),
    name: z.string().min(1, tv("required", { field: tf("name") })),
    alias_name: z.string(),
    description: z.string(),
    info: z.string(),
    default_currency_id: z.string(),

    company_name: z.string(),
    company_address_line1: z.string(),
    company_address_line2: z.string(),
    company_sub_district: z.string(),
    company_district: z.string(),
    company_city: z.string(),
    company_province: z.string(),
    company_postal_code: z.string(),
    company_country: z.string(),
    company_latitude: z.string(),
    company_longitude: z.string(),
    company_email: optionalEmail,
    company_tel: z.string(),
    tax_no: z.string(),
    branch_no: z.string(),

    hotel_name: z.string(),
    hotel_address_line1: z.string(),
    hotel_address_line2: z.string(),
    hotel_sub_district: z.string(),
    hotel_district: z.string(),
    hotel_city: z.string(),
    hotel_province: z.string(),
    hotel_postal_code: z.string(),
    hotel_country: z.string(),
    hotel_latitude: z.string(),
    hotel_longitude: z.string(),
    hotel_email: optionalEmail,
    hotel_tel: z.string(),

    timezone: z.string(),
    date_format: z.string(),
    date_time_format: z.string(),
    time_format: z.string(),
    short_time_format: z.string(),
    long_time_format: z.string(),

    amount_format: numberFormatSchema,
    quantity_format: numberFormatSchema,
    recipe_format: numberFormatSchema,

    config: z.array(configItemSchema),
  });
}

export type BusinessSettingFormValues = z.infer<
  ReturnType<typeof createBusinessSettingSchema>
>;

export function normalizeConfig(
  config: BusinessUnitDetail["config"],
): BusinessUnitConfigItem[] {
  return Array.isArray(config) ? config : [];
}

/**
 * merge seeded config (จาก registry) เข้ากับ config จาก backend
 *
 * seed เฉพาะ key ที่ backend ยังไม่มี — ต่อท้าย ใช้ defaultValue + canonical label
 * pure/locale-independent → diff เสถียร (ไม่ false-dirty ตอนสลับ locale)
 *
 * @param items - config items จาก backend (ผ่าน normalizeConfig แล้ว)
 * @returns config items ที่รวม seeded items ที่ยังขาด
 */
export function mergeSeededConfig(
  items: BusinessUnitConfigItem[],
): BusinessUnitConfigItem[] {
  const existing = new Set(items.map((i) => i.key));
  const seeded = SEEDED_ITEMS.filter((s) => !existing.has(s.key)).map((s) => ({
    key: s.key,
    label: s.label,
    datatype: s.datatype,
    value: s.defaultValue,
  }));
  return [...items, ...seeded];
}

const emptyFormat: BusinessUnitNumberFormat = {
  locales: "",
  minimumIntegerDigits: 0,
};

export function toFormValues(
  data: BusinessUnitDetail,
): BusinessSettingFormValues {
  const s = (v: string | null) => v ?? "";
  return {
    code: data.code,
    name: data.name,
    alias_name: s(data.alias_name),
    description: s(data.description),
    info: s(data.info),
    default_currency_id: s(data.default_currency_id),

    company_name: s(data.company_name),
    company_address_line1: s(data.company_address_line1),
    company_address_line2: s(data.company_address_line2),
    company_sub_district: s(data.company_sub_district),
    company_district: s(data.company_district),
    company_city: s(data.company_city),
    company_province: s(data.company_province),
    company_postal_code: s(data.company_postal_code),
    company_country: s(data.company_country),
    company_latitude: s(data.company_latitude),
    company_longitude: s(data.company_longitude),
    company_email: s(data.company_email),
    company_tel: s(data.company_tel),
    tax_no: s(data.tax_no),
    branch_no: s(data.branch_no),

    hotel_name: s(data.hotel_name),
    hotel_address_line1: s(data.hotel_address_line1),
    hotel_address_line2: s(data.hotel_address_line2),
    hotel_sub_district: s(data.hotel_sub_district),
    hotel_district: s(data.hotel_district),
    hotel_city: s(data.hotel_city),
    hotel_province: s(data.hotel_province),
    hotel_postal_code: s(data.hotel_postal_code),
    hotel_country: s(data.hotel_country),
    hotel_latitude: s(data.hotel_latitude),
    hotel_longitude: s(data.hotel_longitude),
    hotel_email: s(data.hotel_email),
    hotel_tel: s(data.hotel_tel),

    timezone: s(data.timezone),
    date_format: s(data.date_format),
    date_time_format: s(data.date_time_format),
    time_format: s(data.time_format),
    short_time_format: s(data.short_time_format),
    long_time_format: s(data.long_time_format),

    amount_format: data.amount_format ?? { ...emptyFormat },
    quantity_format: data.quantity_format ?? { ...emptyFormat },
    recipe_format: data.recipe_format ?? { ...emptyFormat },

    config: mergeSeededConfig(normalizeConfig(data.config)),
  };
}

const NULLABLE_STR_FIELDS = [
  "alias_name",
  "description",
  "info",
  "default_currency_id",
  "company_name",
  "company_address_line1",
  "company_address_line2",
  "company_sub_district",
  "company_district",
  "company_city",
  "company_province",
  "company_postal_code",
  "company_country",
  "company_latitude",
  "company_longitude",
  "company_email",
  "company_tel",
  "tax_no",
  "branch_no",
  "hotel_name",
  "hotel_address_line1",
  "hotel_address_line2",
  "hotel_sub_district",
  "hotel_district",
  "hotel_city",
  "hotel_province",
  "hotel_postal_code",
  "hotel_country",
  "hotel_latitude",
  "hotel_longitude",
  "hotel_email",
  "hotel_tel",
  "timezone",
  "date_format",
  "date_time_format",
  "time_format",
  "short_time_format",
  "long_time_format",
] as const;

const NUMBER_FORMAT_FIELDS = [
  "amount_format",
  "quantity_format",
  "recipe_format",
] as const;

export function buildPatch(
  values: BusinessSettingFormValues,
  original: BusinessSettingFormValues,
): BusinessUnitPatch {
  const patch: Record<string, unknown> = {};

  if (values.code !== original.code) patch.code = values.code;
  if (values.name !== original.name) patch.name = values.name;

  for (const k of NULLABLE_STR_FIELDS) {
    if (values[k] !== original[k])
      patch[k] = values[k] === "" ? null : values[k];
  }

  for (const k of NUMBER_FORMAT_FIELDS) {
    const a = values[k];
    const b = original[k];
    if (
      a.locales !== b.locales ||
      a.minimumIntegerDigits !== b.minimumIntegerDigits
    ) {
      patch[k] = a;
    }
  }

  // ไม่สนลำดับ key: values ผ่าน zod แล้วเรียงตาม configItemSchema (key, label, datatype,
  // value) ส่วน original มาจาก jsonb ซึ่ง Postgres เรียงตามความยาวชื่อ (key, label, value,
  // datatype) — JSON.stringify ตรง ๆ จึงส่ง config ไปทุกครั้งที่กด Save
  if (stableStringify(values.config) !== stableStringify(original.config)) {
    patch.config = values.config;
  }

  return patch as BusinessUnitPatch;
}
