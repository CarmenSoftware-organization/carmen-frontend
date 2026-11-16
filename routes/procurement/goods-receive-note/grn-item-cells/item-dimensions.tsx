import { useWatch, type UseFormReturn } from "react-hook-form";
import { LineDimensionFields } from "@/components/dimension/line-dimension-fields";
import type { GrnFormValues } from "../grn-form-schema";

/**
 * ช่อง dimension ของบรรทัด GRN (แถวใต้บรรทัดสินค้า) — ค่าเริ่มต้นมาจากบรรทัด PO
 * หรือจาก response แก้แล้วตั้ง `dimensions_dirty` เพื่อให้ payload ส่ง dimensions
 * ใน good_received_note_detail.update
 *
 * ผู้เรียกต้องเช็ค `useLineDimensionsEnabled()` เอง และไม่ใส่ footerContent เมื่อปิด
 * (แถว footer ของ DataGrid จะว่างเปล่าแต่ยังกินที่)
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
    <div className="pb-2.5">
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
