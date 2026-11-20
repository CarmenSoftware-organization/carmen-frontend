import type { UseFormReturn } from "react-hook-form";
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
