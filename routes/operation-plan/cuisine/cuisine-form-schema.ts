import { z } from "zod";
import type { Cuisine } from "@/types/cuisine";
import { keyValuesToObject, objectToKeyValues } from "@/lib/form-helpers";

const keyValueRowSchema = z.object({
  _id: z.string(),
  key: z.string(),
  value: z.string(),
});

export const cuisineSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string(),
  note: z.string(),
  region: z.string().min(1, "Region is required"),
  popular_dishes: z.array(z.string()),
  key_ingredients: z.array(z.string()),
  // คีย์ซ้ำ = แถวหลังทับแถวแรกตอนแปลงเป็น object — กันไว้ที่ฟอร์มแทนการทิ้งเงียบ ๆ
  info: z.array(keyValueRowSchema).superRefine((rows, ctx) => {
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      const key = row.key.trim();
      if (!key) return;
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate key "${key}"`,
          path: [index, "key"],
        });
      }
      seen.add(key);
    });
  }),
  dimension: z.array(z.string()),
  is_active: z.boolean(),
});

export type CuisineFormValues = z.infer<typeof cuisineSchema>;

export const EMPTY_FORM: CuisineFormValues = {
  name: "",
  description: "",
  note: "",
  region: "ASIA",
  popular_dishes: [],
  key_ingredients: [],
  info: [],
  dimension: [],
  is_active: true,
};

export function getDefaultValues(cuisine?: Cuisine): CuisineFormValues {
  if (!cuisine) return EMPTY_FORM;
  return {
    name: cuisine.name,
    description: cuisine.description ?? "",
    note: cuisine.note ?? "",
    region: cuisine.region,
    popular_dishes: cuisine.popular_dishes ?? [],
    key_ingredients: cuisine.key_ingredients ?? [],
    info: objectToKeyValues(cuisine.info),
    dimension: cuisine.dimension ?? [],
    is_active: cuisine.is_active,
  };
}

const orNull = (items: string[]) => (items.length > 0 ? items : null);

export function mapToPayload(values: CuisineFormValues) {
  return {
    name: values.name,
    description: values.description || null,
    note: values.note || null,
    region: values.region,
    popular_dishes: orNull(values.popular_dishes),
    key_ingredients: orNull(values.key_ingredients),
    info: keyValuesToObject(values.info),
    dimension: orNull(values.dimension),
    is_active: values.is_active,
  };
}
