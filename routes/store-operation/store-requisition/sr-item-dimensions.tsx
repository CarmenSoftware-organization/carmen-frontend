import type { FieldArrayWithId, UseFormReturn } from "react-hook-form";
import { DocumentLineDimensionRow } from "@/components/dimension/document-line-dimension-row";
import type { SrFormValues } from "./sr-form-schema";

/**
 * แถวย่อยแถบชิป dimension ใต้บรรทัด SR (แทนปุ่ม popover เดิม) — ชิปที่โชว์ตามกฎที่รวมของบัญชี
 * สองฝั่ง (`sr_out` + `sr_in`) · โหมดดู/ผู้อนุมัติ/ผู้จ่ายเป็นอ่านอย่างเดียวมาจาก hook ของฟอร์ม
 *
 * ใช้เป็น `footerContent` ของตาราง และท้ายการ์ดตอนกล่องแคบ — index หาจาก field array
 * เพราะแถวส่งมาเป็น snapshot ของ useFieldArray
 */
export function SrItemDimensions({
  form,
  itemFields,
  item,
  disabled,
}: {
  readonly form: UseFormReturn<SrFormValues>;
  readonly itemFields: FieldArrayWithId<SrFormValues, "items", "id">[];
  readonly item: FieldArrayWithId<SrFormValues, "items", "id">;
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
