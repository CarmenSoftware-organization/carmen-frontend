import { Controller, useWatch, type Control } from "react-hook-form";
import { LookupUnit } from "@/components/lookup/lookup-unit";
import type { ProductFormValues } from "@/types/product";

type UnitArrayName = "order_units" | "ingredient_units";

interface UnitCellProps {
  readonly control: Control<ProductFormValues>;
  readonly name: UnitArrayName;
  readonly index: number;
  readonly isOrder: boolean;
  readonly inventoryUnitName: string;
  readonly disabled: boolean;
  readonly onUnitChange: (index: number, unitId: string) => void;
  readonly usedIds: string[];
  readonly unitMap: Map<string, string>;
  readonly error?: string;
}

export function FromUnitCell({
  control,
  name,
  index,
  isOrder,
  inventoryUnitName,
  disabled,
  onUnitChange,
  usedIds,
  unitMap,
  error,
}: UnitCellProps) {
  if (!isOrder) {
    return (
      <div className="text-muted-foreground flex items-center text-xs">
        {inventoryUnitName}
      </div>
    );
  }
  return (
    <div className="flex items-center">
      <Controller
        control={control}
        name={`${name}.${index}.from_unit_id`}
        render={({ field }) =>
          disabled ? (
            <span className="text-xs">{unitMap.get(field.value) ?? ""}</span>
          ) : (
            <LookupUnit
              value={field.value}
              onValueChange={(v) => onUnitChange(index, v)}
              defaultLabel={unitMap.get(field.value)}
              disabled={disabled}
              excludeIds={usedIds.filter((id) => id !== field.value)}
              error={error}
            />
          )
        }
      />
    </div>
  );
}

/**
 * Cell แสดง/แก้ไขหน่วยปลายทาง (to_unit) สำหรับ ingredient_units
 * โหมด order_units จะแสดงชื่อ inventory unit อ่านอย่างเดียว
 * โหมด view (disabled) จะแสดงเป็น plain text ของชื่อ unit แทน Lookup ที่ถูก disable
 */
export function ToUnitCell({
  control,
  name,
  index,
  isOrder,
  inventoryUnitName,
  disabled,
  onUnitChange,
  usedIds,
  unitMap,
  error,
}: UnitCellProps) {
  if (isOrder) {
    return (
      <div className="text-muted-foreground flex items-center text-xs">
        {inventoryUnitName}
      </div>
    );
  }
  return (
    <div className="flex items-center">
      <Controller
        control={control}
        name={`${name}.${index}.to_unit_id`}
        render={({ field }) =>
          disabled ? (
            <span className="text-xs">{unitMap.get(field.value) ?? ""}</span>
          ) : (
            <LookupUnit
              value={field.value}
              onValueChange={(v) => onUnitChange(index, v)}
              defaultLabel={unitMap.get(field.value)}
              disabled={disabled}
              excludeIds={usedIds.filter((id) => id !== field.value)}
              error={error}
            />
          )
        }
      />
    </div>
  );
}

interface ConversionPreviewProps {
  readonly control: Control<ProductFormValues>;
  readonly name: UnitArrayName;
  readonly index: number;
  readonly unitMap: Map<string, string>;
}

export function ConversionPreview({
  control,
  name,
  index,
  unitMap,
}: ConversionPreviewProps) {
  const fromId = useWatch({ control, name: `${name}.${index}.from_unit_id` });
  const toId = useWatch({ control, name: `${name}.${index}.to_unit_id` });
  const fromQty = useWatch({ control, name: `${name}.${index}.from_unit_qty` });
  const toQty = useWatch({ control, name: `${name}.${index}.to_unit_qty` });

  if (!fromId || !toId) {
    return <div className="text-muted-foreground flex items-center"></div>;
  }

  const fromName = unitMap.get(fromId) ?? "?";
  const toName = unitMap.get(toId) ?? "?";
  return (
    <div className="text-muted-foreground flex items-center whitespace-nowrap">
      {fromQty} {fromName} = {toQty} {toName}
    </div>
  );
}
