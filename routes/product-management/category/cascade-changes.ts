import type { CategoryNode } from "@/types/category";
import { NODE_TYPE } from "@/types/category";
import type { CategoryFormValues } from "./category-form-schema";

export type CascadeAccountType = "inventory" | "direct";

export interface ValueChange<T> {
  from: T;
  to: T;
}

/** ค่าที่ผู้ใช้แก้จริงในรอบนี้ — key ที่ไม่เปลี่ยนจะไม่อยู่ในออบเจ็กต์ */
export interface CascadeChanges {
  price_deviation_limit?: ValueChange<number>;
  qty_deviation_limit?: ValueChange<number>;
  inventory?: ValueChange<string | null>;
  direct?: ValueChange<string | null>;
}

export type CascadeSource = Pick<
  CategoryFormValues,
  | "price_deviation_limit"
  | "qty_deviation_limit"
  | "inventory_account_code"
  | "direct_account_code"
>;

/**
 * เทียบค่าก่อน/หลังแก้ เฉพาะ 4 ค่าที่ cascade ลงชั้นล่างได้
 * deviation เทียบแบบตัวเลข, รหัสบัญชีเทียบแบบ normalise (ว่าง = null)
 * @param before - ค่าเดิมของ node
 * @param after - ค่าที่ผู้ใช้กรอกในฟอร์ม
 * @returns เฉพาะค่าที่เปลี่ยน (ไม่เปลี่ยน = ไม่มี key)
 */
export function detectCascadeChanges(
  before: CascadeSource,
  after: CascadeSource,
): CascadeChanges {
  const changes: CascadeChanges = {};

  for (const key of ["price_deviation_limit", "qty_deviation_limit"] as const) {
    const from = Number(before[key]);
    const to = Number(after[key]);
    if (from !== to) changes[key] = { from, to };
  }

  const accounts = [
    ["inventory", "inventory_account_code"],
    ["direct", "direct_account_code"],
  ] as const;
  for (const [type, field] of accounts) {
    const from = before[field] || null;
    const to = after[field] || null;
    if (from !== to) changes[type] = { from, to };
  }

  return changes;
}

/**
 * @param changes - ผลจาก detectCascadeChanges
 * @returns true เมื่อมีอย่างน้อยหนึ่งค่าเปลี่ยน
 */
export function hasCascadeChanges(changes: CascadeChanges): boolean {
  return Object.keys(changes).length > 0;
}

export type CascadeChoice = "cascade" | "self";

export interface CascadeDecision {
  choice: CascadeChoice;
  changes: CascadeChanges;
}

export interface CascadePayload {
  cascade_deviation: boolean;
  cascade_account_codes?: CascadeAccountType[];
}

/**
 * ประกอบ payload ตามการตัดสินใจในกล่องยืนยัน
 * - ไม่มี decision หรือเลือก "self" → cascade_deviation=false (ต้องส่งชัดเจน
 *   เพราะ backend ถือ default เป็น true เมื่อไม่ส่ง) และไม่ส่ง cascade_account_codes
 * - เลือก "cascade" → cascade_deviation = มี deviation เปลี่ยนจริง; ถ้าเปลี่ยนแค่
 *   ตัวเดียวจะลบ key ของอีกตัวออก (backend เขียนลูกเฉพาะ key ที่ส่งมา);
 *   cascade_account_codes ลิสต์เฉพาะชนิดที่เปลี่ยน (ชนิดที่ไม่มีแถวถือว่า "ล้างค่า"
 *   และจะ soft-delete แถวของลูกทุกชั้น)
 * @param data - payload ของฟอร์ม
 * @param decision - ผลการตัดสินใจ (undefined = ไม่มีอะไรให้ถาม)
 * @returns payload พร้อมฟิลด์ cascade
 */
export function applyCascadeDecision<T extends Record<string, unknown>>(
  data: T,
  decision: CascadeDecision | undefined,
): Partial<T> & CascadePayload {
  if (!decision || decision.choice === "self") {
    return { ...data, cascade_deviation: false };
  }

  const { changes } = decision;
  const result: Partial<T> & CascadePayload = {
    ...data,
    cascade_deviation: Boolean(
      changes.price_deviation_limit || changes.qty_deviation_limit,
    ),
  };

  if (result.cascade_deviation) {
    if (!changes.price_deviation_limit) delete result.price_deviation_limit;
    if (!changes.qty_deviation_limit) delete result.qty_deviation_limit;
  }

  const accountTypes: CascadeAccountType[] = [];
  if (changes.inventory) accountTypes.push("inventory");
  if (changes.direct) accountTypes.push("direct");
  if (accountTypes.length > 0) result.cascade_account_codes = accountTypes;

  return result;
}

/**
 * นับลูกหลานของ node เพื่อบอกจำนวนที่จะได้รับผลในกล่องยืนยัน
 * @param node - node ที่กำลังแก้
 * @returns จำนวน sub-category และ item group ใต้ node
 */
export function countDescendants(node: CategoryNode): {
  subCategories: number;
  itemGroups: number;
} {
  const children = node.children ?? [];
  if (node.type === NODE_TYPE.CATEGORY) {
    return {
      subCategories: children.length,
      itemGroups: children.reduce((n, c) => n + (c.children?.length ?? 0), 0),
    };
  }
  if (node.type === NODE_TYPE.SUBCATEGORY) {
    return { subCategories: 0, itemGroups: children.length };
  }
  return { subCategories: 0, itemGroups: 0 };
}
