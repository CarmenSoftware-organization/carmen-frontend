import { addDays } from "@/lib/date-utils";
import type {
  SrStockMovementItem,
  StoreRequisition,
} from "@/types/store-requisition";
import { lineDimensionsPayload } from "@/lib/dimension-payload";
import type { SrFormValues } from "./sr-form-schema";

export function buildSrDefaultValues(
  storeRequisition: StoreRequisition | undefined,
  defaultRequestorId: string,
  defaultDepartmentId: string,
): SrFormValues {
  if (!storeRequisition) {
    const today = new Date().toISOString();
    return {
      sr_date: today,
      // ตั้งต้นเป็นพรุ่งนี้ — เบิกวันนี้ของถึงเร็วสุดคือวันรุ่งขึ้น
      expected_date: addDays(today, 1),
      description: "",
      workflow_id: "",
      requestor_id: defaultRequestorId,
      department_id: defaultDepartmentId,
      from_location_id: "",
      to_location_id: "",
      items: [],
    };
  }
  return {
    doc_version: storeRequisition.doc_version,
    sr_date: storeRequisition.sr_date ?? "",
    expected_date: storeRequisition.expected_date ?? "",
    description: storeRequisition.description ?? "",
    workflow_id: storeRequisition.workflow?.id ?? "",
    requestor_id: storeRequisition.requestor?.id ?? defaultRequestorId,
    department_id: storeRequisition.department?.id ?? defaultDepartmentId,
    from_location_id: storeRequisition.from_location?.id ?? "",
    to_location_id: storeRequisition.to_location?.id ?? "",
    items:
      storeRequisition.store_requisition_detail?.map((d) => ({
        id: d.id,
        doc_version: d.doc_version,
        product_id: d.product?.id ?? "",
        product_name: d.product?.name ?? "",
        product_local_name: d.product?.local_name ?? "",
        unit_name: d.inventory_unit_name ?? "",
        description: d.description ?? "",
        requested_qty: d.requested_qty,
        approved_qty: d.approved_qty ?? 0,
        issued_qty: d.issued_qty ?? 0,
        current_stage_status: d.current_stage_status ?? "pending",
        stage_status: "",
        _initial_stage_status: d.current_stage_status ?? "pending",
        stage_message: "",
        history: d.history ?? [],
        dimensions: d.dimensions ?? [],
        dimensions_dirty: false,
      })) ?? [],
  };
}

/**
 * ค่าเริ่มต้นของฟอร์มตอน duplicate ใบเดิม — semantics เดียวกับ Duplicate ของ PR:
 * ตั้งต้นจากฟอร์มเปล่า (วันที่วันนี้/พรุ่งนี้ requestor เป็นคนกดก๊อป) แล้ว copy
 * "ของที่เบิก" จากใบเดิม (notes/workflow/แผนก/คลังต้นทาง-ปลายทาง + รายการสินค้า
 * กับจำนวนที่ขอ) ทิ้งของที่ผูกกับรอบเดิมทั้งหมด: item id/doc_version, จำนวนที่
 * อนุมัติ/จ่ายจริง, สถานะ stage — ใบใหม่ต้องเริ่มรอบ workflow ของตัวเอง
 */
export function buildSrDuplicateValues(
  storeRequisition: StoreRequisition,
  defaultRequestorId: string,
  defaultDepartmentId: string,
): SrFormValues {
  const blank = buildSrDefaultValues(
    undefined,
    defaultRequestorId,
    defaultDepartmentId,
  );
  return {
    ...blank,
    description: storeRequisition.description ?? "",
    workflow_id: storeRequisition.workflow?.id ?? "",
    department_id: storeRequisition.department?.id ?? defaultDepartmentId,
    from_location_id: storeRequisition.from_location?.id ?? "",
    to_location_id: storeRequisition.to_location?.id ?? "",
    items:
      storeRequisition.store_requisition_detail?.map((d) => ({
        product_id: d.product?.id ?? "",
        product_name: d.product?.name ?? "",
        product_local_name: d.product?.local_name ?? "",
        unit_name: d.inventory_unit_name ?? "",
        description: d.description ?? "",
        requested_qty: d.requested_qty,
        approved_qty: 0,
        issued_qty: 0,
        current_stage_status: "pending",
        stage_status: "",
        _initial_stage_status: "pending",
        stage_message: "",
        dimensions: d.dimensions ?? [],
        dimensions_dirty: false,
      })) ?? [],
  };
}

/**
 * ยอดเงินของรายการ SR
 *
 * `store_requisition_detail` ไม่มีราคาติดมากับใบ — ต้นทุนมาจากเส้น
 * `/{bu}/cost/products/{product}/location/{from}/qty/{qty}` ซึ่ง `SrItemCostSync`
 * ยิงให้รายแถวแล้วเขียน `total_cost` กลับเข้าฟอร์ม ตัวนี้จึงแค่หยิบค่านั้นมา
 *
 * ทั้งคอลัมน์ยอดเงินในตารางและยอดรวมท้ายฟอร์มเรียกตัวนี้ตัวเดียว — ยอดสองที่จึง
 * ไม่มีทางหลุดกันเอง (บทเรียนจาก PO)
 */
export function srItemAmount(item: SrFormValues["items"][number]): number {
  return Number(item.total_cost) || 0;
}

/**
 * ใบนี้ดูการเคลื่อนไหวสต๊อกได้หรือยัง — **เฉพาะใบที่ปิดจบแล้วเท่านั้น**
 *
 * ก่อนถึง completed ของยังไม่ขยับจริง ตัวเลขที่ backend ตอบมาเป็นการคาดการณ์จาก
 * ตัวใบ (`source: store_requisition_detail`) การโชว์ตารางไว้จึงมีแต่ทำให้คนเข้าใจ
 * ว่าตัดสต๊อกไปแล้ว — ทั้งตารางและยอดสรุปใน footer ใช้เกณฑ์เดียวกันจากที่นี่
 * และใช้กัน request ด้วย (ยังไม่ถึงเวลาก็ไม่ต้องยิง)
 *
 * ใบใหม่ที่ยังไม่บันทึกไม่มีสถานะ จึงตกเกณฑ์นี้ไปเองโดยไม่ต้องเช็กแยก
 */
export function srStockVisible(docStatus?: string): boolean {
  return docStatus === "completed";
}

/**
 * ต้นทุนที่ลงบัญชีจริงต่อบรรทัด SR — ใช้กับใบที่จ่ายแล้ว (`srStockVisible`)
 *
 * รวม `total_cost` ของรายการ**ขาออก** (`qty_out > 0` ที่คลังต้นทาง) ที่ผูกกับบรรทัดนั้น
 * ฝั่งขาเข้าที่คลังปลายทางเป็นต้นทุนก้อนเดียวกันจึงไม่นับซ้ำ · ต้นทุนต่อหน่วย = ยอดรวม ÷ จำนวนที่จ่ายจริง
 *
 * ใบที่จ่ายแล้วต้องโชว์ตัวนี้ ไม่ใช่ราคาประมาณจาก `SrItemCostSync` ซึ่งคิดจากล็อตที่เหลือ
 * ณ วันที่เปิดดูและจำนวนที่**ขอ** — ของหมดคลังแล้วจะได้ 0, ราคาล็อตเปลี่ยนก็เพี้ยนตาม,
 * จ่ายไม่ครบตามที่ขอก็ผิด
 */
export function srPostedCostByDetail(
  items: SrStockMovementItem[],
): Map<string, { total_cost: number; cost_per_unit: number }> {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const sums = new Map<string, { total: number; qty: number }>();
  for (const row of items) {
    if (!(row.qty_out > 0)) continue;
    const acc = sums.get(row.store_requisition_detail_id) ?? {
      total: 0,
      qty: 0,
    };
    acc.total += Number(row.total_cost) || 0;
    acc.qty += Number(row.qty_out) || 0;
    sums.set(row.store_requisition_detail_id, acc);
  }
  const out = new Map<string, { total_cost: number; cost_per_unit: number }>();
  for (const [detailId, { total, qty }] of sums) {
    out.set(detailId, {
      total_cost: round2(total),
      cost_per_unit: qty > 0 ? round2(total / qty) : 0,
    });
  }
  return out;
}

export function srGrandTotal(items: SrFormValues["items"]): number {
  return items.reduce((sum, item) => sum + srItemAmount(item), 0);
}

export function mapSrItemToPayload(
  item: SrFormValues["items"][number],
  options?: { dimensionsEnabled?: boolean },
) {
  return {
    ...(item.doc_version != null ? { doc_version: item.doc_version } : {}),
    product_id: item.product_id,
    description: item.description,
    requested_qty: item.requested_qty,
    approved_qty: item.approved_qty,
    issued_qty: item.issued_qty,
    current_stage_status: item.current_stage_status || "pending",
    ...lineDimensionsPayload(item, options?.dimensionsEnabled ?? false),
  };
}
