import { memo, useEffect } from "react";
import { useWatch, type Control, type UseFormReturn } from "react-hook-form";
import { formatCurrency } from "@/lib/currency-utils";
import type { PoFormValues } from "../po-form-schema";
import { computeItemPricing } from "../po-item-pricing";
import { HiddenValue } from "@/components/share/hidden-value";

export const ComputedPricingCell = function ComputedPricingCell({
  control,
  index,
  field: displayField,
  isHidden = false,
}: {
  control: Control<PoFormValues>;
  index: number;
  field:
    | "sub_total_price"
    | "discount_amount"
    | "net_amount"
    | "tax_amount"
    | "total_price";
  /** stage ซ่อน `total_price` — badge แทนยอด (ยอดในฟอร์มเป็น 0 ปลอมจาก null) */
  isHidden?: boolean;
}) {
  "use no memo";
  const item = useWatch({ control, name: `items.${index}` });
  const { subtotal, discountAmount, netAmount, taxAmount, totalPrice } =
    computeItemPricing(item);
  const values = {
    sub_total_price: subtotal,
    discount_amount: discountAmount,
    net_amount: netAmount,
    tax_amount: taxAmount,
    total_price: totalPrice,
  };
  if (isHidden) {
    return (
      <span className="flex justify-end">
        <HiddenValue />
      </span>
    );
  }
  return (
    <span className="block text-right tabular-nums">
      {formatCurrency(values[displayField])}
    </span>
  );
};

export const PoItemComputedSync = memo(function PoItemComputedSync({
  control,
  form,
  index,
  skip = false,
}: {
  control: Control<PoFormValues>;
  form: UseFormReturn<PoFormValues>;
  index: number;
  /** ราคาถูก stage ซ่อน — ห้ามคำนวณ/เขียนยอดกลับจาก null ที่กลายเป็น 0 */
  skip?: boolean;
}) {
  "use no memo";
  const item = useWatch({ control, name: `items.${index}` });
  const {
    subtotal,
    discountAmount,
    netAmount,
    taxAmount,
    totalPrice,
    baseQty,
  } = computeItemPricing(item);

  useEffect(() => {
    if (skip) return;
    // ห้ามเขียน order_qty กลับ — ตั้งแต่แถวหนึ่ง = คลังเดียว มันเป็น **ช่องที่ผู้ใช้
    // กรอก** ไม่ใช่ค่า derived จากผลรวม locations เหมือนเดิม เขียนทับทุก keystroke
    // = สู้กับ input ที่ register ไว้ที่ field เดียวกัน (โฟกัส/เคอร์เซอร์หลุด)
    form.setValue(`items.${index}.sub_total_price`, subtotal);
    form.setValue(`items.${index}.discount_amount`, discountAmount);
    form.setValue(`items.${index}.net_amount`, netAmount);
    form.setValue(`items.${index}.tax_amount`, taxAmount);
    form.setValue(`items.${index}.total_price`, totalPrice);
    form.setValue(`items.${index}.base_qty`, baseQty);
  }, [
    form,
    index,
    subtotal,
    discountAmount,
    netAmount,
    taxAmount,
    totalPrice,
    baseQty,
    skip,
  ]);

  return null;
});
