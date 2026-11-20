import type { FieldArrayWithId, UseFormReturn } from "react-hook-form";
import { DocumentLineDimensionRow } from "@/components/dimension/document-line-dimension-row";
import type { AdjFormValues } from "./ia-form-schema";

/**
 * แถวย่อยแถบชิป dimension ใต้บรรทัด stock-in/stock-out (แทนปุ่ม popover เดิม) — ชิปที่โชว์ตามกฎของ
 * บัญชีที่ mapping ของ adjustment type ชี้ไป · โหมดดูเป็นอ่านอย่างเดียวมาจาก hook ของฟอร์ม
 *
 * ใช้เป็น `footerContent` ของตาราง และท้ายการ์ดตอนกล่องแคบ — index หาจาก field array
 * เพราะแถวส่งมาเป็น snapshot ของ useFieldArray
 */
export function IaItemDimensions({
  form,
  itemFields,
  item,
  disabled,
}: {
  readonly form: UseFormReturn<AdjFormValues>;
  readonly itemFields: FieldArrayWithId<AdjFormValues, "items", "id">[];
  readonly item: FieldArrayWithId<AdjFormValues, "items", "id">;
  readonly disabled: boolean;
}) {
  const index = itemFields.findIndex((field) => field.id === item.id);
  return (
    <DocumentLineDimensionRow
      form={form}
      index={index}
      disabled={disabled}
      className="pb-2"
    />
  );
}
