import { useEffect } from "react";
import {
  Controller,
  useWatch,
  type UseFormReturn,
  type FieldArrayWithId,
} from "react-hook-form";
import { useTranslations } from "use-intl";
import { PR_ITEM_PRICELIST_COMPARE_TYPE } from "@/types/purchase-request";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputAmount } from "@/components/ui/input/input-amount";
import { formatCurrency, EXCHANGE_RATE_DECIMALS } from "@/lib/currency-utils";
import { Checkbox } from "@/components/ui/checkbox";
import { LookupVendor } from "@/components/lookup/lookup-vendor";
import { HiddenValue } from "@/components/share/hidden-value";
import {
  computePrItemAmounts,
  resolveApprovedQty,
  type PrFormValues,
} from "./pr-form-schema";
import PrInventoryRow from "./pr-inventory-row";
import { PrItemSummary } from "./pr-item-summary";
import { PrLastReceivingInfo } from "./pr-last-receiving-info";
import { PrDiscountInput, PrTaxInput } from "./pr-money-fields";

type ItemField = FieldArrayWithId<PrFormValues, "items", "id">;

interface PrItemExpandProps {
  readonly item: ItemField;
  readonly form: UseFormReturn<PrFormValues>;
  readonly isDisabled: boolean;
  readonly itemFields: ItemField[];
  readonly buCode?: string;
  readonly baseCurrencyCode?: string;
  /** stage ซ่อน `price_per_unit` — ราคาต่อหน่วย / pricelist / ราคารับล่าสุด */
  readonly hidePrice?: boolean;
  /** stage ซ่อน `total_price` — subtotal / ส่วนลด / net / ภาษี / total / ยอดสกุลฐาน */
  readonly hideTotal?: boolean;
}

export function PrItemExpand({
  item,
  form,
  isDisabled,
  itemFields,
  buCode,
  baseCurrencyCode,
  hidePrice = false,
  hideTotal = false,
}: PrItemExpandProps) {
  const tfl = useTranslations("field");
  const index = itemFields.findIndex((f) => f.id === item.id);

  const i = Math.max(index, 0);
  const anyHidden = hidePrice || hideTotal;
  // ซ่อนอย่างใดอย่างหนึ่ง = ผู้ขาย/pricelist/ภาษี/ส่วนลดเป็นข้อความล้วน — backend ทิ้ง
  // key ราคาและแหล่งราคาของผู้ใช้กลุ่มนี้อยู่แล้ว ปล่อยเป็นช่องกรอกจะหลอกว่าแก้ได้
  const isFieldDisabled = isDisabled || anyHidden;

  const [
    watchPrice,
    watchQty,
    watchTaxRate,
    watchIsTaxAdj,
    watchTaxAmt,
    watchDiscRate,
    watchIsDiscAdj,
    watchDiscAmt,
    watchPricelistNo,
    watchApprovedQty,
    watchCurrencyCode,
    watchCurrencyDecimals,
    watchExchangeRate,
    watchVendorName,
    watchTaxProfileName,
  ] = useWatch({
    control: form.control,
    name: [
      `items.${i}.pricelist_price`,
      `items.${i}.requested_qty`,
      `items.${i}.tax_rate`,
      `items.${i}.is_tax_adjustment`,
      `items.${i}.tax_amount`,
      `items.${i}.discount_rate`,
      `items.${i}.is_discount_adjustment`,
      `items.${i}.discount_amount`,
      `items.${i}.pricelist_no`,
      `items.${i}.approved_qty`,
      `items.${i}.currency_code`,
      `items.${i}.currency_decimal_places`,
      `items.${i}.exchange_rate`,
      `items.${i}.vendor_name`,
      `items.${i}.tax_profile_name`,
    ] as const,
  });

  const price = watchPrice ?? 0;
  const qty = watchQty ?? 0;
  const taxRate = watchTaxRate ?? 0;
  const isTaxAdj = watchIsTaxAdj ?? false;
  const taxAmt = watchTaxAmt ?? 0;
  const discRate = watchDiscRate ?? 0;
  const isDiscAdj = watchIsDiscAdj ?? false;
  const discAmt = watchDiscAmt ?? 0;
  const calcQty = resolveApprovedQty({
    approved_qty: watchApprovedQty ?? 0,
    requested_qty: qty,
  });
  const currencyCode = watchCurrencyCode ?? null;
  const exchangeRate = watchExchangeRate ?? 1;
  const isForeignCurrency =
    !!baseCurrencyCode && !!currencyCode && currencyCode !== baseCurrencyCode;

  const { subtotal, discountAmount, netAmount, taxAmount, totalPrice } =
    computePrItemAmounts({
      price,
      qty: calcQty,
      discRate,
      isDiscAdj,
      discAmt,
      taxRate,
      isTaxAdj,
      taxAmt,
    });

  // Sync computed values back to form
  // stage ซ่อนราคา: ราคาในฟอร์มเป็น null→0 ปลอม คำนวณแล้วเขียนกลับจะได้ยอด 0
  // ทับของจริง — ข้ามทั้งก้อน (backend คำนวณยอดเองจากราคาที่เก็บไว้ × approved_qty)
  useEffect(() => {
    if (index === -1 || anyHidden) return;
    // override ปิด: amount auto จาก rate · override เปิด: amount กรอกเอง,
    // rate ค้างค่าเดิม (disabled, ไม่ back-compute) — ทั้ง discount และ tax
    if (!isDiscAdj) {
      form.setValue(`items.${index}.discount_amount`, discountAmount);
    }
    if (!isTaxAdj) {
      form.setValue(`items.${index}.tax_amount`, taxAmount);
    }
    form.setValue(`items.${index}.net_amount`, netAmount);
    form.setValue(`items.${index}.total_price`, totalPrice);
  }, [
    index,
    discountAmount,
    taxAmount,
    netAmount,
    totalPrice,
    isDiscAdj,
    isTaxAdj,
    form,
    anyHidden,
  ]);

  if (index === -1) return null;

  const pricelistNo = watchPricelistNo ?? null;
  const vendorName = watchVendorName ?? "";
  const taxProfileName = watchTaxProfileName ?? "";

  const itemErrors = form.formState.errors.items?.[index];
  const vendorError = itemErrors?.vendor_id?.message;
  const priceError = itemErrors?.pricelist_price?.message;

  const overrideToggle = (
    name:
      | `items.${number}.is_tax_adjustment`
      | `items.${number}.is_discount_adjustment`,
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <label className="flex cursor-pointer items-center gap-1.5">
          <Checkbox
            checked={field.value ?? false}
            onCheckedChange={field.onChange}
            className="size-3.5"
          />
          <span className="text-muted-foreground text-xs select-none">
            {tfl("override")}
          </span>
        </label>
      )}
    />
  );

  return (
    <div className="w-full p-3">
      {/* Vendor · Unit Price · Pricelist · Discount · Tax — แถวเดียว
          Inventory · Summary อยู่แถบล่าง */}
      {/* คอลัมน์ 1 (Pricelist) = 9.375rem (150px) เท่าคอลัมน์ Delivery Date ของ
          ตารางข้างบน — เลขที่ price list ยาวกว่า 5rem เดิมจนโดนตัด
          คอลัมน์ 2 (Vendor) 19.5rem เดิมกว้างเกินความจำเป็น หดเหลือ 12rem
          (ชื่อผู้ขายที่ยาวกว่านั้น lookup ตัดให้เอง) · ผลคือคอลัมน์ 3
          (Currency) ไม่ตรงกับคอลัมน์ Requested ของตารางข้างบนแล้ว แลกกับ
          การไม่ปล่อยให้ Vendor กินที่ฟรีทั้งแถว */}
      {/* ระยะ label→value = gap-0.5 เท่ากับชื่อ→ชื่อรองของเซลล์ Location/Product
          ในตารางข้างบน (ค่า default ของ Field คือ 6px ซึ่งห่างกว่า) เขียนที่กริด
          ที่เดียวไม่ไล่ใส่ราย Field — Field ที่เพิ่มทีหลังจะได้ระยะเดียวกันเอง */}
      {/* ไม่มี breakpoint: จอแคบให้เลื่อนไปกับตารางข้างบน ไม่ใช่ยุบเป็นคอลัมน์เดียว
          แล้วยืดลงล่างจนอ่านคู่กับแถวแม่ไม่ได้ · ห้ามใส่ min-w-max: `<td>` ถ่าง
          ตารางไม่ได้ (ความกว้างคอลัมน์ล็อกจากหัวตาราง) แถวกางจะล้นออกไปพ้นขอบ
          ตารางแทน — กว้างเท่า `<td>` พอ ผลรวมความกว้างขั้นต่ำ ~71rem ยังน้อยกว่า
          ตารางหลักอยู่แล้ว */}
      <div className="grid grid-cols-[9.375rem_12rem_5rem_minmax(4.5rem,1fr)_minmax(7rem,1fr)_minmax(4rem,0.7fr)_minmax(9rem,1.4fr)_minmax(4rem,0.7fr)_minmax(11rem,2fr)_minmax(5rem,1fr)] gap-x-2 gap-y-3 [&>[data-slot=field]]:gap-0.5">
        {/* Pricelist */}
        <Field>
          <FieldLabel className="text-muted-foreground flex min-h-6 items-center text-xs tracking-wide">
            {tfl("pricelist")}
          </FieldLabel>
          <p
            className={`flex items-center truncate text-xs font-medium ${isFieldDisabled ? "min-h-6" : "min-h-8"}`}
          >
            {hidePrice ? <HiddenValue /> : pricelistNo || "—"}
          </p>
        </Field>

        {/* Vendor */}
        <Field>
          <FieldLabel
            htmlFor={`items-${index}-vendor`}
            className="text-muted-foreground flex min-h-6 items-center text-xs tracking-wide"
          >
            {tfl("vendor")}
          </FieldLabel>
          {isFieldDisabled ? (
            <p className="flex min-h-6 items-center truncate text-xs font-medium">
              {vendorName || "—"}
            </p>
          ) : (
            <Controller
              control={form.control}
              name={`items.${index}.vendor_id`}
              render={({ field }) => (
                <LookupVendor
                  value={field.value ?? ""}
                  onValueChange={(value) => {
                    // shouldValidate: ล้างกรอบแดง vendor ทันทีที่เลือก
                    // (mode=onSubmit จึงต้อง validate เองไม่งั้น error ค้าง)
                    form.setValue(`items.${index}.vendor_id`, value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    // เซ็ตแค่ `stage_status` (= สิ่งที่ผู้ใช้ตัดสินใจใน session นี้)
                    // **ห้ามแตะ `current_stage_status`** ซึ่งเป็นสถานะจริงใน DB —
                    // ปุ่ม Save ของ stage purchase ส่ง detail เต็มผ่าน
                    // `preparePurchaseDetails` แล้วหลังบ้าน (purchase-request.service
                    // `update()`) destructure ทิ้งแค่ stage_status/stage_message
                    // ส่วน current_stage_status ลอดเข้า pickDetailColumns ไปเขียน DB
                    // → แค่เลือกผู้ขายแล้วกด Save แถวนั้นกลายเป็น approve ทั้งที่
                    // ยังไม่มีใครกดอนุมัติ · ตอนกด Purchase Approve ยังได้ approve
                    // เหมือนเดิมเพราะ `resolveApproveStageStatus` อ่าน stage_status ก่อน
                    if (value) {
                      form.setValue(`items.${index}.stage_status`, "approve");
                    }
                  }}
                  // ชื่อผู้ขายเป็นคนละช่องกับ id และโหมดอ่านวาดจากชื่อ — ไม่เซ็ต
                  // คู่กันตรงนี้ พอ save เสร็จแล้วกลับไปโหมดอ่านจะได้ "—" จนกว่า
                  // จะ refresh (ทางอื่นที่ตั้งผู้ขายเซ็ตสองช่องคู่กันหมดอยู่แล้ว
                  // ดู pr-auto-allocate)
                  onItemChange={(vendor) =>
                    form.setValue(
                      `items.${index}.vendor_name`,
                      vendor.name ?? "",
                    )
                  }
                  // list โหลดทีละ 30 — ผู้ขายที่อยู่หลังหน้าแรกหาชื่อไม่เจอ
                  defaultLabel={watchVendorName || undefined}
                  className="w-full text-xs"
                  error={vendorError}
                />
              )}
            />
          )}
        </Field>

        {/* Currency — สกุลเงินของรายการ (เริ่ม col 3 คือหลัง Pricelist·Vendor)
            คอลัมน์นี้ 5rem ไม่ใช่ 3rem: ป้ายเต็ม "Currency"/"สกุลเงิน" ไม่พอใน 3rem
            แล้วหักบรรทัด ทำให้แถวสูงไม่เท่ากันแล้วแต่ใบ */}
        <Field className="col-start-3">
          <FieldLabel className="text-muted-foreground flex min-h-6 items-center justify-end text-xs tracking-wide">
            {tfl("currency")}
          </FieldLabel>
          <p
            className={`flex items-center justify-end text-xs font-medium ${isFieldDisabled ? "min-h-6" : "min-h-8"}`}
          >
            {currencyCode || "—"}
          </p>
        </Field>

        {/* Unit price */}
        <Field>
          <FieldLabel
            htmlFor={`items-${index}-pricelist-price`}
            className="text-muted-foreground flex min-h-6 items-center justify-end gap-1 text-xs tracking-wide"
          >
            {tfl("unitPrice")}
            {!hidePrice && (
              <PrLastReceivingInfo
                control={form.control}
                index={index}
                buCode={buCode}
              />
            )}
          </FieldLabel>
          {isFieldDisabled ? (
            <p className="flex min-h-6 items-center justify-end text-xs font-semibold tabular-nums">
              {hidePrice ? <HiddenValue /> : formatCurrency(price)}
            </p>
          ) : (
            <InputAmount
              id={`items-${index}-pricelist-price`}
              decimals={watchCurrencyDecimals}
              className={`h-8 text-right text-xs ${priceError ? "pl-7" : ""}`}
              error={priceError}
              errorIconAlign="left"
              value={price}
              onValueChange={(n) => {
                form.setValue(`items.${index}.pricelist_price`, n, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                form.setValue(
                  `items.${index}.pricelist_type`,
                  PR_ITEM_PRICELIST_COMPARE_TYPE.MANUAL_INPUT,
                );
              }}
            />
          )}
        </Field>

        {/* Exchange rate — แก้ไขได้ (มีผลจริงเมื่อเป็นสกุลต่างประเทศ) */}
        <Field>
          <FieldLabel
            htmlFor={`items-${index}-exchange-rate`}
            className="text-muted-foreground flex min-h-6 items-center justify-end text-xs tracking-wide"
          >
            {tfl("exchangeRate")}
          </FieldLabel>
          {isFieldDisabled ? (
            <p className="flex min-h-6 items-center justify-end text-xs font-medium tabular-nums">
              {exchangeRate.toFixed(EXCHANGE_RATE_DECIMALS)}
            </p>
          ) : (
            // exchange rate: fix 5 ทศนิยมตายตัว (เช่น 32.09500) ต่างจาก amount ที่
            // อิงทศนิยมของสกุลเงิน — base/default currency → disabled (rate = 1)
            <InputAmount
              id={`items-${index}-exchange-rate`}
              decimals={EXCHANGE_RATE_DECIMALS}
              disabled={!isForeignCurrency}
              className="disabled:bg-muted disabled:text-muted-foreground h-8 text-right text-xs disabled:cursor-default disabled:opacity-100"
              value={exchangeRate}
              onValueChange={(n) =>
                form.setValue(`items.${index}.exchange_rate`, n || 1, {
                  shouldDirty: true,
                })
              }
            />
          )}
        </Field>

        {/* Subtotal — plaintext (คำนวณ ไม่แก้ไข) */}
        <Field>
          <FieldLabel className="text-muted-foreground flex min-h-6 items-center justify-end text-xs tracking-wide">
            {tfl("subtotal")}
          </FieldLabel>
          <p
            className={`flex items-center justify-end text-xs font-medium tabular-nums ${isFieldDisabled ? "min-h-6" : "min-h-8"}`}
          >
            {hideTotal ? <HiddenValue /> : formatCurrency(subtotal)}
          </p>
        </Field>

        {/* Discount */}
        <Field>
          <div
            className={`flex min-h-6 items-center gap-2 ${isFieldDisabled ? "justify-end" : "justify-between"}`}
          >
            <FieldLabel className="text-muted-foreground text-xs tracking-wide">
              {tfl("discount")}
            </FieldLabel>
            {!isFieldDisabled &&
              overrideToggle(`items.${index}.is_discount_adjustment`)}
          </div>
          {isFieldDisabled ? (
            <p className="flex min-h-6 items-center justify-end gap-1.5 truncate text-xs font-medium">
              <span className="text-muted-foreground tabular-nums">
                {discRate}%
              </span>
              <span className="text-muted-foreground">·</span>
              {hideTotal ? (
                <HiddenValue />
              ) : (
                <span className="tabular-nums">
                  {formatCurrency(discountAmount)}
                </span>
              )}
            </p>
          ) : (
            <PrDiscountInput
              form={form}
              index={index}
              decimals={watchCurrencyDecimals}
            />
          )}
        </Field>

        {/* Net — plaintext */}
        <Field>
          <FieldLabel className="text-muted-foreground flex min-h-6 items-center justify-end text-xs tracking-wide">
            {tfl("net")}
          </FieldLabel>
          <p
            className={`flex items-center justify-end text-xs font-medium tabular-nums ${isFieldDisabled ? "min-h-6" : "min-h-8"}`}
          >
            {hideTotal ? <HiddenValue /> : formatCurrency(netAmount)}
          </p>
        </Field>

        {/* Tax */}
        <Field>
          <div
            className={`flex min-h-6 items-center gap-2 ${isFieldDisabled ? "justify-end" : "justify-between"}`}
          >
            <div className="flex items-center gap-1.5">
              <FieldLabel className="text-muted-foreground text-xs tracking-wide">
                {tfl("tax")}
              </FieldLabel>
              {/* tax rate เป็น plain text (มาจาก profile — override ไม่ได้) */}
              {taxRate > 0 && (
                <span className="text-muted-foreground text-micro-legal font-semibold tabular-nums">
                  {taxRate}%
                </span>
              )}
            </div>
            {!isFieldDisabled &&
              overrideToggle(`items.${index}.is_tax_adjustment`)}
          </div>
          {isFieldDisabled ? (
            <p className="flex min-h-6 items-center justify-end gap-1.5 truncate text-xs font-medium">
              {taxProfileName ? (
                <>
                  <span className="truncate">{taxProfileName}</span>
                  <span className="text-muted-foreground">·</span>
                  {hideTotal ? (
                    <HiddenValue />
                  ) : (
                    <span className="tabular-nums">
                      {formatCurrency(taxAmount)}
                    </span>
                  )}
                </>
              ) : (
                "—"
              )}
            </p>
          ) : (
            <PrTaxInput
              form={form}
              index={index}
              decimals={watchCurrencyDecimals}
            />
          )}
        </Field>

        {/* Total — plaintext (สกุลที่เลือก) */}
        <Field>
          <FieldLabel className="text-muted-foreground flex min-h-6 items-center justify-end text-xs tracking-wide">
            {tfl("total")}
          </FieldLabel>
          <p
            className={`flex items-center justify-end text-xs font-semibold tabular-nums ${isFieldDisabled ? "min-h-6" : "min-h-8"}`}
          >
            {hideTotal ? <HiddenValue /> : formatCurrency(totalPrice)}
          </p>
        </Field>

        {/* Inventory — กินเต็มแถว ไม่แชร์แถวกับ base summary เหมือนเดิม: 4 ค่า
            ยัดใน 2 คอลัมน์ (24.5rem) ไม่พอ ใบที่ตัวเลขยาวหน่อยก็ตกบรรทัด กลาย
            เป็นบางใบสูง 1 บรรทัด บางใบ 2 · เต็มแถวแล้วได้ 1 บรรทัดเสมอ และมีแต่
            ใบสกุลต่างประเทศที่เสียความสูงเพิ่ม (PrItemSummary คืน null ถ้าไม่ใช่) */}
        <div className="col-span-full col-start-1">
          <PrInventoryRow
            control={form.control}
            index={index}
            buCode={buCode ?? ""}
          />
        </div>

        {/* แถว base currency (summary) — เรียงใต้ Subtotal·Discount·Net·Tax·
            Total ของ grid นี้ (เฉพาะสกุลต่างประเทศ) */}
        <PrItemSummary
          subtotal={subtotal}
          discountAmount={discountAmount}
          netAmount={netAmount}
          taxAmount={taxAmount}
          totalPrice={totalPrice}
          exchangeRate={exchangeRate}
          isForeignCurrency={isForeignCurrency}
          baseCurrencyCode={baseCurrencyCode}
          isHidden={hideTotal}
        />
      </div>
    </div>
  );
}
