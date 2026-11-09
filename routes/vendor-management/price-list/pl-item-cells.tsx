import {
  Controller,
  useFormState,
  useWatch,
  type FieldArrayWithId,
  type UseFormReturn,
} from "react-hook-form";
import { distinctLocalName } from "@/lib/distinct-local-name";
import { Crown } from "lucide-react";
import { useTranslations } from "use-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldInput, FieldPlainText } from "@/components/ui/field";
import { LookupProduct } from "@/components/lookup/lookup-product";
import { LookupProductUnit } from "@/components/lookup/lookup-product-unit";
import { LookupTaxProfile } from "@/components/lookup/lookup-tax-profile";
import { formatTaxRate, priceListTaxParts } from "@/lib/price-list-tax";
import type { EntityRef } from "@/types/entity-ref";
import type { PriceList } from "@/types/price-list";
import type { PriceListFormValues } from "./pl-form-schema";
import { NameWithSubtext } from "@/components/share/name-with-sub-text";

export type DetailField = FieldArrayWithId<
  PriceListFormValues,
  "pricelist_detail",
  "id"
>;
export type DetailRef = PriceList["pricelist_detail"][number];

interface CellProps {
  readonly form: UseFormReturn<PriceListFormValues>;
  readonly index: number;
  readonly isView: boolean;
  readonly isDisabled: boolean;
  readonly detailRef?: DetailRef;
}

/**
 * ป้ายของสินค้าที่บันทึกไว้ในแถว รูปเดียวกับ getLabel ของ LookupProduct
 * (`code — name`) — ใช้เฉพาะตอนค่าในช่องยังเป็นสินค้าเดิมของแถว ถ้าผู้ใช้เปลี่ยน
 * สินค้าแล้ว combobox จำตัวที่เลือกไว้เอง (pickedItem)
 */
function productLabel(
  value: string,
  product: EntityRef | null | undefined,
): string | undefined {
  if (!product?.name || product.id !== value) return undefined;
  return product.code ? `${product.code} — ${product.name}` : product.name;
}

function useRowErrors(form: UseFormReturn<PriceListFormValues>, index: number) {
  "use no memo";
  const { errors } = useFormState({
    control: form.control,
    name: `pricelist_detail.${index}`,
  });
  return errors.pricelist_detail?.[index];
}

export function ProductCell({
  form,
  index,
  isView,
  isDisabled,
  detailRef,
  confirmDuplicate,
}: CellProps & {
  readonly confirmDuplicate: (action: () => void, productName?: string) => void;
}) {
  "use no memo";
  const errors = useRowErrors(form, index);
  if (isView)
    return (
      <NameWithSubtext
        primary={detailRef?.product?.name ?? ""}
        secondary={distinctLocalName(
          detailRef?.product?.name,
          detailRef?.product?.local_name,
        )}
      />
    );
  return (
    <Controller
      control={form.control}
      name={`pricelist_detail.${index}.product_id`}
      render={({ field }) => (
        <LookupProduct
          value={field.value}
          onValueChange={(id, product) => {
            const rows = form.getValues("pricelist_detail");
            const isDup =
              !!id && rows.some((r, i) => i !== index && r.product_id === id);
            if (isDup)
              confirmDuplicate(
                () => field.onChange(id),
                product?.name ?? undefined,
              );
            else field.onChange(id);
          }}
          defaultLabel={productLabel(field.value, detailRef?.product)}
          disabled={isDisabled}
          className="h-8 w-full text-xs"
          error={errors?.product_id?.message}
        />
      )}
    />
  );
}

export function UnitCell({
  form,
  index,
  isView,
  isDisabled,
  detailRef,
}: CellProps) {
  "use no memo";
  const errors = useRowErrors(form, index);
  const productId =
    useWatch({
      control: form.control,
      name: `pricelist_detail.${index}.product_id`,
    }) ?? "";
  if (isView) return <FieldPlainText>{detailRef?.unit?.name}</FieldPlainText>;
  return (
    <Controller
      control={form.control}
      name={`pricelist_detail.${index}.unit_id`}
      render={({ field }) => (
        <LookupProductUnit
          productId={productId}
          value={field.value}
          onValueChange={field.onChange}
          defaultLabel={
            field.value && field.value === detailRef?.unit?.id
              ? (detailRef.unit.name ?? undefined)
              : undefined
          }
          disabled={isDisabled}
          className="w-full text-xs"
          error={errors?.unit_id?.message}
        />
      )}
    />
  );
}

export function MoqCell({
  form,
  index,
  isView,
  isDisabled,
  detailRef,
}: CellProps) {
  "use no memo";
  const errors = useRowErrors(form, index);
  if (isView)
    return (
      <span className="text-foreground text-xs font-semibold tabular-nums">
        {Number(detailRef?.moq_qty) || 0}+
      </span>
    );
  return (
    <FieldInput
      errorIconAlign="left"
      type="number"
      inputMode="decimal"
      min={0}
      disabled={isDisabled}
      placeholder="0"
      error={errors?.moq_qty?.message}
      className="border-border/60 h-8 w-full rounded-md text-right text-xs tabular-nums"
      {...form.register(`pricelist_detail.${index}.moq_qty`, {
        valueAsNumber: true,
      })}
    />
  );
}

export function LeadCell({
  form,
  index,
  isView,
  isDisabled,
  detailRef,
}: CellProps) {
  "use no memo";
  const errors = useRowErrors(form, index);
  if (isView)
    return (
      <span className="text-muted-foreground text-xs tabular-nums">
        {Number(detailRef?.lead_time_days) || 0}d
      </span>
    );
  return (
    <FieldInput
      errorIconAlign="left"
      type="number"
      inputMode="decimal"
      min={0}
      disabled={isDisabled}
      placeholder="0"
      error={errors?.lead_time_days?.message}
      className="border-border/60 h-8 w-full rounded-md text-right text-xs tabular-nums"
      {...form.register(`pricelist_detail.${index}.lead_time_days`, {
        valueAsNumber: true,
      })}
    />
  );
}

export function PriceCell({
  form,
  index,
  isView,
  isDisabled,
  detailRef,
}: CellProps) {
  "use no memo";
  const tc = useTranslations("common");
  const errors = useRowErrors(form, index);

  if (isView)
    return (
      <span className="text-foreground inline-flex items-center justify-end gap-1.5 text-xs font-semibold tabular-nums">
        {detailRef?.is_tax_included && (
          <span className="text-muted-foreground text-micro font-normal">
            {tc("incVat")}
          </span>
        )}
        {(Number(detailRef?.price) || 0).toFixed(2)}
      </span>
    );

  return (
    <FieldInput
      errorIconAlign="left"
      type="number"
      step="0.01"
      inputMode="decimal"
      min={0}
      disabled={isDisabled}
      placeholder="0.00"
      error={errors?.price?.message}
      className="border-border/60 h-8 w-full rounded-md text-right text-xs tabular-nums"
      {...form.register(`pricelist_detail.${index}.price`, {
        valueAsNumber: true,
      })}
    />
  );
}

/**
 * Inc VAT — คอลัมน์ของตัวเองข้าง Price (โหมดแก้ไขเท่านั้น โหมดดูใช้ grouped view)
 * เดิมซ้อน checkbox ไว้เหนือช่องราคาในเซลล์เดียว แถวสูงขึ้นและช่องราคาต่ำกว่าช่องอื่น
 */
export function IncVatCell({ form, index, isDisabled }: CellProps) {
  "use no memo";
  const tc = useTranslations("common");
  return (
    <div className="flex justify-center">
      <Controller
        control={form.control}
        name={`pricelist_detail.${index}.is_tax_included`}
        render={({ field }) => (
          <Checkbox
            checked={!!field.value}
            onCheckedChange={(v) => field.onChange(v === true)}
            disabled={isDisabled}
            aria-label={tc("incVat")}
            // พื้นทึบ — บนแถวสลับสี (striped) กรอบโปร่งจางจนดูเหมือนถูกปิดใช้
            className="bg-background"
          />
        )}
      />
    </div>
  );
}

function useRowPriceParts(
  form: UseFormReturn<PriceListFormValues>,
  index: number,
  isView: boolean,
  detailRef?: DetailRef,
) {
  const [priceWatch, rateWatch, profileWatch, incVatWatch] = useWatch({
    control: form.control,
    name: [
      `pricelist_detail.${index}.price`,
      `pricelist_detail.${index}.tax_rate`,
      `pricelist_detail.${index}.tax_profile_id`,
      `pricelist_detail.${index}.is_tax_included`,
    ],
  });
  // price = เลขที่กรอก (ก่อนภาษี หรือรวม VAT ถ้าติ๊ก Inc VAT) — สูตรเดียวกับ portal vendor ผ่าน priceListTaxParts
  const rate = isView ? detailRef?.tax_rate : rateWatch;
  const isTaxIncluded = isView ? !!detailRef?.is_tax_included : !!incVatWatch;
  return {
    ...priceListTaxParts(
      isView ? detailRef?.price : priceWatch,
      rate,
      isTaxIncluded,
    ),
    rate,
    // view ไม่มี tax_profile_id ใน detailRef — ถือว่ามีเสมอ (rate มาจาก profile)
    hasProfile: isView ? true : !!profileWatch,
  };
}

/** Tax rate — อ่านอย่างเดียว ตามมาจาก tax profile ที่เลือก */
export function TaxRateCell({ form, index, isView, detailRef }: CellProps) {
  "use no memo";
  const { rate, hasProfile } = useRowPriceParts(form, index, isView, detailRef);
  return (
    <span className="text-muted-foreground text-xs tabular-nums">
      {formatTaxRate(rate, hasProfile)}
    </span>
  );
}

export function TaxAmountCell({ form, index, isView, detailRef }: CellProps) {
  "use no memo";
  const { taxAmt, priceWithoutTax } = useRowPriceParts(
    form,
    index,
    isView,
    detailRef,
  );
  return (
    <span
      className="text-muted-foreground text-xs tabular-nums"
      title={priceWithoutTax.toFixed(2)}
    >
      {taxAmt.toFixed(2)}
    </span>
  );
}

export function TotalCell({ form, index, isView, detailRef }: CellProps) {
  "use no memo";
  const { total } = useRowPriceParts(form, index, isView, detailRef);
  return (
    <span className="text-foreground text-xs font-semibold tabular-nums">
      {total.toFixed(2)}
    </span>
  );
}

export function PreferredCell({
  form,
  index,
  isView,
  isDisabled,
  detailRef,
}: CellProps) {
  "use no memo";
  if (isView)
    return detailRef?.is_preferred ? (
      <Crown
        className="text-warning-ink mx-auto size-3.5"
        aria-label="preferred"
      />
    ) : (
      <span className="text-muted-foreground/50">—</span>
    );
  return (
    <div className="flex justify-center">
      <Controller
        control={form.control}
        name={`pricelist_detail.${index}.is_preferred`}
        render={({ field }) => (
          <Checkbox
            checked={!!field.value}
            onCheckedChange={(v) => field.onChange(v === true)}
            disabled={isDisabled}
            aria-label="preferred"
            className="bg-background"
          />
        )}
      />
    </div>
  );
}

export function TaxCell({
  form,
  index,
  isView,
  isDisabled,
  detailRef,
}: CellProps) {
  "use no memo";
  const errors = useRowErrors(form, index);
  if (isView)
    return <FieldPlainText>{detailRef?.tax_profile?.name}</FieldPlainText>;
  return (
    <Controller
      control={form.control}
      name={`pricelist_detail.${index}.tax_profile_id`}
      render={({ field }) => (
        <LookupTaxProfile
          value={field.value}
          onValueChange={(value, rate) => {
            field.onChange(value);
            form.setValue(`pricelist_detail.${index}.tax_rate`, rate);
          }}
          disabled={isDisabled}
          className="w-full text-xs"
          error={errors?.tax_profile_id?.message}
        />
      )}
    />
  );
}
