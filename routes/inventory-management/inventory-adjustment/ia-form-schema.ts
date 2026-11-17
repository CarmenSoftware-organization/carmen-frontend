import { z } from "zod";
import type { TranslationFn } from "@/lib/i18n-schema";
import { lineDimensionsPayload } from "@/lib/dimension-payload";
import type { DimensionRef } from "@/types/gl-dimension";
import type {
  AdjustmentDetailItemPayload,
  InventoryAdjustment,
} from "@/types/inventory-adjustment";

const dimensionRefSchema = z.object({
  gl_dimension_id: z.string(),
  gl_dimension_value_id: z.string(),
  dimension_code: z.string().optional(),
  value_code: z.string().optional(),
  dimension_name: z.string().optional(),
  value_name: z.string().optional(),
});

function createDetailSchema(tv: TranslationFn, tf: TranslationFn) {
  return z.object({
    id: z.string().optional(),
    // เวอร์ชันของแถว — พกไว้เฉย ๆ ไม่ได้แสดงบนจอ แต่ต้องส่งกลับตอน save
    doc_version: z.coerce.number().optional(),
    product_id: z.string().min(1, tv("required", { field: tf("product") })),
    product_name: z.string(),
    product_local_name: z.string(),
    unit_name: z.string(),
    // ห้ามติดลบ แต่ 0 ผ่านได้ — แถวใหม่เริ่มที่ 0 จะได้ไม่ขึ้น error ทันทีที่กด
    // เพิ่มรายการ (กติกาเดียวกับ SR) · ทศนิยมใส่ได้ ไม่ปัดให้ (ดู CLAUDE.md
    // เรื่อง ValidateSchema.quantity ของ backend ที่ยังเป็น int)
    qty: z.coerce
      .number()
      .min(0, tv("minNumber", { field: tf("qty"), min: 0 })),
    cost_per_unit: z.coerce
      .number()
      .min(0, tv("minZero", { field: tf("costPerUnit") })),
    total_cost: z.coerce.number(),
    description: z
      .string()
      .max(256, tv("maxLength", { field: tf("description"), max: 256 })),
    dimensions: z.array(dimensionRefSchema).optional(),
    // ผู้ใช้แก้ช่อง dimension ของบรรทัดนี้ — ไม่ตั้งธงนี้ payload จะไม่ส่ง dimensions
    dimensions_dirty: z.boolean().optional(),
  });
}

export function createAdjSchema(
  tv: TranslationFn,
  tf: TranslationFn,
  periodStart?: string,
  periodEnd?: string,
) {
  return z.object({
    description: z
      .string()
      .max(256, tv("maxLength", { field: tf("description"), max: 256 })),
    doc_status: z.string().min(1),
    adjustment_type_id: z
      .string()
      .nullable()
      .refine((v) => !!v, tv("required", { field: tf("adjustmentType") })),
    date: z
      .string()
      .min(1, tv("required", { field: tf("date") }))
      .refine(
        (v) => {
          if (!periodStart || !periodEnd || !v) return true;
          const d = new Date(v);
          return d >= new Date(periodStart) && d <= new Date(periodEnd);
        },
        { message: tv("dateOutsidePeriod") },
      )
      // ใบรับ/จ่ายลงวันที่อนาคตไม่ได้ (ผู้ใช้ขอ 2026-10-07) — ดักหน้าบ้านอย่างเดียว
      .refine((v) => !v || new Date(v) <= endOfToday(), {
        message: tv("dateAfterToday"),
      }),
    location_id: z.string().min(1, tv("required", { field: tf("location") })),
    items: z
      .array(createDetailSchema(tv, tf))
      .min(1, tv("atLeastOneItem", { item: tf("product") })),
  });
}

export type AdjFormValues = z.infer<ReturnType<typeof createAdjSchema>>;

export const ADJ_ITEM: AdjFormValues["items"][number] = {
  product_id: "",
  product_name: "",
  product_local_name: "",
  unit_name: "",
  qty: 0,
  cost_per_unit: 0,
  total_cost: 0,
  description: "",
  dimensions: [] as DimensionRef[],
  dimensions_dirty: false,
};

export function mapItemToPayload(
  item: AdjFormValues["items"][number],
  options?: { dimensionsEnabled?: boolean },
): AdjustmentDetailItemPayload {
  return {
    // แถวที่มีอยู่แล้วต้องส่ง doc_version กลับ ไม่งั้น /save ตอบ 400
    // ("stock_in_detail.update.0.doc_version: Required") ส่วนแถวใหม่ยังไม่มี
    ...(item.doc_version != null ? { doc_version: item.doc_version } : {}),
    // unit_name ไม่อยู่ในนี้ — เป็นคอลัมน์แสดงผลอย่างเดียว
    product_id: item.product_id,
    qty: item.qty,
    cost_per_unit: item.cost_per_unit,
    total_cost: item.total_cost,
    description: item.description,
    ...lineDimensionsPayload(item, options?.dimensionsEnabled ?? false),
  };
}

/**
 * บรรทัดที่แก้แค่ dimension ต้องส่งต้นทุนที่เก็บไว้เดิมกลับไป — backend ใช้
 * `cost_per_unit` default 0 ในบรรทัด update ถ้าไม่ส่งค่าจะถูกเขียนเป็น 0 และ
 * `CostProbe` ก็เขียนต้นทุนประมาณการทับค่าในฟอร์มตั้งแต่ mount (ใบ SO ร่างเก็บ 0)
 * เข้าเงื่อนไขเมื่อ: แก้ dimension, product/qty/description ไม่เปลี่ยน และ
 * คลัง/วันที่ของใบไม่เปลี่ยน (ถ้าเปลี่ยน ต้นทุนใหม่ที่ probe ดึงมาคือความตั้งใจ)
 * @param update - `buildItemChanges(...).update`
 * @param current - ค่าในฟอร์มตอนกด Save
 * @param original - `defaultValues` ที่โหลดมา (ถือต้นทุนที่เก็บไว้)
 * @returns update ที่ใส่ต้นทุนเดิมคืนให้บรรทัด dimension-only แล้ว
 */
export function restoreStoredCost<U extends { id: string }>(
  update: U[] | undefined,
  current: AdjFormValues,
  original: AdjFormValues,
): U[] | undefined {
  const isHeaderSame =
    current.location_id === original.location_id &&
    current.date === original.date;
  return update?.map((u) => {
    const cur = current.items.find((i) => i.id === u.id);
    const orig = original.items.find((i) => i.id === u.id);
    if (!cur || !orig || !cur.dimensions_dirty || !isHeaderSame) return u;
    const isDimensionOnly =
      cur.product_id === orig.product_id &&
      Number(cur.qty) === Number(orig.qty) &&
      cur.description === orig.description;
    if (!isDimensionOnly) return u;
    return {
      ...u,
      cost_per_unit: orig.cost_per_unit,
      total_cost: orig.total_cost,
    };
  });
}

function minDate(a: Date, b: Date): Date {
  return new Date(Math.min(a.getTime(), b.getTime()));
}

/** เวลาสุดท้ายของวันนี้ตามเวลาเครื่อง — วันที่ที่เลือกจากปฏิทินเป็นเที่ยงคืนของวันนั้น */
export function endOfToday(): Date {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * วันสุดท้ายที่ SI/SO เลือกได้: วันนี้ หรือท้ายงวดถ้างวดจบก่อนวันนี้
 * @param periodEnd - ท้ายงวดปัจจุบัน (ไม่ส่ง = จำกัดแค่วันนี้)
 * @returns วันสุดท้ายที่เลือกได้
 */
export function latestIssuableDate(periodEnd?: string): Date {
  const today = endOfToday();
  return periodEnd ? minDate(new Date(periodEnd), today) : today;
}

export function resolveDefaultDate(periodEnd?: string): string {
  const today = new Date();
  if (!periodEnd) return today.toISOString();
  const endDate = new Date(periodEnd);
  return minDate(endDate, today).toISOString();
}

export function getDefaultValues(
  adj?: InventoryAdjustment,
  periodEnd?: string,
): AdjFormValues {
  if (adj) {
    const details = adj.stock_in_detail ?? adj.stock_out_detail ?? [];
    return {
      description: adj.description ?? "",
      doc_status: adj.doc_status ?? "draft",
      // endpoint รายละเอียด (stock-ins/{id}) ยุบเป็นก้อนแล้ว ส่วน endpoint list
      // ยังคืน flat — type ประกาศไว้ทั้งสองทรง อ่านก้อนก่อนแล้วตกไป flat
      adjustment_type_id:
        adj.adjustment_type?.id ?? adj.adjustment_type_id ?? null,
      date: adj.si_date ?? adj.so_date ?? "",
      location_id: adj.location?.id ?? adj.location_id ?? "",
      items: details.map((d) => ({
        id: d.id,
        doc_version: d.doc_version,
        product_id: d.product?.id ?? "",
        product_name: d.product?.name ?? "",
        product_local_name: d.product?.local_name ?? "",
        unit_name: d.inventory_unit?.name ?? d.inventory_unit_name ?? "",
        qty: d.qty,
        // ใบจ่ายออกอาจไม่มีสองค่านี้ (ดู InventoryAdjustmentDetail) — ปล่อย undefined เข้าฟอร์ม
        // แล้ว schema (z.coerce.number) ตีกลับเป็น NaN ที่ช่องซ่อน กด Save แล้วเงียบ
        cost_per_unit: d.cost_per_unit ?? 0,
        total_cost: d.total_cost ?? 0,
        description: d.description ?? "",
        dimensions: d.dimensions ?? [],
        dimensions_dirty: false,
      })),
    };
  }
  return {
    description: "",
    doc_status: "draft",
    adjustment_type_id: null,
    date: resolveDefaultDate(periodEnd),
    location_id: "",
    items: [],
  };
}
