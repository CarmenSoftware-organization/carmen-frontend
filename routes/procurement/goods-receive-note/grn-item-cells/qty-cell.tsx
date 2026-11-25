import { cn } from "@/lib/utils";
import { CELL_SUB_CLASS } from "@/components/ui/data-grid/cell-text";
import { memo } from "react";
import {
  Controller,
  useFormState,
  useWatch,
  type Control,
  type UseFormReturn,
} from "react-hook-form";
import { useTranslations } from "use-intl";
import {
  InputSuffixAddon,
  InputSuffixField,
  InputSuffixPlain,
  InputSuffixQty,
} from "@/components/ui/input/input-suffix";
import { LookupProductUnit } from "@/components/lookup/lookup-product-unit";
import { useProductUnits, useUnitDecimals } from "@/hooks/use-product-units";
import type { GrnFormValues } from "../grn-form-schema";
import type { GrnQtyField, GrnUnitField } from "./types";

/** ช่องชื่อหน่วยคู่ของแต่ละช่อง id (แสดงอย่างเดียว ไม่อยู่ใน payload) */
const UNIT_NAME_FIELD = {
  foc_unit_id: "foc_unit_name",
  approved_unit_id: "approved_unit_name",
  received_unit_id: "received_unit_name",
} as const satisfies Record<GrnUnitField, string>;

const WatchedProductUnit = memo(function WatchedProductUnit({
  control,
  index,
  unitField,
}: {
  control: Control<GrnFormValues>;
  index: number;
  unitField: GrnUnitField;
}) {
  "use no memo";
  const productId =
    useWatch({ control, name: `items.${index}.product_id` }) ?? "";
  const savedUnitName = useWatch({
    control,
    name: `items.${index}.${UNIT_NAME_FIELD[unitField]}`,
  });
  return (
    <Controller
      control={control}
      name={`items.${index}.${unitField}`}
      render={({ field }) => (
        <LookupProductUnit
          productId={productId}
          value={field.value ?? ""}
          onValueChange={field.onChange}
          defaultLabel={savedUnitName || undefined}
          disabled={!productId}
          className="h-full w-19 shrink-0 rounded-none border-0 bg-transparent px-2 text-xs shadow-none hover:bg-transparent focus-visible:ring-0"
        />
      )}
    />
  );
});

const QtyUnitPlain = memo(function QtyUnitPlain({
  control,
  index,
  qtyField,
  unitField,
}: {
  control: Control<GrnFormValues>;
  index: number;
  qtyField: GrnQtyField;
  unitField: GrnUnitField;
}) {
  "use no memo";
  const productId =
    useWatch({ control, name: `items.${index}.product_id` }) ?? "";
  const qty = useWatch({ control, name: `items.${index}.${qtyField}` });
  const unitId =
    useWatch({ control, name: `items.${index}.${unitField}` }) ?? "";
  const savedUnitName = useWatch({
    control,
    name: `items.${index}.${UNIT_NAME_FIELD[unitField]}`,
  });
  const { data: units = [] } = useProductUnits(productId || undefined);
  const unitName =
    units.find((u) => u.id === unitId)?.name ?? savedUnitName ?? "";
  return (
    <InputSuffixPlain
      className="block w-full text-right"
      value={Number(qty) || 0}
      suffix={unitName}
      suffixClassName="text-right"
    />
  );
});

/**
 * เซลล์ qty + unit — input (ซ้าย) + unit lookup (ขวา) ในกล่องเดียว
 *
 * แก้ไม่ได้ = **ตัวหนังสือ ไม่ใช่ช่องกรอกสีเทา** (เกณฑ์เดียวกับทุกเซลล์ของ PO)
 * ช่องเทา ๆ ที่กดไม่ได้กินที่เท่าช่องจริงโดยไม่ให้อะไรกลับมา
 */
export function QtyUnitCell({
  form,
  index,
  qtyField,
  unitField,
  disabled,
  error,
  inputRef,
}: {
  form: UseFormReturn<GrnFormValues>;
  index: number;
  qtyField: GrnQtyField;
  unitField: GrnUnitField;
  disabled: boolean;
  error?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  "use no memo";
  const [productId, unitId] = useWatch({
    control: form.control,
    name: [`items.${index}.product_id`, `items.${index}.${unitField}`] as const,
  });
  const decimals = useUnitDecimals(productId ?? undefined, unitId ?? undefined);

  if (disabled) {
    return (
      <QtyUnitPlain
        control={form.control}
        index={index}
        qtyField={qtyField}
        unitField={unitField}
      />
    );
  }
  return (
    <InputSuffixField className="w-full" error={!!error}>
      <InputSuffixQty
        decimals={decimals}
        placeholder="0"
        {...(() => {
          const { ref, ...field } = form.register(
            `items.${index}.${qtyField}`,
            { valueAsNumber: true },
          );
          return {
            ...field,
            ref: (el: HTMLInputElement | null) => {
              ref(el);
              if (inputRef) inputRef.current = el;
            },
          };
        })()}
      />
      <InputSuffixAddon>
        <WatchedProductUnit
          control={form.control}
          index={index}
          unitField={unitField}
        />
      </InputSuffixAddon>
    </InputSuffixField>
  );
}

/**
 * เตือน (ไม่ block) เมื่อรับเกินจำนวนสั่งของ PO — เทียบได้เฉพาะตอนหน่วยรับ
 * ตรงกับหน่วยสั่ง (คนละหน่วยเทียบตรง ๆ ไม่ได้ ปล่อยให้ backend ตัดสินตอน commit)
 */
export const OverReceiptWarning = memo(function OverReceiptWarning({
  control,
  index,
}: {
  control: Control<GrnFormValues>;
  index: number;
}) {
  "use no memo";
  const t = useTranslations("procurement.goodsReceiveNote");
  const [poDetailId, approvedQty, approvedUnitId, receivedQty, receivedUnitId] =
    useWatch({
      control,
      name: [
        `items.${index}.purchase_order_detail_id`,
        `items.${index}.approved_qty`,
        `items.${index}.approved_unit_id`,
        `items.${index}.received_qty`,
        `items.${index}.received_unit_id`,
      ] as const,
    });

  const ordered = Number(approvedQty) || 0;
  const received = Number(receivedQty) || 0;
  const comparable =
    !!poDetailId && !!approvedUnitId && approvedUnitId === receivedUnitId;
  if (!comparable || ordered <= 0 || received <= ordered) return null;

  return (
    <p className={cn(CELL_SUB_CLASS, "text-warning-ink mt-0.5 text-right")}>
      {t("overReceiptWarning", { ordered })}
    </p>
  );
});

export function ReceivedQtyCell({
  form,
  index,
  disabled,
  inputRef,
}: {
  form: UseFormReturn<GrnFormValues>;
  index: number;
  disabled: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  "use no memo";
  // subscribe เฉพาะ error ของแถวนี้ — อ่าน form.formState.errors ตรง ๆ ไม่ทำให้
  // เซลล์ re-render เมื่อ validation เปลี่ยน (subscription เป็นของ useForm ข้างบน)
  const { errors } = useFormState({
    control: form.control,
    name: `items.${index}`,
  });
  const error = errors.items?.[index]?.received_qty?.message;
  return (
    <>
      <QtyUnitCell
        form={form}
        index={index}
        qtyField="received_qty"
        unitField="received_unit_id"
        disabled={disabled}
        error={error}
        inputRef={inputRef}
      />
      {!disabled && <OverReceiptWarning control={form.control} index={index} />}
    </>
  );
}
