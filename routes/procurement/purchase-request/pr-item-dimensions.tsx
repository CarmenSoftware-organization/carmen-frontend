import type { FieldArrayWithId, UseFormReturn } from "react-hook-form";
import { DocumentLineDimensionRow } from "@/components/dimension/document-line-dimension-row";
import type { PrFormValues } from "./pr-form-schema";

/**
 * แถบชิป dimension ของบรรทัด PR ในแถวใต้บรรทัด (ต่อจาก Comment) — ทุก stage ทุกโหมด
 * ซ่อนเมื่อ BU ปิด dimension ของ PR · ชิปที่โชว์ตามกฎของบัญชีบรรทัดนั้น (ดู `DocumentLineDimensionRow`)
 * · แก้ได้เฉพาะ stage create (โหมดดู/ใบที่พ้น stage create มาจาก hook ของฟอร์ม)
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
