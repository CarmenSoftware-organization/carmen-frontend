import type { FieldArrayWithId, UseFormReturn } from "react-hook-form";
import { DocumentLineDimensionRow } from "@/components/dimension/document-line-dimension-row";
import type { PrFormValues } from "./pr-form-schema";

/**
 * แถบชิป dimension ของบรรทัด PR (อยู่ในแถวกางของรายการ ท้ายการ์ดเมื่อเป็นโหมดการ์ด) —
 * ซ่อนเมื่อ BU ปิด dimension ของ PR · ชิปที่โชว์ตามกฎของบัญชีบรรทัดนั้น
 * (ดู `DocumentLineDimensionRow`) · โหมดดู/ใบที่พ้น stage create มาจาก hook ของฟอร์ม
 */
export function PrItemDimensions({
  form,
  index,
  disabled,
}: {
  readonly form: UseFormReturn<PrFormValues>;
  readonly index: number;
  readonly disabled: boolean;
}) {
  return (
    <DocumentLineDimensionRow
      form={form}
      index={index}
      disabled={disabled}
      className="mt-3 border-t pt-3"
    />
  );
}

/**
 * แถบชิป dimension ในแถวใต้บรรทัด (ต่อจาก Comment) — ใช้เมื่อตารางไม่มีปุ่มกางแถว
 * คือใบ draft / stage create ซึ่งเป็นช่วงเดียวที่ dimension แก้ได้
 */
export function PrItemFooterDimensions({
  form,
  itemFields,
  item,
  disabled,
}: {
  readonly form: UseFormReturn<PrFormValues>;
  readonly itemFields: FieldArrayWithId<PrFormValues, "items", "id">[];
  readonly item: FieldArrayWithId<PrFormValues, "items", "id">;
  readonly disabled: boolean;
}) {
  const index = itemFields.findIndex((f) => f.id === item.id);
  return (
    <DocumentLineDimensionRow
      form={form}
      index={index}
      disabled={disabled}
      className="-mt-1 px-3 pb-4"
    />
  );
}
