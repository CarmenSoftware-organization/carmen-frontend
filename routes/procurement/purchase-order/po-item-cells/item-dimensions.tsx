import { useWatch, type UseFormReturn } from "react-hook-form";
import { LineDimensionFields } from "@/components/dimension/line-dimension-fields";
import { useLineDimensionsEnabled } from "@/hooks/use-line-dimensions-enabled";
import type { PoFormValues } from "../po-form-schema";

/**
 * ช่อง dimension ของบรรทัด PO — ซ่อนเมื่อ BU ไม่มี license / ไม่มี dimension active
 * แก้แล้วตั้ง `dimensions_dirty` เพื่อให้ payload ส่ง dimensions ใน details.update
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
  const enabled = useLineDimensionsEnabled("po");
  const value = useWatch({
    control: form.control,
    name: `items.${index}.dimensions`,
  });
  if (!enabled) return null;
  return (
    <div className="mt-2" style={{ paddingLeft: offset }}>
      <LineDimensionFields
        value={value ?? []}
        disabled={disabled}
        onChange={(next) => {
          form.setValue(`items.${index}.dimensions`, next, {
            shouldDirty: true,
          });
          form.setValue(`items.${index}.dimensions_dirty`, true);
        }}
      />
    </div>
  );
}
