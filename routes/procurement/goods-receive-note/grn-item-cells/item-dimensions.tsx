import { useWatch, type UseFormReturn } from "react-hook-form";
import { LineDimensionPopover } from "@/components/dimension/line-dimension-popover";
import type { GrnFormValues } from "../grn-form-schema";

/**
 * ปุ่ม popover dimension ของบรรทัด GRN (คอลัมน์ "Dim") — ค่าเริ่มต้นมาจากบรรทัด PO
 * หรือจาก response แก้แล้วตั้ง `dimensions_dirty` เพื่อให้ payload ส่ง dimensions
 * ใน good_received_note_detail.update
 *
 * ผู้เรียกต้องเช็ค `useLineDimensionsEnabled("grn")` เอง และไม่ใส่คอลัมน์นี้เมื่อปิด
 */
export function GrnItemDimensions({
  form,
  index,
  disabled,
}: {
  readonly form: UseFormReturn<GrnFormValues>;
  readonly index: number;
  readonly disabled: boolean;
}) {
  const value = useWatch({
    control: form.control,
    name: `items.${index}.dimensions`,
  });
  return (
    <LineDimensionPopover
      value={value ?? []}
      disabled={disabled}
      onChange={(next) => {
        form.setValue(`items.${index}.dimensions`, next, {
          shouldDirty: true,
        });
        form.setValue(`items.${index}.dimensions_dirty`, true);
      }}
    />
  );
}
