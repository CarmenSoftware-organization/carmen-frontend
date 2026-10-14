import { z } from "zod";
import type { TranslationFn } from "@/lib/i18n-schema";
import type { FormMode } from "@/types/form";
import type { AccountCodeEntry, AccountCodesPayload } from "@/types/category";

export function createCategorySchema(tv: TranslationFn, tf: TranslationFn) {
  const deviation = (field: string) =>
    z.coerce
      .number()
      .min(0, tv("minZero", { field: tf(field) }))
      .max(100, tv("maxNumber", { field: tf(field), max: 100 }));

  return z.object({
    code: z.string().optional(),
    name: z.string().min(1, tv("required", { field: tf("name") })),
    description: z.string().optional(),
    is_active: z.boolean(),
    price_deviation_limit: deviation("priceDeviation"),
    qty_deviation_limit: deviation("qtyDeviation"),
    is_used_in_recipe: z.boolean(),
    is_sold_directly: z.boolean(),
    tax_profile_id: z
      .string()
      .min(1, tv("required", { field: tf("taxProfile") })),
    tax_rate: z.coerce.number().min(0, tv("minZero", { field: tf("taxRate") })),
    product_category_id: z.string().optional(),
    product_subcategory_id: z.string().optional(),
    cascade_deviation: z.boolean(),
    inventory_account_code: z.string().nullable().optional(),
    direct_account_code: z.string().nullable().optional(),
  });
}

export type CategoryFormValues = z.infer<
  ReturnType<typeof createCategorySchema>
>;

/**
 * ตัด field `code` ออกจาก payload เมื่ออยู่ในโหมด add เพื่อให้ backend สร้าง
 * running-number code ให้อัตโนมัติ ส่วนโหมด edit จะคง code เดิม (server-assigned)
 * ไว้ไม่เปลี่ยนแปลง
 * @param mode - โหมดของฟอร์ม (add / edit)
 * @param data - ค่าจากฟอร์มที่ผ่าน validation แล้ว
 * @returns payload ที่พร้อมส่ง — ไม่มี code ในโหมด add, คงเดิมในโหมด edit
 */
export function stripAutoCode(
  mode: FormMode,
  data: CategoryFormValues,
): CategoryFormValues {
  return mode === "add" ? { ...data, code: undefined } : data;
}

/**
 * แปลงค่าในฟอร์ม → add/update/remove เทียบกับของเดิม เฉพาะ inventory/direct
 * (ชนิดอื่นไม่แตะ) — คืน undefined เมื่อไม่มีอะไรเปลี่ยน เพื่อไม่ส่งฟิลด์ไปเลย
 * @param existing - แถว mapping เดิมของ node (โหมด add ส่ง [])
 * @param next - รหัสบัญชีที่เลือกในฟอร์ม (ว่าง/null = ไม่ตั้งค่า → สืบทอดจากชั้นบน)
 * @returns payload account_codes หรือ undefined ถ้าไม่มีการเปลี่ยนแปลง
 */
export function buildAccountCodesPayload(
  existing: AccountCodeEntry[],
  next: {
    inventory: string | null | undefined;
    direct: string | null | undefined;
  },
): AccountCodesPayload | undefined {
  const out: Required<AccountCodesPayload> = { add: [], update: [], remove: [] };
  for (const type of ["inventory", "direct"] as const) {
    const cur = existing.find((e) => e.account_type === type);
    const val = next[type] || null;
    if (!cur && val) out.add.push({ account_type: type, account_code: val });
    else if (cur && !val) out.remove.push({ id: cur.id });
    else if (cur && val && cur.account_code !== val)
      out.update.push({ id: cur.id, account_code: val });
  }
  return out.add.length || out.update.length || out.remove.length
    ? out
    : undefined;
}
