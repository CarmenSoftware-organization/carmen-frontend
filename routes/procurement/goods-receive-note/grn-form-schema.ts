import { z } from "zod";
import { round2 } from "@/lib/currency-utils";
import type { TranslationFn } from "@/lib/i18n-schema";
import type {
  GoodsReceiveNote,
  GrnDetailPayload,
  ExtraCostDetailPayload,
} from "@/types/goods-receive-note";

function createGrnDetailSchema(tv: TranslationFn, tf: TranslationFn) {
  const base = z.object({
    id: z.string().optional(),
    doc_version: z.coerce.number().optional(),
    purchase_order_id: z.string().nullable(),
    purchase_order_no: z.string(),
    purchase_order_detail_id: z.string().nullable(),
    product_id: z
      .string()
      .nullable()
      .refine((v) => !!v, tv("required", { field: tf("product") })),
    product_name: z.string(),
    // display เท่านั้น — ไม่ส่งเข้า payload (เหมือน product_name)
    product_local_name: z.string(),
    location_id: z
      .string()
      .nullable()
      .refine((v) => !!v, tv("required", { field: tf("location") })),
    location_name: z.string(),
    location_code: z.string(),
    location_type: z.string(),
    // Quantities
    foc_qty: z.coerce.number(),
    foc_unit_id: z.string().nullable(),
    foc_unit_conversion_factor: z.coerce.number(),
    approved_qty: z.coerce.number(),
    approved_unit_id: z.string().nullable(),
    // > 0 ไม่ใช่ >= 1 — ของชั่งน้ำหนักรับเป็นเศษได้ (หมูเนื้อแดง 0.5 kg)
    received_qty: z.coerce
      .number()
      .gt(0, tv("positive", { field: tf("receivedQty") })),
    received_unit_id: z
      .string()
      .nullable()
      .refine((v) => !!v, tv("required", { field: tf("unit") })),
    received_base_qty: z.coerce.number(),
    received_base_unit_id: z.string().nullable(),
    received_unit_conversion_factor: z.coerce.number(),
    // ชื่อหน่วยที่บันทึกไว้ — แสดงอย่างเดียว (ไม่อยู่ใน payload) เป็น defaultLabel
    // ของ LookupProductUnit เมื่อหน่วยนั้นไม่อยู่ในรายการหน่วยปัจจุบันของสินค้าแล้ว
    foc_unit_name: z.string().optional(),
    approved_unit_name: z.string().optional(),
    received_unit_name: z.string().optional(),
    // Tax
    tax_profile_id: z.string().nullable().optional(),
    tax_rate: z.coerce.number(),
    tax_amount: z.coerce.number(),
    is_tax_adjustment: z.boolean(),
    // Discount
    discount_rate: z.coerce.number(),
    discount_amount: z.coerce.number(),
    is_discount_adjustment: z.boolean(),
    // Amounts
    unit_price: z.coerce.number().optional(),
    net_amount: z.coerce.number(),
    total_price: z.coerce.number(),
    // Notes
    description: z.string().optional(),
    note: z.string().optional(),
  });

  // backend บังคับ received_price (= unit_price ของฟอร์ม) เมื่อ received_qty > 0
  // ปล่อยว่างแล้วค่อยไปเจอ 400 ตอนกดบันทึกคือสายไป เตือนที่ช่องตั้งแต่กรอก
  // (ของแถมใช้ช่อง FOC แยกอยู่แล้ว แถวที่รับของจริงจึงต้องมีราคาเสมอ)
  return base.superRefine((item, ctx) => {
    if (item.received_qty <= 0) return;
    const price = Number(item.unit_price);
    if (!Number.isFinite(price) || price <= 0) {
      ctx.addIssue({
        code: "custom",
        message: tv("required", { field: tf("unitPrice") }),
        path: ["unit_price"],
      });
    }
  });
}

function createExtraCostDetailSchema(tv: TranslationFn, tf: TranslationFn) {
  return z.object({
    id: z.string().optional(),
    extra_cost_type_id: z
      .string()
      .min(1, tv("required", { field: tf("extraCost") })),
    note: z.string(),
    amount: z.coerce.number().min(0),
  });
}

export function createGrnSchema(tv: TranslationFn, tf: TranslationFn) {
  return z.object({
    doc_version: z.coerce.number().optional(),
    grn_date: z.string().min(1, tv("required", { field: tf("grnDate") })),
    expired_date: z.string().nullable(),
    invoice_no: z.string().min(1, tv("required", { field: tf("invoiceNo") })),
    invoice_date: z
      .string()
      .nullable()
      .refine((v) => !!v, tv("required", { field: tf("invoiceDate") })),
    description: z.string(),
    note: z.string(),
    doc_status: z.string().min(1, tv("required", { field: tf("docStatus") })),
    doc_type: z.string().min(1, tv("required", { field: tf("docType") })),
    post_type: z.enum(["ap", "consignment", "cash"]),
    credit_term_id: z.string().nullable().optional(),
    credit_term_name: z.string().optional(),
    credit_term_days: z.coerce.number().nullable().optional(),
    payment_due_date: z.string().nullable().optional(),
    is_active: z.boolean(),
    vendor_id: z
      .string()
      .nullable()
      .refine((v) => !!v, tv("required", { field: tf("vendor") })),
    vendor_name: z.string(),
    currency_id: z
      .string()
      .nullable()
      .refine((v) => !!v, tv("required", { field: tf("currency") })),
    currency_name: z.string(),
    exchange_rate: z.coerce.number().nullable(),
    exchange_rate_date: z.string().nullable(),
    info: z.string(),
    dimension: z.string(),
    // Extra cost header
    allocate_extra_cost_type: z.string(),
    // Arrays
    items: z
      .array(createGrnDetailSchema(tv, tf))
      .min(1, tv("required", { field: tf("items") })),
    extra_cost_details: z.array(createExtraCostDetailSchema(tv, tf)),
  });
}

export type GrnFormValues = z.infer<ReturnType<typeof createGrnSchema>>;

export const EMPTY_DETAIL: GrnFormValues["items"][number] = {
  purchase_order_id: null,
  purchase_order_no: "",
  purchase_order_detail_id: null,
  product_id: null,
  product_name: "",
  product_local_name: "",
  location_id: null,
  location_name: "",
  location_code: "",
  location_type: "",
  foc_qty: 0,
  foc_unit_id: null,
  foc_unit_conversion_factor: 0,
  approved_qty: 0,
  approved_unit_id: null,
  received_qty: 0,
  received_unit_id: null,
  received_base_qty: 0,
  received_base_unit_id: null,
  received_unit_conversion_factor: 0,
  tax_profile_id: null,
  tax_rate: 0,
  tax_amount: 0,
  is_tax_adjustment: false,
  discount_rate: 0,
  discount_amount: 0,
  is_discount_adjustment: false,
  unit_price: 0,
  net_amount: 0,
  total_price: 0,
  description: "",
  note: "",
};

// --- Default extra cost detail ---

export const EMPTY_EXTRA_COST: GrnFormValues["extra_cost_details"][number] = {
  extra_cost_type_id: "",
  note: "",
  amount: 0,
};

const objectToText = (
  value: unknown[] | Record<string, unknown> | null | undefined,
): string => {
  if (!value) return "";
  if (Array.isArray(value) && value.length === 0) return "";
  if (typeof value === "object" && Object.keys(value).length === 0) return "";
  return JSON.stringify(value, null, 2);
};

export function getDefaultValues(
  grn?: GoodsReceiveNote,
  options?: {
    defaultCurrencyId?: string;
    defaultCurrencyCode?: string;
  },
): GrnFormValues {
  if (!grn) {
    return {
      grn_date: new Date().toISOString(),
      expired_date: null,
      invoice_no: "",
      invoice_date: null,
      description: "",
      note: "",
      doc_status: "draft",
      doc_type: "purchase_order",
      post_type: "ap",
      credit_term_id: null,
      credit_term_name: "",
      credit_term_days: null,
      // ไม่มีเทอมเครดิต = จ่ายวันนี้ ตั้งเป็นวันนี้ไปเลยดีกว่าปล่อยว่างให้ไปติด
      // required ตอนกดบันทึก · เลือกเทอมเครดิตเมื่อไหร่ `syncDueDate` ในหัวฟอร์ม
      // จะคำนวณทับให้เอง (วันที่ใบแจ้งหนี้ + จำนวนวัน) และแก้เองทับได้ตลอด
      payment_due_date: new Date().toISOString(),
      is_active: true,
      vendor_id: null,
      vendor_name: "",
      currency_id: options?.defaultCurrencyId ?? "",
      currency_name: options?.defaultCurrencyCode ?? "",
      exchange_rate: 1,
      exchange_rate_date: new Date().toISOString(),
      info: "",
      dimension: "",
      allocate_extra_cost_type: "by_qty",
      items: [],
      extra_cost_details: [],
    };
  }

  return {
    doc_version: grn.doc_version,
    grn_date: grn.grn_date ?? "",
    expired_date: grn.expired_date ?? null,
    invoice_no: grn.invoice_no ?? "",
    invoice_date: grn.invoice_date,
    description: grn.description ?? "",
    note: grn.note ?? "",
    doc_status: grn.doc_status,
    doc_type: grn.doc_type,
    post_type: grn.post_type ?? "ap",
    credit_term_id: grn.credit_term?.id ?? null,
    credit_term_name: grn.credit_term?.name ?? "",
    credit_term_days: grn.credit_term_days,
    payment_due_date: grn.payment_due_date,
    is_active: grn.is_active,
    vendor_id: grn.vendor?.id ?? null,
    vendor_name: grn.vendor?.name ?? "",
    currency_id: grn.currency?.id ?? null,
    // ฟอร์มเรียกฟิลด์นี้ว่า currency_name แต่เก็บ "code" จริง ๆ (ใช้แสดงหน่วยเงิน
    // ต่อท้ายราคา) — currency object ของ GRN ไม่มี name ใช้จริง มีแค่ id/code
    currency_name: grn.currency?.code ?? "",
    exchange_rate: grn.exchange_rate ?? 1,
    exchange_rate_date: grn.exchange_rate_date,
    info: objectToText(grn.info),
    dimension: objectToText(grn.dimension),
    // extra_cost เป็น object เดียวที่มีบรรทัดซ้อนอยู่ข้างใน ไม่ใช่ array (ดู type GrnExtraCost)
    allocate_extra_cost_type:
      grn.extra_cost?.allocate_extra_cost_type ?? "by_qty",
    // หนึ่งแถว = หนึ่ง detail ไม่ใช่หนึ่ง item — id ที่ส่งกลับตอน PATCH
    // (good_received_note_detail.update/remove) หลังบ้านเอาไปหาใน
    // tb_good_received_note_detail ถ้าส่ง id ของ items ข้างในไปจะ 404
    // GRN_DETAIL_NOT_FOUND_LIST ทุกครั้งที่แก้แถวเดิม · หลังบ้านเองก็ทำ 1:1 —
    // ตอน add สร้าง detail 1 แถวคู่กับ item 1 แถว ตอน update ก็ findFirst
    // item ตัวแรกของ detail นั้นมาแก้ ตัวที่เกินมาไม่มีใครแตะอยู่แล้ว
    items:
      grn.good_received_note_detail?.map((detail) => {
        // detail ที่ item ถูกลบไปแล้วยังต้องแสดงเป็นแถว (ค่าเป็น 0) ไม่ใช่หายไป
        // เงียบ ๆ — ไม่งั้นแถวนั้นกลายเป็น remove ตอน save ทั้งที่ผู้ใช้ไม่ได้ลบ
        const item = detail.items?.[0];
        return {
          id: detail.id,
          // doc_version ของ detail ไม่ใช่ของ item — หลังบ้านล็อกด้วยเลขของ
          // tb_good_received_note_detail ส่งเลขของ item ไปจะ 409 ทุกครั้ง
          doc_version: detail.doc_version,
          purchase_order_id: detail.purchase_order?.id ?? null,
          purchase_order_no: detail.po_no ?? "",
          purchase_order_detail_id: detail.purchase_order_detail?.id ?? null,
          product_id: detail.product?.id ?? null,
          product_name: detail.product?.name ?? "",
          product_local_name: detail.product?.local_name ?? "",
          location_id: detail.location?.id ?? null,
          location_name: detail.location?.name ?? "",
          location_code: detail.location?.code ?? "",
          location_type: detail.location_type ?? "",
          foc_qty: item?.foc_qty ?? 0,
          foc_unit_id: item?.foc_unit?.id ?? null,
          foc_unit_conversion_factor: item?.foc_unit_conversion_factor ?? 0,
          approved_qty: item?.order_qty ?? 0,
          approved_unit_id: item?.order_unit?.id ?? null,
          foc_unit_name: item?.foc_unit?.name ?? "",
          approved_unit_name: item?.order_unit?.name ?? "",
          received_unit_name: item?.received_unit?.name ?? "",
          received_qty: item?.received_qty ?? 0,
          received_unit_id: item?.received_unit?.id ?? null,
          received_base_qty: item?.received_base_qty ?? 0,
          received_base_unit_id: null,
          received_unit_conversion_factor:
            item?.received_unit_conversion_factor ?? 0,
          tax_profile_id: item?.tax_profile?.id ?? null,
          tax_rate: item?.tax_rate ?? 0,
          tax_amount: item?.tax_amount ?? 0,
          is_tax_adjustment: item?.is_tax_adjustment ?? false,
          discount_rate: item?.discount_rate ?? 0,
          discount_amount: item?.discount_amount ?? 0,
          is_discount_adjustment: item?.is_discount_adjustment ?? false,
          unit_price:
            item && item.received_qty > 0
              ? round2(item.sub_total_price / item.received_qty)
              : 0,
          net_amount: item?.net_amount ?? 0,
          total_price: item?.total_price ?? 0,
          description: "",
          note: item?.note ?? "",
        };
      }) ?? [],
    extra_cost_details:
      grn.extra_cost?.extra_cost_detail?.map((d) => ({
        id: d.id,
        extra_cost_type_id: d.extra_cost_type?.id ?? "",
        note: d.note ?? "",
        amount: d.amount,
      })) ?? [],
  };
}

export function mapDetailToPayload(
  item: GrnFormValues["items"][number],
): GrnDetailPayload {
  return {
    ...(item.doc_version != null ? { doc_version: item.doc_version } : {}),
    purchase_order_detail_id: item.purchase_order_detail_id,
    product_id: item.product_id || "",
    location_id: item.location_id,
    foc_qty: item.foc_qty,
    foc_unit_id: item.foc_unit_id,
    foc_unit_conversion_factor: item.foc_unit_conversion_factor,
    approved_qty: item.approved_qty,
    approved_unit_id: item.approved_unit_id,
    received_qty: item.received_qty,
    received_unit_id: item.received_unit_id,
    received_base_qty: item.received_base_qty,
    received_base_unit_id: item.received_base_unit_id,
    received_unit_conversion_factor: item.received_unit_conversion_factor,
    // ช่อง "ราคา" บนแถว location — ฟอร์มเก็บชื่อ unit_price, backend ชื่อ
    // received_price และบังคับต้องมีเมื่อ received_qty > 0 (ไม่ส่ง = 400)
    received_price: item.unit_price ?? 0,
    ...(item.tax_profile_id ? { tax_profile_id: item.tax_profile_id } : {}),
    tax_rate: item.tax_rate,
    tax_amount: item.tax_amount,
    is_tax_adjustment: item.is_tax_adjustment,
    discount_rate: item.discount_rate,
    discount_amount: item.discount_amount,
    is_discount_adjustment: item.is_discount_adjustment,
    net_amount: item.net_amount,
    total_price: item.total_price,
    description: item.description,
    note: item.note,
  };
}

export function mapExtraCostToPayload(
  item: GrnFormValues["extra_cost_details"][number],
): ExtraCostDetailPayload {
  return {
    extra_cost_type_id: item.extra_cost_type_id,
    note: item.note,
    amount: item.amount,
  };
}
