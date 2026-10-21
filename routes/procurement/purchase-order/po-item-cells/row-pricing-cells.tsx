import { useTranslations } from "use-intl";
import { useWatch, type UseFormReturn } from "react-hook-form";
import {
  InputSuffixAddon,
  InputSuffixField,
  InputSuffixQty,
} from "@/components/ui/input/input-suffix";
import {
  DiscountOverrideInput,
  OverrideToggle,
  TaxOverrideInput,
} from "../../shared/discount-tax-override";
import { LookupTaxProfile } from "@/components/lookup/lookup-tax-profile";
import { NameWithSubtext } from "@/components/share/name-with-sub-text";
import { formatCurrency } from "@/lib/currency-utils";
import { computeLineAmounts } from "@/lib/line-pricing";
import type { PoFormValues } from "../po-form-schema";
import { coerceNumberInput } from "@/lib/form-helpers";
import { HiddenValue } from "@/components/share/hidden-value";

type ItemPricingField =
  | "sub_total_price"
  | "discount_amount"
  | "net_amount"
  | "tax_amount"
  | "total_price";

function useItemLine(form: UseFormReturn<PoFormValues>, itemIndex: number) {
  "use no memo";
  const control = form.control;
  const base = `items.${itemIndex}` as const;
  const price = Number(
    useWatch({ control, name: `items.${itemIndex}.price` }) ?? 0,
  );
  const [qty, discRate, discAmt, isDiscAdj, taxRate, taxAmt, isTaxAdj] =
    useWatch({
      control,
      name: [
        `${base}.order_qty`,
        `${base}.discount_rate`,
        `${base}.discount_amount`,
        `${base}.is_discount_adjustment`,
        `${base}.tax_rate`,
        `${base}.tax_amount`,
        `${base}.is_tax_adjustment`,
      ] as const,
    });
  return computeLineAmounts({
    price,
    qty: Number(qty) || 0,
    discRate: Number(discRate) || 0,
    isDiscAdj: !!isDiscAdj,
    discAmt: Number(discAmt) || 0,
    taxRate: Number(taxRate) || 0,
    isTaxAdj: !!isTaxAdj,
    taxAmt: Number(taxAmt) || 0,
  });
}

export function ItemAmountCell({
  form,
  itemIndex,
  field,
}: {
  readonly form: UseFormReturn<PoFormValues>;
  readonly itemIndex: number;
  readonly field: ItemPricingField;
}) {
  "use no memo";
  const line = useItemLine(form, itemIndex);
  const values = {
    sub_total_price: line.subtotal,
    discount_amount: line.discountAmount,
    net_amount: line.netAmount,
    tax_amount: line.taxAmount,
    total_price: line.totalPrice,
  };
  return (
    <span className="block text-right tabular-nums">
      {formatCurrency(values[field])}
    </span>
  );
}

export function ItemPriceText({
  form,
  itemIndex,
}: {
  readonly form: UseFormReturn<PoFormValues>;
  readonly itemIndex: number;
}) {
  "use no memo";
  const price =
    useWatch({ control: form.control, name: `items.${itemIndex}.price` }) ?? 0;
  return (
    <span className="block text-right tabular-nums">
      {formatCurrency(price)}
    </span>
  );
}

/**
 * ยอดเงินบรรทัดบน + เปอร์เซ็นต์เป็นบรรทัดรอง (โหมดอ่านของคอลัมน์ส่วนลด/ภาษี)
 *
 * ทรงเดียวกับรหัสคลังใต้ชื่อคลัง และชื่อท้องถิ่นใต้ชื่อสินค้า — ตัวเอกของคอลัมน์
 * เงินคือจำนวนเงิน ส่วนเปอร์เซ็นต์เป็นที่มาของมัน ของเดิมวางเรียงบรรทัดเดียว
 * (`7% · 35.00`) ซึ่งอ่านเหมือนสองค่าน้ำหนักเท่ากัน แล้วเลขเงินก็ไม่ตรงคอลัมน์
 * กับแถวอื่นเพราะความยาวเปอร์เซ็นต์ดันมันไปเรื่อย
 */
function RateSubtext({
  amount,
  rate,
  isHidden = false,
}: {
  readonly amount: number;
  readonly rate: number;
  /** ยอดเงินถูกซ่อน (`total_price`) — เปอร์เซ็นต์ยังเห็นได้ */
  readonly isHidden?: boolean;
}) {
  if (isHidden) {
    return (
      <div className="flex w-full flex-col items-end">
        <HiddenValue />
        {rate > 0 && (
          <p className="text-muted-foreground text-micro-legal py-0.5 tabular-nums">
            {rate}%
          </p>
        )}
      </div>
    );
  }
  return (
    <NameWithSubtext
      align="end"
      primary={formatCurrency(amount)}
      secondary={rate > 0 ? `${rate}%` : undefined}
    />
  );
}

export function ItemDiscountCell({
  form,
  itemIndex,
  editable,
  isHidden = false,
}: {
  readonly form: UseFormReturn<PoFormValues>;
  readonly itemIndex: number;
  readonly editable: boolean;
  /** stage ซ่อน `total_price` — ยอดเงินเป็น badge (ใช้ในโหมดอ่านเท่านั้น) */
  readonly isHidden?: boolean;
}) {
  "use no memo";
  const tfl = useTranslations("field");
  const base = `items.${itemIndex}` as const;
  const rate =
    useWatch({ control: form.control, name: `${base}.discount_rate` }) ?? 0;
  const isAdj =
    useWatch({
      control: form.control,
      name: `${base}.is_discount_adjustment`,
    }) ?? false;
  const line = useItemLine(form, itemIndex);
  const amount = line.discountAmount;

  if (!editable || isHidden) {
    return (
      <RateSubtext
        amount={amount}
        rate={Number(rate) || 0}
        isHidden={isHidden}
      />
    );
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
      {/* แถวล่าง: % ที่ใช้คิด คู่กับสวิตช์ override — ช่องกรอกได้ความกว้างเต็ม
          เซลล์ และตัวเลข % ไม่หายไปจากสายตาตอน override เปิด (ช่องกลายเป็นยอดเงิน) */}
      <div className="flex items-center justify-end gap-1.5">
        {Number(rate) > 0 && (
          <span className="text-muted-foreground text-micro-legal tabular-nums">
            {rate}%
          </span>
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

export function ItemTaxCell({
  form,
  itemIndex,
  editable,
  isHidden = false,
}: {
  readonly form: UseFormReturn<PoFormValues>;
  readonly itemIndex: number;
  readonly editable: boolean;
  /** stage ซ่อน `total_price` — ยอดเงินเป็น badge (ใช้ในโหมดอ่านเท่านั้น) */
  readonly isHidden?: boolean;
}) {
  "use no memo";
  const tfl = useTranslations("field");
  const base = `items.${itemIndex}` as const;
  const taxProfileId =
    useWatch({ control: form.control, name: `${base}.tax_profile_id` }) ?? null;
  const rate =
    useWatch({ control: form.control, name: `${base}.tax_rate` }) ?? 0;
  const isAdj =
    useWatch({ control: form.control, name: `${base}.is_tax_adjustment` }) ??
    false;
  const line = useItemLine(form, itemIndex);
  const amount = line.taxAmount;

  if (!editable || isHidden) {
    return (
      <RateSubtext
        amount={amount}
        rate={Number(rate) || 0}
        isHidden={isHidden}
      />
    );
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
      {/* แถวล่าง: โปรไฟล์ภาษีคู่กับสวิตช์ override — ตัวเลือกยาว ชื่อโปรไฟล์เลยได้
          ความกว้างเต็มเซลล์แทนที่จะโดนบีบอยู่ข้างช่องยอดเงิน */}
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <LookupTaxProfile
            value={taxProfileId ?? ""}
            onValueChange={(value, r, name) => {
              form.setValue(`${base}.tax_profile_id`, value || null, {
                shouldDirty: true,
                shouldValidate: true,
              });
              form.setValue(`${base}.tax_rate`, r);
              form.setValue(`${base}.tax_profile_name`, name);
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

export function ItemQtyInput({
  form,
  itemIndex,
  error,
  unitName,
  decimals,
}: {
  readonly form: UseFormReturn<PoFormValues>;
  readonly itemIndex: number;
  readonly error?: string;
  readonly unitName: string;
  readonly decimals: number;
}) {
  "use no memo";
  const name = `items.${itemIndex}.order_qty` as const;
  const value = useWatch({ control: form.control, name }) ?? 0;
  return (
    <InputSuffixField className="w-full" error={!!error}>
      <InputSuffixQty
        decimals={decimals}
        placeholder="0"
        defaultValue={value}
        {...form.register(name, { setValueAs: coerceNumberInput })}
        onChange={(e) => {
          const n = e.target.valueAsNumber;
          form.setValue(name, Number.isNaN(n) ? 0 : n, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }}
      />
      {unitName && (
        <InputSuffixAddon>
          <span className="text-muted-foreground px-2 text-xs">{unitName}</span>
        </InputSuffixAddon>
      )}
    </InputSuffixField>
  );
}
