import { cn } from "@/lib/utils";
import { CELL_SUB_CLASS } from "@/components/ui/data-grid/cell-text";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import {
  DiscountOverrideInput,
  OverrideToggle,
  TaxOverrideInput,
} from "../../shared/discount-tax-override";
import { LookupTaxProfile } from "@/components/lookup/lookup-tax-profile";
import { NameWithSubtext } from "@/components/share/name-with-sub-text";
import { formatCurrency } from "@/lib/currency-utils";
import type { GrnFormValues } from "../grn-form-schema";
import { useGrnItemLine } from "./use-grn-item-line";

function RateSubtext({
  amount,
  rate,
}: {
  readonly amount: number;
  readonly rate: number;
}) {
  return (
    <NameWithSubtext
      align="end"
      primary={formatCurrency(amount)}
      secondary={rate > 0 ? `${rate}%` : undefined}
    />
  );
}

export function GrnItemDiscountCell({
  form,
  index,
  editable,
}: {
  form: UseFormReturn<GrnFormValues>;
  index: number;
  editable: boolean;
}) {
  "use no memo";
  const tfl = useTranslations("field");
  const base = `items.${index}` as const;
  const rate =
    useWatch({ control: form.control, name: `${base}.discount_rate` }) ?? 0;
  const isAdj =
    useWatch({
      control: form.control,
      name: `${base}.is_discount_adjustment`,
    }) ?? false;
  const amount = useGrnItemLine(form, index).discountAmount;

  if (!editable) {
    return <RateSubtext amount={amount} rate={Number(rate) || 0} />;
  }
  return (
    <div className="flex flex-col gap-0.5">
      <DiscountOverrideInput
        rate={rate}
        amount={amount}
        isAdjustment={isAdj}
        onRateChange={(r) =>
          form.setValue(`${base}.discount_rate`, r, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
        onAmountChange={(a) =>
          form.setValue(`${base}.discount_amount`, a, { shouldDirty: true })
        }
      />
      {/* แถวล่าง: % ที่ใช้คิด คู่กับสวิตช์ override — ท่าเดียวกับคอลัมน์ส่วนลดของ PO
          ช่องกรอกได้ความกว้างเต็มเซลล์ และ % ไม่หายไปตอน override เปิด */}
      <div className="flex items-center justify-end gap-1.5">
        {Number(rate) > 0 && (
          <span className={cn(CELL_SUB_CLASS, "tabular-nums")}>{rate}%</span>
        )}
        <OverrideToggle
          checked={isAdj}
          hint={tfl("overrideHintDiscount")}
          onCheckedChange={(on) => {
            // เปิด override: seed amount = ค่าที่คำนวณล่าสุด (ต่อเนื่อง)
            if (on) {
              form.setValue(`${base}.discount_amount`, amount, {
                shouldDirty: true,
              });
            }
            form.setValue(`${base}.is_discount_adjustment`, on, {
              shouldDirty: true,
            });
          }}
        />
      </div>
    </div>
  );
}

export function GrnItemTaxCell({
  form,
  index,
  editable,
}: {
  form: UseFormReturn<GrnFormValues>;
  index: number;
  editable: boolean;
}) {
  "use no memo";
  const tfl = useTranslations("field");
  const base = `items.${index}` as const;
  const taxProfileId =
    useWatch({ control: form.control, name: `${base}.tax_profile_id` }) ?? null;
  const rate =
    useWatch({ control: form.control, name: `${base}.tax_rate` }) ?? 0;
  const isAdj =
    useWatch({ control: form.control, name: `${base}.is_tax_adjustment` }) ??
    false;
  const amount = useGrnItemLine(form, index).taxAmount;

  if (!editable) {
    return <RateSubtext amount={amount} rate={Number(rate) || 0} />;
  }
  return (
    <div className="flex flex-col gap-0.5">
      <TaxOverrideInput
        rate={Number(rate) || 0}
        amount={amount}
        isAdjustment={isAdj}
        onAmountChange={(a) =>
          form.setValue(`${base}.tax_amount`, a, { shouldDirty: true })
        }
      />
      {/* แถวล่าง: โปรไฟล์ภาษีคู่กับสวิตช์ override — ท่าเดียวกับคอลัมน์ภาษีของ PO */}
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <LookupTaxProfile
            value={taxProfileId ?? ""}
            onValueChange={(value, r) => {
              form.setValue(`${base}.tax_profile_id`, value || null, {
                shouldDirty: true,
                shouldValidate: true,
              });
              form.setValue(`${base}.tax_rate`, r);
            }}
            className="h-8 w-full text-xs"
          />
        </div>
        <OverrideToggle
          checked={isAdj}
          hint={tfl("overrideHintTax")}
          onCheckedChange={(on) => {
            if (on) {
              form.setValue(`${base}.tax_amount`, amount, {
                shouldDirty: true,
              });
            }
            form.setValue(`${base}.is_tax_adjustment`, on, {
              shouldDirty: true,
            });
          }}
        />
      </div>
    </div>
  );
}
