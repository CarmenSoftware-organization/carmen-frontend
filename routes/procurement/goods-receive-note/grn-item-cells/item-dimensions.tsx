import type { FieldArrayWithId, UseFormReturn } from "react-hook-form";
import { DocumentLineDimensionRow } from "@/components/dimension/document-line-dimension-row";
import type { GrnFormValues } from "../grn-form-schema";

/**
 * แถวย่อยแถบชิป dimension ใต้บรรทัด GRN (แทนปุ่ม popover เดิม) — ค่าเริ่มต้นมาจากบรรทัด PO
 * แก้ได้เสมอตราบที่ใบยังไม่ committed แม้บรรทัดถูกล็อกเรื่องสต๊อก (กฎเรื่อง dimension ไม่ผูกกับสต๊อก)
 *
 * ใช้เป็น `footerContent` ของตาราง และท้ายการ์ดตอนกล่องแคบ — index หาจาก field array
 * เพราะแถวส่งมาเป็น snapshot ของ useFieldArray
 */
export function GrnItemDimensions({
  form,
  itemFields,
  item,
  disabled,
}: {
  readonly form: UseFormReturn<GrnFormValues>;
  readonly itemFields: FieldArrayWithId<GrnFormValues, "items", "id">[];
  readonly item: FieldArrayWithId<GrnFormValues, "items", "id">;
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
