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

export interface AutoAllocateMessages {
  allocating: (count: number) => string;
  allocated: (allocated: number, total: number) => string;
  allocateFailed: (count: number) => string;
  noPriceListFound: string;
}

/**
 * ดึงราคาจาก price list ให้ทุกรายการในใบอัตโนมัติ (ผู้ขาย ราคา ภาษี อัตราแลกเปลี่ยน)
 *
 * อยู่ในไฟล์กลางเพราะตรรกะว่าจะเลือกราคาไหน/เคลียร์ field อะไรเมื่อไม่เจอราคา
 * ห้ามแตกเป็นหลายชุด
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
        form.setValue(`items.${index}.vendor_id`, null);
        form.setValue(`items.${index}.vendor_name`, "");
        form.setValue(`items.${index}.pricelist_price`, 0);
        form.setValue(`items.${index}.pricelist_type`, null);
        form.setValue(`items.${index}.pricelist_detail_id`, null);
        form.setValue(`items.${index}.pricelist_no`, null);
        // ไม่มีราคา → ยอด derive กลับเป็น 0 (tax_rate คงเดิม)
        applyDerivedAmounts(form, index, item, 0, Number(item.tax_rate) || 0);
        return;
      }

      form.setValue(`items.${index}.vendor_id`, selected.vendor_id);
      form.setValue(`items.${index}.vendor_name`, selected.vendor_name);
      form.setValue(`items.${index}.pricelist_price`, selected.price);
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
      );
      allocated++;
    }),
  );

  toast.dismiss(toastId);
  const failed = results.filter((r) => r.status === "rejected").length;
  if (allocated > 0) toast.success(msg.allocated(allocated, items.length));
  if (failed > 0) toast.error(msg.allocateFailed(failed));
  if (allocated === 0 && failed === 0) toast.warning(msg.noPriceListFound);
}
