import { cn } from "@/lib/utils";
import { CELL_SUB_CLASS } from "@/components/ui/data-grid/cell-text";
import {
  useFormState,
  useWatch,
  type Control,
  type UseFormReturn,
} from "react-hook-form";
import {
  InputSuffixAddon,
  InputSuffixField,
  InputSuffixPlain,
  InputSuffixQty,
} from "@/components/ui/input/input-suffix";
import { useQuantityFormatter } from "@/hooks/use-number-formatter";
import { useUnitDecimals } from "@/hooks/use-product-units";
import type { PoFormValues } from "../po-form-schema";
import { WatchedProductUnit } from "./unit-cell";
import { coerceNumberInput } from "@/lib/form-helpers";

function useOrderUnitDecimals(control: Control<PoFormValues>, index: number) {
  const productId =
    useWatch({ control, name: `items.${index}.product_id` }) ?? "";
  const unitId =
    useWatch({ control, name: `items.${index}.order_unit_id` }) ?? "";
  return useUnitDecimals(productId, unitId);
}

const ReceivedSubtext = function ReceivedSubtext({
  control,
  index,
}: {
  control: Control<PoFormValues>;
  index: number;
}) {
  "use no memo";
  const received =
    useWatch({ control, name: `items.${index}.received_qty` }) ?? 0;
  const unitName =
    useWatch({ control, name: `items.${index}.order_unit_name` }) ?? "";
  const formatQty = useQuantityFormatter(useOrderUnitDecimals(control, index));
  // โชว์ทุกแถวแม้ยังไม่รับ (0) — บรรทัดที่โผล่บ้างหายบ้างทำให้แยกไม่ออกว่าแถวที่
  // ไม่มีบรรทัดคือ "ยังไม่รับ" หรือ "ใบนี้ไม่มีข้อมูลรับของ"
  return (
    <p className={cn(CELL_SUB_CLASS, "text-right tabular-nums")}>
      {formatQty(Number(received))} {unitName}
    </p>
  );
};

/**
 * ของแถมที่รับแล้ว — บรรทัดรองของคอลัมน์ FOC / GRN คู่กับ `ReceivedSubtext`
 * ของคอลัมน์ Order / GRN · หน่วยตามหน่วยของแถม ไม่ใช่หน่วยสั่งซื้อ
 */
const FocReceivedSubtext = function FocReceivedSubtext({
  control,
  index,
  unitName,
  decimals,
}: {
  control: Control<PoFormValues>;
  index: number;
  unitName: string;
  decimals: number;
}) {
  "use no memo";
  const received =
    useWatch({ control, name: `items.${index}.foc_received_qty` }) ?? 0;
  const formatQty = useQuantityFormatter(decimals);
  // โชว์ทุกแถวแม้ยังไม่รับ (0) — เหตุผลเดียวกับ ReceivedSubtext
  return (
    <p className={cn(CELL_SUB_CLASS, "text-right tabular-nums")}>
      {formatQty(Number(received))} {unitName}
    </p>
  );
};

export const QtyUnitCell = function QtyUnitCell({
  control,
  form,
  index,
  disabled,
  readOnly = false,
  showReceived = true,
}: {
  control: Control<PoFormValues>;
  form: UseFormReturn<PoFormValues>;
  index: number;
  disabled: boolean;
  readOnly?: boolean;
  showReceived?: boolean;
}) {
  "use no memo";
  const qty = useWatch({ control, name: `items.${index}.order_qty` }) ?? 0;
  const { errors } = useFormState({
    control,
    name: `items.${index}.order_qty`,
  });
  const invalid = !!errors.items?.[index]?.order_qty;
  const decimals = useOrderUnitDecimals(control, index);
  const formatQty = useQuantityFormatter(decimals);
  const name = `items.${index}.order_qty` as const;

  if (disabled || readOnly) {
    const unitName = form.getValues(`items.${index}.order_unit_name`) ?? "";
    return (
      <div className="w-full">
        <InputSuffixPlain
          className="w-full"
          value={formatQty(Number(qty))}
          suffix={unitName}
          suffixClassName="text-right"
        />
        {showReceived && <ReceivedSubtext control={control} index={index} />}
      </div>
    );
  }

  return (
    <div className="w-full">
      <InputSuffixField className="w-full" error={invalid}>
        <InputSuffixQty
          decimals={decimals}
          placeholder="0"
          defaultValue={Number(qty)}
          {...form.register(name, { setValueAs: coerceNumberInput })}
          onChange={(e) => {
            const n = e.target.valueAsNumber;
            form.setValue(name, Number.isNaN(n) ? 0 : n, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }}
        />
        <InputSuffixAddon>
          <WatchedProductUnit
            control={control}
            form={form}
            index={index}
            disabled={disabled}
          />
        </InputSuffixAddon>
      </InputSuffixField>
      {showReceived && <ReceivedSubtext control={control} index={index} />}
    </div>
  );
};

export const OrderSummaryCell = function OrderSummaryCell({
  control,
  index,
}: {
  control: Control<PoFormValues>;
  index: number;
}) {
  "use no memo";
  const qty = useWatch({ control, name: `items.${index}.order_qty` }) ?? 0;
  const unitName =
    useWatch({ control, name: `items.${index}.order_unit_name` }) ?? "";
  const formatQty = useQuantityFormatter(useOrderUnitDecimals(control, index));
  return (
    <InputSuffixPlain
      className="block w-full text-right"
      value={formatQty(Number(qty))}
      suffix={unitName}
      suffixClassName="text-right"
    />
  );
};

export const FocQtyCell = function FocQtyCell({
  control,
  form,
  index,
  disabled,
  readOnly = false,
  showReceived = true,
}: {
  control: Control<PoFormValues>;
  form: UseFormReturn<PoFormValues>;
  index: number;
  disabled: boolean;
  readOnly?: boolean;
  showReceived?: boolean;
}) {
  "use no memo";
  const qty = useWatch({ control, name: `items.${index}.foc_qty` }) ?? 0;
  const productId =
    useWatch({ control, name: `items.${index}.product_id` }) ?? "";
  const focUnitId =
    useWatch({ control, name: `items.${index}.foc_unit_id` }) ?? "";
  const focUnitName =
    useWatch({ control, name: `items.${index}.foc_unit_name` }) ?? "";
  const orderUnitId =
    useWatch({ control, name: `items.${index}.order_unit_id` }) ?? "";
  const orderUnitName =
    useWatch({ control, name: `items.${index}.order_unit_name` }) ?? "";
  const unitName = focUnitName || orderUnitName;
  // ทศนิยมตามหน่วยที่ของแถมใช้จริง ไม่ใช่หน่วยสั่งซื้อ — คนละหน่วยคนละความละเอียด
  const decimals = useUnitDecimals(productId, focUnitId || orderUnitId);
  const formatQty = useQuantityFormatter(decimals);
  const name = `items.${index}.foc_qty` as const;

  const receivedSubtext = showReceived && (
    <FocReceivedSubtext
      control={control}
      index={index}
      unitName={unitName}
      decimals={decimals}
    />
  );

  if (disabled || readOnly) {
    return (
      <div className="w-full">
        <InputSuffixPlain
          className="block w-full text-right"
          value={formatQty(Number(qty))}
          suffix={unitName}
          suffixClassName="text-right"
        />
        {receivedSubtext}
      </div>
    );
  }

  return (
    <div className="w-full">
      <InputSuffixField className="w-full">
        <InputSuffixQty
          decimals={decimals}
          placeholder="0"
          defaultValue={Number(qty)}
          {...form.register(name, { setValueAs: coerceNumberInput })}
          onChange={(e) => {
            const n = e.target.valueAsNumber;
            const next = Number.isNaN(n) ? 0 : n;
            form.setValue(name, next, {
              shouldDirty: true,
              shouldValidate: true,
            });
            if (next > 0) {
              form.clearErrors([
                `items.${index}.order_qty`,
                `items.${index}.price`,
              ]);
            }
          }}
        />
        <InputSuffixAddon>
          <WatchedProductUnit
            control={control}
            form={form}
            index={index}
            disabled={disabled}
            unitField="foc"
          />
        </InputSuffixAddon>
      </InputSuffixField>
      {receivedSubtext}
    </div>
  );
};
