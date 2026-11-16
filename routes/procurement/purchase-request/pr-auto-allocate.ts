import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { httpClient } from "@/lib/http-client";
import { buildUrl } from "@/lib/build-query-string";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { formatDate } from "@/lib/date-utils";
import { PR_ITEM_PRICELIST_COMPARE_TYPE } from "@/types/purchase-request";
import {
  computePrItemAmounts,
  resolveApprovedQty,
  type PrFormValues,
} from "./pr-form-schema";

/**
 * คำนวณ + set ยอด derive ของ item (discount/tax/net/total) หลังดึงราคาอัตโนมัติ
 *
 * หน้าฟอร์ม sync ยอดใน `pr-item-expand` ซึ่ง mount เฉพาะตอนกางแถว — แถวที่
 * หุบอยู่จึงต้องคำนวณตรงนี้เอง เรียกซ้ำก็ได้ผลเท่าเดิม (idempotent)
 */
export function applyDerivedAmounts(
  form: UseFormReturn<PrFormValues>,
  index: number,
  item: PrFormValues["items"][number],
  price: number,
  taxRate: number,
  isTaxIncluded = false,
) {
  const qty = resolveApprovedQty(item);
  const isDiscAdj = item.is_discount_adjustment ?? false;
  const isTaxAdj = item.is_tax_adjustment ?? false;
  const amounts = computePrItemAmounts({
    price,
    qty,
    discRate: Number(item.discount_rate) || 0,
    isDiscAdj,
    discAmt: Number(item.discount_amount) || 0,
    taxRate,
    isTaxAdj,
    taxAmt: Number(item.tax_amount) || 0,
    isTaxIncluded,
  });
  if (!isDiscAdj) {
    form.setValue(`items.${index}.discount_amount`, amounts.discountAmount);
  }
  if (!isTaxAdj) {
    form.setValue(`items.${index}.tax_amount`, amounts.taxAmount);
  }
  form.setValue(`items.${index}.net_amount`, amounts.netAmount);
  form.setValue(`items.${index}.total_price`, amounts.totalPrice);
}

/**
 * ผู้ขายของใบราคาล่าสุดที่เคยเสนอสินค้านี้ — `last_vendor` ของ price-compare
 * backend ส่งมาเฉพาะตอนไม่มีใบราคาที่เปิดอยู่ และ**ไม่มีราคามาด้วย** (ราคาเก่าไม่ใช่ข้อเสนอ
 * ของใครแล้ว จัดซื้อต้องกรอกเอง) เลขใบราคา/ช่วงวันที่มีไว้บอกที่มาเท่านั้น ห้ามเขียนลงบรรทัด
 */
export interface LastPricelistVendor {
  vendor_id: string;
  vendor_name: string;
  vendor_code: string | null;
  pricelist_no: string;
  pricelist_status: string;
  effective_date: { from: string | null; to: string | null };
}

/**
 * บรรทัดที่ไม่มีใบราคาที่เปิดอยู่: ใส่ผู้ขายล่าสุดที่เคยเสนอราคาสินค้านี้ (ไม่มี = ล้างผู้ขาย)
 * แล้วล้างทุกอย่างที่มากับใบราคา — ราคา 0 ให้จัดซื้อกรอกเอง ห้ามผูกเลขใบราคาเก่า
 *
 * ใช้ทั้ง auto-allocate และปุ่ม "ใช้ผู้ขายนี้" ในหน้าต่างเทียบราคา ให้สองทางได้ผลเหมือนกัน
 */
export function applyNoPricelist(
  form: UseFormReturn<PrFormValues>,
  index: number,
  item: PrFormValues["items"][number],
  lastVendor: LastPricelistVendor | null,
) {
  form.setValue(`items.${index}.vendor_id`, lastVendor?.vendor_id ?? null);
  form.setValue(`items.${index}.vendor_name`, lastVendor?.vendor_name ?? "");
  form.setValue(`items.${index}.pricelist_price`, 0);
  // ราคากับธง Inc VAT มาจากแหล่งเดียวกันเสมอ — ไม่มีราคา ธงก็รีเป็นปิด
  form.setValue(`items.${index}.is_tax_included`, false);
  form.setValue(`items.${index}.pricelist_type`, null);
  form.setValue(`items.${index}.pricelist_detail_id`, null);
  form.setValue(`items.${index}.pricelist_no`, null);
  // ไม่มีราคา → ยอด derive กลับเป็น 0 (tax_rate คงเดิม)
  applyDerivedAmounts(form, index, item, 0, Number(item.tax_rate) || 0);
}

export interface AutoAllocateMessages {
  allocating: (count: number) => string;
  allocated: (allocated: number, total: number) => string;
  /** ไม่มีใบราคาที่เปิดอยู่ ใส่ผู้ขายล่าสุดให้แล้ว แต่ราคาต้องกรอกเอง */
  vendorOnly: (count: number) => string;
  allocateFailed: (count: number) => string;
  noPriceListFound: string;
}

/**
 * ดึงราคาจาก price list ให้ทุกรายการในใบอัตโนมัติ (ผู้ขาย ราคา ภาษี อัตราแลกเปลี่ยน)
 *
 * อยู่ในไฟล์กลางเพราะตรรกะว่าจะเลือกราคาไหน/เคลียร์ field อะไรเมื่อไม่เจอราคา
 * ห้ามแตกเป็นหลายชุด · ไม่มีใบราคาที่เปิดอยู่ = ใส่ผู้ขายล่าสุดให้ แต่ราคาว่าง (ดู applyNoPricelist)
 *
 * @param form - ฟอร์ม PR ที่จะเขียนค่ากลับ
 * @param buCode - รหัส business unit สำหรับ endpoint เทียบราคา
 * @param msg - ข้อความ toast (แปลแล้ว)
 */
export async function runPrAutoAllocate(
  form: UseFormReturn<PrFormValues>,
  buCode: string | undefined,
  msg: AutoAllocateMessages,
): Promise<void> {
  const items = form.getValues("items");
  if (items.length === 0 || !buCode) return;

  const toastId = toast.loading(msg.allocating(items.length));
  let allocated = 0;
  let vendorOnly = 0;

  const results = await Promise.allSettled(
    items.map(async (item, index) => {
      if (!item.product_id || !item.requested_unit_id || !item.currency_id)
        return;

      const url = buildUrl(API_ENDPOINTS.PRICE_LIST_COMPARE(buCode), {
        product_id: item.product_id,
        unit_id: item.requested_unit_id,
        at_date: formatDate(item.delivery_date, "yyyy-MM-dd"),
        currency_id: item.currency_id,
        // ราคาขึ้นกับจำนวนที่สั่ง (ขั้นบันได MOQ) — ไม่ส่งจำนวนไป backend จะเลือก
        // tier ที่ถูกสุดแม้จำนวนยังไม่ถึงขั้นต่ำ ใช้ตัวเดียวกับที่ applyDerivedAmounts
        // คิดยอด; 0 → "" ให้ backend ถือว่าไม่ระบุ (ดู pr-pricelist-dialog)
        qty: resolveApprovedQty(item) || "",
      });

      const res = await httpClient.get(url);
      if (!res.ok) throw new Error("fetch failed");

      const json = await res.json();
      const selected = json.data?.selected;
      if (!selected) {
        // backend ตอบ last_vendor เฉพาะตอนไม่มีใบราคาที่เปิดอยู่เลย — ใบราคาเปิดอยู่แต่จำนวน
        // ไม่ถึงขั้นต่ำได้ null ผู้ขายจึงถูกล้างเหมือนเดิม
        const lastVendor: LastPricelistVendor | null =
          json.data?.last_vendor ?? null;
        applyNoPricelist(form, index, item, lastVendor);
        if (lastVendor) vendorOnly++;
        return;
      }

      form.setValue(`items.${index}.vendor_id`, selected.vendor_id);
      form.setValue(`items.${index}.vendor_name`, selected.vendor_name);
      form.setValue(`items.${index}.pricelist_price`, selected.price);
      form.setValue(
        `items.${index}.is_tax_included`,
        selected.is_tax_included ?? false,
      );
      form.setValue(
        `items.${index}.pricelist_type`,
        PR_ITEM_PRICELIST_COMPARE_TYPE.AUTOMATIC,
      );
      form.setValue(
        `items.${index}.pricelist_detail_id`,
        selected.pricelist_detail_id,
      );
      form.setValue(`items.${index}.pricelist_no`, selected.pricelist_no);
      form.setValue(`items.${index}.exchange_rate`, selected.exchange_rate);
      form.setValue(`items.${index}.tax_profile_id`, selected.tax_profile_id);
      form.setValue(
        `items.${index}.tax_profile_name`,
        selected.tax_profile_name,
      );
      form.setValue(`items.${index}.tax_rate`, selected.tax_rate);
      applyDerivedAmounts(
        form,
        index,
        item,
        selected.price,
        Number(selected.tax_rate) || 0,
        selected.is_tax_included ?? false,
      );
      allocated++;
    }),
  );

  toast.dismiss(toastId);
  const failed = results.filter((r) => r.status === "rejected").length;
  if (allocated > 0) toast.success(msg.allocated(allocated, items.length));
  if (vendorOnly > 0) toast.warning(msg.vendorOnly(vendorOnly));
  if (failed > 0) toast.error(msg.allocateFailed(failed));
  if (allocated === 0 && vendorOnly === 0 && failed === 0)
    toast.warning(msg.noPriceListFound);
}
