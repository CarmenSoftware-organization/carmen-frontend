import { memo } from "react";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { InputAmount } from "@/components/ui/input/input-amount";
import { formatCurrency } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import type { PoFormValues } from "../po-form-schema";
import { HiddenValue } from "@/components/share/hidden-value";

interface CellProps {
  readonly form: UseFormReturn<PoFormValues>;
  readonly index: number;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  /** stage ซ่อน `price_per_unit` — badge แทนราคา และไม่เปิดช่องกรอก */
  readonly isHidden?: boolean;
}

const PricePlain = memo(function PricePlain({
  form,
  index,
}: {
  form: UseFormReturn<PoFormValues>;
  index: number;
}) {
  "use no memo";
  const price =
    useWatch({ control: form.control, name: `items.${index}.price` }) ?? 0;
  return <span className="tabular-nums">{formatCurrency(price)}</span>;
});

export const PriceCell = memo(function PriceCell({
  form,
  index,
  disabled,
  readOnly,
  isHidden = false,
}: CellProps) {
  "use no memo";
  if (isHidden) {
    return (
      <span className="flex justify-end">
        <HiddenValue />
      </span>
    );
  }
  if (disabled || readOnly) {
    return <PricePlain form={form} index={index} />;
  }
  return (
    <Controller
      control={form.control}
      name={`items.${index}.price`}
      render={({ field, fieldState }) => (
        <InputAmount
          // name ให้ `fieldFocusRef` หาช่องนี้เจอ — lookup สินค้าเด้งโฟกัสมาที่นี่
          // ต่อหลังเลือกสินค้าเสร็จ
          name={field.name}
          // ไอคอน error อยู่ซ้าย (ตัวเลขชิดขวา) — เว้นที่ให้ด้วย pl-7 ไม่งั้นทับเลข
          className={cn(
            "h-8 w-full text-right text-xs",
            fieldState.error && "pl-7",
          )}
          error={fieldState.error?.message}
          errorIconAlign="left"
          // preventDefault กัน Enter ในฟอร์มไปกด submit แทน (ทั้งใบยังกรอกไม่ครบ
          // ด้วยซ้ำ) · ของเดิม Enter พาไปเปิดตัวเลือกคลังต่อ — ตอนนี้คลังกรอกก่อน
          // สินค้าแล้ว การเด้งกลับไปหาคลังคือย้อนทาง
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
          }}
          value={Number(field.value ?? 0)}
          onValueChange={field.onChange}
        />
      )}
    />
  );
});
