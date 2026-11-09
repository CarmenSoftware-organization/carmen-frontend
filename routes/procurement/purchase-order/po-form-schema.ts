import { z } from "zod";
import { computeLineAmounts } from "@/lib/line-pricing";
import type { TranslationFn } from "@/lib/i18n-schema";
import type {
  PurchaseOrder,
  PoDetailPayload,
  PrDetailRefPayload,
} from "@/types/purchase-order";

const prDetailSchema = z.object({
  // null ได้ — แถวที่ไม่ได้มาจาก PR (สร้างเองหรือมาจาก price list)
  pr_detail_id: z.string().nullable(),
  order_qty: z.coerce.number(),
  order_base_qty: z.coerce.number(),
  received_qty: z.coerce.number(),
  foc_qty: z.coerce.number(),
});

export function createPoDetailSchema(tv: TranslationFn, tf: TranslationFn) {
  return z.object({
    id: z.string().optional(),
    doc_version: z.coerce.number().optional(),
    description: z.string(),
    product_id: z
      .string()
      .nullable()
      .refine((v) => !!v, tv("required", { field: tf("product") })),
    product_code: z.string(),
    product_name: z.string(),
    product_local_name: z.string(),
    product_sku: z.string(),
    order_unit_id: z.string().nullable(),
    order_unit_name: z.string(),
    order_unit_conversion_factor: z.coerce.number(),
    // 0 ได้ — ของชั่งน้ำหนักสั่งเป็นเศษได้ (เกลือ 0.5 kg) และร่างที่ยังไม่รู้ยอด
    // ก็ต้องเซฟไว้ก่อนได้ ขั้นต่ำ 1 บังคับให้พิมพ์เลขก่อนถึงจะบันทึกได้ · ที่ยังกัน
    // อยู่คือค่าติดลบ ซึ่งพิมพ์เข้ามาได้จริง (เกณฑ์เดียวกับ PR/PRT)
    order_qty: z.coerce
      .number()
      .min(0, tv("minNumber", { field: tf("qty"), min: 0 })),
    base_unit_id: z.string().nullable(),
    base_unit_name: z.string(),
    base_qty: z.coerce.number(),
    price: z.coerce.number().min(0),
    sub_total_price: z.coerce.number(),
    net_amount: z.coerce.number(),
    total_price: z.coerce.number(),
    tax_profile_id: z.string().nullable().optional(),
    tax_profile_name: z.string().optional(),
    tax_rate: z.coerce.number().optional(),
    tax_amount: z.coerce.number().optional(),
    is_tax_adjustment: z.boolean().optional(),
    /** ราคา (price) รวม VAT แล้ว — คู่กับราคาเสมอ */
    is_tax_included: z.boolean().optional(),
    discount_rate: z.coerce.number().optional(),
    discount_amount: z.coerce.number().optional(),
    is_discount_adjustment: z.boolean().optional(),
    is_foc: z.boolean(),
    foc_qty: z.coerce.number(),
    foc_unit_id: z.string().nullable(),
    foc_unit_name: z.string(),
    // แถวหนึ่ง = คลังเดียว ตั้งแต่ backend เลิก group location — ของเดิมเป็น
    // `locations[]` ซ้อนในแถว แล้ว qty/ภาษี/ส่วนลดของแถวเป็นผลรวมของทุก location
    location_id: z
      .string()
      .nullable()
      .refine((v) => !!v, tv("required", { field: tf("location") })),
    location_code: z.string(),
    location_name: z.string(),
    delivery_point_id: z.string().nullable(),
    delivery_point_name: z.string(),
    comment: z.string(),
    received_qty: z.coerce.number(),
    foc_received_qty: z.coerce.number(),
    current_stage_status: z.string(),
    stage_status: z.string().optional(),
    stage_message: z.string().optional(),
    pr_details: z.array(prDetailSchema),
    // ประวัติ workflow ระดับรายการ (display-only passthrough, ไม่ส่งกลับ API)
    // user.name ไม่บังคับ — บาง entry หลังบ้านส่งมาแค่ id
    history: z
      .array(
        z.object({
          at: z.string(),
          seq: z.coerce.number(),
          name: z.string(),
          user: z.object({ id: z.string(), name: z.string().optional() }),
          status: z.string(),
          message: z.string().nullish(),
        }),
      )
      .optional(),
  });
}

export function createPoSchema(
  tv: TranslationFn,
  tf: TranslationFn,
  isManual = true,
) {
  return z.object({
    doc_version: z.coerce.number().optional(),
    workflow_id: isManual
      ? z.string().min(1, tv("required", { field: tf("workflow") }))
      : z.string(),
    vendor_id: z.string().min(1, tv("required", { field: tf("vendor") })),
    vendor_name: z.string(),
    delivery_date: z
      .string()
      .min(1, tv("required", { field: tf("deliveryDate") })),
    currency_id: z.string().min(1, tv("required", { field: tf("currency") })),
    currency_code: z.string().optional(),
    exchange_rate: z.coerce.number().min(0),
    description: z.string(),
    order_date: z.string().min(1, tv("required", { field: tf("orderDate") })),
    credit_term_id: z.string(),
    credit_term_name: z.string(),
    credit_term_value: z.coerce.number(),
    buyer_id: z.string(),
    buyer_name: z.string(),
    email: z.string(),
    remarks: z.string(),
    note: z.string(),
    items: z
      .array(createPoDetailSchema(tv, tf))
      .min(1, tv("required", { field: tf("items") })),
  });
}

export type PoFormValues = z.infer<ReturnType<typeof createPoSchema>>;

export const PO_ITEM: PoFormValues["items"][number] = {
  description: "",
  product_id: null,
  product_code: "",
  product_name: "",
  product_local_name: "",
  product_sku: "",
  order_unit_id: null,
  order_unit_name: "",
  order_unit_conversion_factor: 1,
  order_qty: 0,
  base_unit_id: null,
  base_unit_name: "",
  // ยอดฐาน = order_qty x ตัวคูณหน่วย — PoItemComputedSync เขียนทับให้เองตอนกรอก
  // ค่าเริ่มต้นจึงต้องตามจำนวนสั่ง (0) ไม่ใช่ 1 ที่ไม่ได้มาจากอะไรเลย
  base_qty: 0,
  price: 0,
  sub_total_price: 0,
  net_amount: 0,
  total_price: 0,
  tax_profile_id: null,
  tax_profile_name: "",
  tax_rate: 0,
  tax_amount: 0,
  discount_rate: 0,
  discount_amount: 0,
  is_foc: false,
  current_stage_status: "pending",
  stage_status: "",
  stage_message: "",
  pr_details: [] as PrDetailRefPayload[],
  // แถวหนึ่ง = คลังเดียว — แถวใหม่เริ่มด้วยคลังว่าง ให้ validate แดงเองตอน save
  // (location_id ว่าง = required) ไม่ใช่ปล่อยผ่านแล้วไปตายที่ backend
  location_id: null as string | null,
  location_code: "",
  location_name: "",
  delivery_point_id: null as string | null,
  delivery_point_name: "",
  comment: "",
  received_qty: 0,
  foc_qty: 0,
  foc_received_qty: 0,
  foc_unit_id: null as string | null,
  foc_unit_name: "",
  is_tax_adjustment: false,
  is_tax_included: false,
  is_discount_adjustment: false,
};

export const EMPTY_FORM: PoFormValues = {
  workflow_id: "",
  vendor_id: "",
  vendor_name: "",
  delivery_date: "",
  currency_id: "",
  currency_code: "",
  exchange_rate: 1,
  description: "",
  order_date: "",
  credit_term_id: "",
  credit_term_name: "",
  credit_term_value: 0,
  buyer_id: "",
  buyer_name: "",
  email: "",
  remarks: "",
  note: "",
  items: [],
};

export function getDefaultValues(
  po?: PurchaseOrder,
  options?: {
    defaultCurrencyId?: string;
    buyerId?: string;
    buyerName?: string;
    email?: string;
  },
): PoFormValues {
  if (po) {
    return {
      doc_version: po.doc_version,
      workflow_id: po.workflow?.id ?? "",
      vendor_id: po.vendor?.id ?? "",
      vendor_name: po.vendor?.name ?? "",
      delivery_date: po.delivery_date ?? "",
      currency_id: po.currency?.id ?? "",
      currency_code: po.currency?.code ?? "",
      exchange_rate: po.exchange_rate ?? 1,
      description: po.description ?? "",
      order_date: po.order_date ?? "",
      credit_term_id: po.credit_term?.id ?? "",
      credit_term_name: po.credit_term?.name ?? "",
      credit_term_value: po.credit_term_value ?? 0,
      buyer_id: po.buyer?.id ?? "",
      buyer_name: po.buyer?.name ?? "",
      email: po.email ?? "",
      remarks: po.remarks ?? "",
      // response ใหม่ไม่มี `note` ที่หัวเอกสารแล้ว — ฟอร์มยังมีช่องนี้อยู่
      // (ส่งใน payload ได้) แต่โหลดกลับมาไม่ได้ ตั้งว่างไว้ก่อน
      note: "",
      items:
        po.purchase_order_detail?.map((d) => ({
          id: d.id,
          doc_version: d.doc_version,
          description: d.description ?? "",
          product_id: d.product?.id ?? null,
          product_code: d.product?.code ?? "",
          product_name: d.product?.name ?? "",
          product_local_name: d.product?.local_name ?? "",
          product_sku: d.product_sku ?? "",
          order_unit_id: d.order_unit?.id ?? null,
          order_unit_name: d.order_unit?.name ?? "",
          order_unit_conversion_factor: d.order_unit_conversion_factor ?? 1,
          order_qty: d.order_qty,
          base_unit_id: d.base_unit?.id ?? null,
          base_unit_name: d.base_unit?.name ?? "",
          base_qty: d.base_qty ?? d.order_qty,
          price:
            d.price ??
            (d.order_qty > 0
              ? Math.round((d.sub_total_price / d.order_qty) * 100) / 100
              : 0),
          sub_total_price: d.sub_total_price ?? 0,
          net_amount: d.net_amount ?? 0,
          total_price: d.total_price ?? 0,
          tax_profile_id: d.tax_profile?.id ?? null,
          tax_profile_name: d.tax_profile?.name ?? "",
          tax_rate: d.tax_rate ?? 0,
          tax_amount: d.tax_amount ?? 0,
          discount_rate: d.discount_rate ?? 0,
          discount_amount: d.discount_amount ?? 0,
          is_foc: d.is_foc ?? false,
          current_stage_status: d.current_stage_status ?? "pending",
          stage_status: "",
          stage_message: "",
          // pr_details ของแถวนี้เป็น object (pr_detail: EntityRef|null) จาก detail
          // endpoint — ฟอร์มเก็บฟิลด์เดิม (pr_detail_id แบบ flat) เพราะ payload ที่
          // ส่งกลับก็ยังเป็น flat เหมือนเดิม (ดู mapItemToPayload/PrDetailRefPayload)
          pr_details: (d.pr_details ?? []).map((pr) => ({
            pr_detail_id: pr.pr_detail?.id ?? null,
            order_qty: pr.order_qty,
            order_base_qty: pr.order_base_qty,
            received_qty: pr.received_qty,
            foc_qty: pr.foc_qty,
          })),
          history: d.history,
          // แถวหนึ่ง = คลังเดียว — ค่าพวกนี้เคยอยู่ใน locations[0] ตอน backend ยัง group
          location_id: d.location?.id ?? null,
          location_code: d.location?.code ?? "",
          location_name: d.location?.name ?? "",
          delivery_point_id: d.delivery_point?.id ?? null,
          delivery_point_name: d.delivery_point?.name ?? "",
          comment: d.comment ?? "",
          foc_qty: d.foc_qty ?? 0,
          // ไม่มี foc_unit บน wire เลย (ดูคอมเมนต์ที่ PurchaseOrderDetail) — ตั้งว่างไว้
          foc_unit_id: null as string | null,
          foc_unit_name: "",
          // ยอดที่รับแล้วอยู่ใน pr_details ไม่ได้อยู่บนแถว — รวมทุกใบ PR ที่อ้างถึง
          received_qty: (d.pr_details ?? []).reduce(
            (sum, pr) => sum + (pr.received_qty ?? 0),
            0,
          ),
          // ?? 0 ทั้งที่ type บอกว่าเป็น number เสมอ — ใบเก่าที่บันทึกก่อน backend
          // เพิ่มฟิลด์นี้ยังไม่มีมันบน wire ปล่อย undefined เข้าฟอร์มแล้วจะโชว์ NaN
          foc_received_qty: d.foc_received_qty ?? 0,
          is_tax_adjustment: d.is_tax_adjustment ?? false,
          is_tax_included: d.is_tax_included ?? false,
          is_discount_adjustment: d.is_discount_adjustment ?? false,
        })) ?? [],
    };
  }
  return {
    ...EMPTY_FORM,
    order_date: new Date().toISOString(),
    currency_id: options?.defaultCurrencyId ?? "",
    buyer_id: options?.buyerId ?? "",
    buyer_name: options?.buyerName ?? "",
    email: options?.email ?? "",
  };
}

export function mapItemToPayload(
  item: PoFormValues["items"][number],
  index: number,
): PoDetailPayload {
  const price = item.price ?? 0;
  const conversion = item.order_unit_conversion_factor ?? 1;

  // ยอดของแถว = ยอดของคลังเดียว ไม่ต้องรวมข้าม location อีกแล้ว
  const { subtotal, discountAmount, netAmount, taxAmount, totalPrice } =
    computeLineAmounts({
      price,
      qty: item.order_qty ?? 0,
      discRate: item.discount_rate ?? 0,
      isDiscAdj: item.is_discount_adjustment ?? false,
      discAmt: item.discount_amount ?? 0,
      taxRate: item.tax_rate ?? 0,
      isTaxAdj: item.is_tax_adjustment ?? false,
      taxAmt: item.tax_amount ?? 0,
      isTaxIncluded: item.is_tax_included ?? false,
    });

  return {
    ...(item.doc_version != null ? { doc_version: item.doc_version } : {}),
    sequence: index + 1,
    product_id: item.product_id || "",
    product_code: item.product_code ?? "",
    product_name: item.product_name ?? "",
    product_local_name: item.product_local_name ?? "",
    product_sku: item.product_sku ?? "",
    order_unit_id: item.order_unit_id || "",
    order_unit_name: item.order_unit_name ?? "",
    order_unit_conversion_factor: conversion,
    order_qty: item.order_qty,
    base_unit_id: item.base_unit_id || item.order_unit_id || "",
    base_unit_name: item.base_unit_name ?? "",
    base_qty: item.base_qty ?? item.order_qty,
    price,
    sub_total_price: subtotal,
    net_amount: netAmount,
    total_price: totalPrice,
    tax_profile_id: item.tax_profile_id ?? null,
    tax_profile_name: item.tax_profile_name ?? "",
    tax_rate: item.tax_rate ?? 0,
    tax_amount: taxAmount,
    is_tax_adjustment: item.is_tax_adjustment ?? false,
    // ส่งทุกแถวเสมอ — verify-save ฝั่ง BE อ่านค่านี้จาก payload อย่างเดียว
    is_tax_included: item.is_tax_included ?? false,
    is_foc: item.is_foc ?? false,
    foc_qty: item.foc_qty ?? 0,
    // ไม่ได้เลือกหน่วยแถมไว้ = ใช้หน่วยสั่งซื้อของแถว ปลายทางจะได้ไม่ได้จำนวนลอย ๆ
    // ที่ไม่รู้ว่านับเป็นหน่วยอะไร
    foc_unit_id: item.foc_unit_id || item.order_unit_id || null,
    foc_unit_name: item.foc_unit_name || item.order_unit_name || "",
    discount_rate: item.discount_rate ?? 0,
    discount_amount: discountAmount,
    is_discount_adjustment: item.is_discount_adjustment ?? false,
    pr_details: item.pr_details ?? [],
    description: item.description ?? "",
    location_id: item.location_id || null,
    location_code: item.location_code ?? "",
    location_name: item.location_name ?? "",
    delivery_point_id: item.delivery_point_id || null,
    delivery_point_name: item.delivery_point_name ?? "",
    comment: item.comment || "",
  };
}
