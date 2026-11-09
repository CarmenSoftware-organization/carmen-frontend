import { memo } from "react";
import { IncVatToggle, PriceWithIncVat } from "@/components/share/inc-vat";
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
  const isTaxIncluded =
    useWatch({ control: form.control, name: `items.${index}.is_tax_included` }) ??
    false;
  return (
    <PriceWithIncVat isTaxIncluded={isTaxIncluded}>
      {formatCurrency(price)}
    </PriceWithIncVat>
  );
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
    <div className="flex flex-col gap-1">
      <PriceInput form={form} index={index} />
      {/* Inc VAT — แก้ได้เท่ากับช่องราคา (ซ่อน/อ่านอย่างเดียว = ติ๊กไม่ได้) */}
      <Controller
        control={form.control}
        name={`items.${index}.is_tax_included`}
        render={({ field }) => (
          <IncVatToggle
            checked={field.value ?? false}
            onCheckedChange={field.onChange}
          />
        )}
      />
    </div>
  );
});

function PriceInput({
  form,
  index,
}: {
  readonly form: UseFormReturn<PoFormValues>;
  readonly index: number;
}) {
  "use no memo";
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
}
