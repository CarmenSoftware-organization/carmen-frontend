import { useMemo } from "react";
import {
  useWatch,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import { useTranslations } from "use-intl";
import { LineDimensionStrip } from "@/components/dimension/line-dimension-strip";
import { Button } from "@/components/ui/button";
import { useGlDimensions } from "@/hooks/use-gl-dimensions";
import { visibleDimensionsForRules } from "@/lib/line-dimension-rules";
import { cn } from "@/lib/utils";
import type { DimensionRef } from "@/types/gl-dimension";
import { useDocumentLineDimensionsContext } from "@/hooks/use-document-line-dimensions";

const NO_DIMENSIONS: DimensionRef[] = [];

/**
 * แถวย่อยแถบชิป dimension ใต้บรรทัด PR / PO / GRN / SR / IA (แบบเดียวกับ JV)
 *
 * - ชิปที่โชว์ = dimension ที่กฎของบัญชีบรรทัดนี้ไม่ห้าม + ที่มีค่าบันทึกไว้แล้ว
 * - `no_account` / `skipped` ไม่มีแถบ ยกเว้นบรรทัดมีค่าบันทึกไว้แล้ว · `conflict` โชว์ข้อความ
 * - แก้ค่าแล้วตั้ง `dimensions_dirty` ให้ payload ส่ง dimensions ใน details.update
 *
 * @param form - ฟอร์มเอกสาร (field array ชื่อ `items`)
 * @param index - ลำดับบรรทัดใน `items`
 * @param className - ระยะห่าง/เส้นคั่นของแถว (ค่าเริ่มต้น `mt-2`)
 * @param disabled - ปิดชั่วคราวระหว่างบันทึก (ไม่ใช่โหมดดู — โหมดดูมาจากตัว hook)
 */
export function DocumentLineDimensionRow<T extends FieldValues>({
  form,
  index,
  disabled = false,
  className = "mt-2",
}: {
  readonly form: UseFormReturn<T>;
  readonly index: number;
  readonly disabled?: boolean;
  readonly className?: string;
}) {
  const t = useTranslations("lineDimension");
  const dims = useDocumentLineDimensionsContext();
  const dimensions = useGlDimensions(!!dims?.enabled);
  // ติดตามทั้ง id และ row_key — บรรทัดใหม่ได้ row_key หลัง mount
  const watchedIndex = Math.max(index, 0);
  const lineForm = form as unknown as UseFormReturn<{
    items: {
      id?: string;
      row_key?: string;
      dimensions?: DimensionRef[];
      dimensions_dirty?: boolean;
    }[];
  }>;
  const [id, rowKey] = useWatch({
    control: lineForm.control,
    name: [`items.${watchedIndex}.id`, `items.${watchedIndex}.row_key`],
  });
  const value =
    useWatch({
      control: lineForm.control,
      name: `items.${watchedIndex}.dimensions`,
    }) ?? NO_DIMENSIONS;

  const key = id || rowKey || null;
  const result = key ? dims?.resultFor(key) : undefined;
  const visible = useMemo(
    () => visibleDimensionsForRules(dimensions.data ?? [], result, value),
    [dimensions.data, result, value],
  );

  // index -1 = แถวหลุดจาก field array ชั่วคราวตอนลบ
  if (!dims?.enabled || index < 0 || !key) return null;

  const conflictMessage = dims.messageFor(key);
  const ruleError = dims.isRulesError && !result;
  if (visible.length === 0 && !conflictMessage && !ruleError) return null;

  const requiredIds = new Set(
    (result?.rules ?? [])
      .filter((rule) => rule.requirement === "mandatory")
      .map((rule) => rule.dimension_id),
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      <LineDimensionStrip
        dimensions={visible}
        value={value}
        readOnly={dims.readOnly}
        disabled={disabled && !dims.readOnly}
        requiredIds={requiredIds}
        invalidIds={dims.invalidFor(key)}
        accounts={result?.accounts}
        rowLabel={String(index + 1)}
        message={ruleError ? t("ruleLoadError") : conflictMessage}
        onChange={(next) => {
          lineForm.setValue(`items.${index}.dimensions`, next, {
            shouldDirty: true,
          });
          lineForm.setValue(`items.${index}.dimensions_dirty`, true);
          dims.clearInvalid(key);
        }}
      />
      {ruleError && (
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={dims.refetchRules}
        >
          {t("retry")}
        </Button>
      )}
    </div>
  );
}
