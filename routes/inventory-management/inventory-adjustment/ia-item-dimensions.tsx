import { useWatch, type UseFormReturn } from "react-hook-form";
import { LineDimensionPopover } from "@/components/dimension/line-dimension-popover";
import type { AdjFormValues } from "./ia-form-schema";

/**
 * ปุ่ม popover dimension ของบรรทัด stock-in/stock-out (คอลัมน์ "Dim") — แก้แล้ว
 * ตั้ง `dimensions_dirty` เพื่อให้ payload ส่ง dimensions ในบรรทัด update
 *
 * ผู้เรียกต้องเช็ค `useLineDimensionsEnabled("ia")` เอง และไม่ใส่คอลัมน์นี้เมื่อปิด
 */
export function IaItemDimensions({
  form,
  index,
  disabled,
}: {
  readonly form: UseFormReturn<AdjFormValues>;
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
