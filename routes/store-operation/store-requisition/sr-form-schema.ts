import { z } from "zod";
import type { TranslationFn } from "@/lib/i18n-schema";
import type { DimensionRef } from "@/types/gl-dimension";

const dimensionRefSchema = z.object({
  gl_dimension_id: z.string(),
  gl_dimension_value_id: z.string(),
  dimension_code: z.string().optional(),
  value_code: z.string().optional(),
  dimension_name: z.string().optional(),
  value_name: z.string().optional(),
});

function createSrDetailSchema(tv: TranslationFn, tf: TranslationFn) {
  return z.object({
    id: z.string().optional(),
    doc_version: z.coerce.number().optional(),
    product_id: z.string().min(1, tv("required", { field: tf("product") })),
    product_name: z.string(),
    // display เท่านั้น — ไม่ส่ง payload
    product_local_name: z.string(),
    unit_name: z.string(),
    description: z.string(),
    requested_qty: z.coerce
      .number()
      .min(0, tv("minNumber", { field: tf("qty"), min: 0 })),
    approved_qty: z.coerce.number(),
    issued_qty: z.coerce.number(),
    // ต้นทุนที่ backend คิดจากล็อตจริง (`/cost/products/.../qty/...`) — display
    // เท่านั้น ไม่ส่ง payload · เก็บลงฟอร์มเพื่อให้คอลัมน์ยอดเงินกับยอดรวมท้ายใบ
    // อ่านค่าเดียวกัน ไม่ใช่ต่างคนต่างยิง API
    cost_per_unit: z.coerce.number().optional(),
    total_cost: z.coerce.number().optional(),
    current_stage_status: z.string(),
    stage_status: z.string().optional(),
    // snapshot สถานะจาก server ตอนโหลด — ใช้ lock ปุ่ม reset (ไม่ส่ง payload)
    _initial_stage_status: z.string().optional(),
    stage_message: z.string().optional(),
    // ประวัติ workflow ระดับรายการ (display-only passthrough, ไม่ส่งกลับ API)
    history: z
      .array(
        z.object({
          at: z.string(),
          seq: z.coerce.number(),
          name: z.string(),
          user: z.object({ id: z.string(), name: z.string() }),
          status: z.string(),
          message: z.string().nullish(),
        }),
      )
      .optional(),
    dimensions: z.array(dimensionRefSchema).optional(),
    // ผู้ใช้แก้ช่อง dimension ของบรรทัดนี้ — ไม่ตั้งธงนี้ payload จะไม่ส่ง dimensions
    dimensions_dirty: z.boolean().optional(),
  });
}

/**
 * สร้าง Zod schema หลักของฟอร์มใบเบิกสินค้า (Store Requisition)
 * รวมการตรวจสอบ cross-field วัน expected ต้องไม่น้อยกว่า sr_date
 *
 * @param tv - ฟังก์ชันแปลข้อความ validation
 * @param tf - ฟังก์ชันแปลชื่อ field
 * @returns Zod schema ของ SR form
 * @example
 * const schema = createSrSchema(tv, tf);
 * const form = useForm({ resolver: zodResolver(schema) });
 */
export function createSrSchema(tv: TranslationFn, tf: TranslationFn) {
  return z
    .object({
      doc_version: z.coerce.number().optional(),
      sr_date: z.string().min(1, tv("required", { field: tf("srDate") })),
      expected_date: z
        .string()
        .min(1, tv("required", { field: tf("expectedDate") })),
      description: z.string(),
      workflow_id: z.string().min(1, tv("required", { field: tf("workflow") })),
      requestor_id: z.string(),
      department_id: z
        .string()
        .min(1, tv("required", { field: tf("department") })),
      from_location_id: z
        .string()
        .min(1, tv("required", { field: tf("fromLocation") })),
      to_location_id: z
        .string()
        .min(1, tv("required", { field: tf("toLocation") })),
      items: z
        .array(createSrDetailSchema(tv, tf))
        .min(1, tv("atLeastOneItem", { item: tf("items") })),
    })
    .refine(
      (data) => {
        if (!data.sr_date || !data.expected_date) return true;
        const toDay = (iso: string) => {
          const d = new Date(iso);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        };
        return toDay(data.expected_date) >= toDay(data.sr_date);
      },
      {
        message: tv("expectedDateAfterSr"),
        path: ["expected_date"],
      },
    );
}

export type SrFormValues = z.infer<ReturnType<typeof createSrSchema>>;

export const SR_ITEM = {
  product_id: "",
  product_name: "",
  product_local_name: "",
  unit_name: "",
  description: "",
  requested_qty: 0,
  approved_qty: 0,
  issued_qty: 0,
  cost_per_unit: 0,
  total_cost: 0,
  current_stage_status: "pending",
  stage_status: "",
  _initial_stage_status: "pending",
  stage_message: "",
  dimensions: [] as DimensionRef[],
  dimensions_dirty: false,
} as const;

export const SR_ITEM_STAGE = {
  PENDING: "pending",
  APPROVE: "approve",
  REJECT: "reject",
  REVIEW: "review",
} as const;

export function computeSrAction(
  statuses: string[],
): "none" | "review" | "rejected" | "approved" {
  const active = statuses.filter(Boolean);
  if (active.length === 0) return "none";
  if (active.some((s) => s === SR_ITEM_STAGE.REVIEW)) return "review";
  if (active.every((s) => s === SR_ITEM_STAGE.REJECT)) return "rejected";
  if (
    active.every(
      (s) => s === SR_ITEM_STAGE.APPROVE || s === SR_ITEM_STAGE.REJECT,
    ) &&
    active.some((s) => s === SR_ITEM_STAGE.APPROVE)
  )
    return "approved";
  return "none";
}
