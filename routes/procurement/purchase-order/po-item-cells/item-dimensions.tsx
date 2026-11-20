import type { UseFormReturn } from "react-hook-form";
import { ProcurementLineDimensionRow } from "../../shared/procurement-line-dimension-row";
import type { PoFormValues } from "../po-form-schema";

/**
 * แถบชิป dimension ของบรรทัด PO (แถวย่อยใต้หมายเหตุ) — ซ่อนเมื่อ BU ปิด dimension ของ PO
 * ชิปที่โชว์ตามกฎของบัญชีบรรทัดนั้น (ดู `ProcurementLineDimensionRow`)
 */
export function PoItemDimensions({
  form,
  index,
  disabled,
  offset,
}: {
  readonly form: UseFormReturn<PoFormValues>;
  readonly index: number;
  readonly disabled: boolean;
  /** เยื้องซ้าย (px) ให้ตรงช่องหมายเหตุ */
  readonly offset: number;
}) {
  return (
    <div style={{ paddingLeft: offset }}>
      <ProcurementLineDimensionRow
        form={form}
        index={index}
        disabled={disabled}
      />
    </div>
  );
}
