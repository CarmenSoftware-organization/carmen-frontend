import { z } from "zod";

/** schema ของ dimension ต่อบรรทัดในฟอร์มเอกสาร — ตรงกับ `DimensionRef` */
export const dimensionRefSchema = z.object({
  dimension_id: z.string(),
  dimension_value_id: z.string().nullish(),
  value: z.union([z.string(), z.number(), z.boolean()]).nullish(),
  value_text: z.string().nullish(),
  value_number: z.union([z.string(), z.number()]).nullish(),
  value_date: z.string().nullish(),
  value_boolean: z.boolean().nullish(),
  dimension_code: z.string().nullish(),
  value_code: z.string().nullish(),
  dimension_name: z.string().nullish(),
  value_name: z.string().nullish(),
  data_type: z
    .enum(["string", "number", "date", "lookup", "boolean"])
    .optional(),
});
