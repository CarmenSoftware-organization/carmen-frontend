import { useWatch, type UseFormReturn } from "react-hook-form";
import { LineDimensionFields } from "@/components/dimension/line-dimension-fields";
import { useLineDimensionsEnabled } from "@/hooks/use-line-dimensions-enabled";
import type { PrFormValues } from "./pr-form-schema";

/**
 * ช่อง dimension ของบรรทัด PR (อยู่ในแถวกางของรายการ) — ซ่อนเมื่อ BU ไม่มี
 * license / ไม่มี dimension active · แก้แล้วตั้ง `dimensions_dirty` เพื่อให้
 * payload ส่ง dimensions ใน details.update เฉพาะบรรทัดที่แก้
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
  const enabled = useLineDimensionsEnabled();
  const value = useWatch({
    control: form.control,
    name: `items.${Math.max(index, 0)}.dimensions`,
  });
  // index -1 = แถวหลุดจาก itemFields ชั่วคราวตอนลบ — ไม่วาดดีกว่าผูกกับ items.-1
  if (!enabled || index < 0) return null;
  return (
    <div className="mt-3 border-t pt-3">
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
