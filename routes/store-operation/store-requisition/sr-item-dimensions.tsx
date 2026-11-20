import { useWatch, type UseFormReturn } from "react-hook-form";
import { LineDimensionPopover } from "@/components/dimension/line-dimension-popover";
import type { SrFormValues } from "./sr-form-schema";

/**
 * ปุ่ม popover dimension ของบรรทัด SR/transfer (คอลัมน์ "Dim") — แก้แล้ว
 * ตั้ง `dimensions_dirty` เพื่อให้ payload ส่ง dimensions ในบรรทัด update
 *
 * ผู้เรียกต้องเช็ค `useLineDimensionsEnabled("sr")` เอง และไม่ใส่คอลัมน์นี้เมื่อปิด
 */
export function SrItemDimensions({
  form,
  index,
  disabled,
}: {
  readonly form: UseFormReturn<SrFormValues>;
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
