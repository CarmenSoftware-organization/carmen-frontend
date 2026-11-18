import { useTranslations } from "use-intl";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import {
  Field,
  FieldDatePicker,
  FieldInput,
  FieldLabel,
  FieldSelect,
} from "@/components/ui/field";
import {
  InputSuffixAddon,
  InputSuffixField,
  InputSuffixAmount,
} from "@/components/ui/input/input-suffix";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { LookupVendor } from "@/components/lookup/lookup-vendor";
import { LookupCurrency } from "@/components/lookup/lookup-currency";
import { LookupGrnByVendorForCn } from "@/components/lookup/lookup-grn-by-vendor-for-cn";
import { LookupCnReason } from "@/components/lookup/lookup-cn-reason";
import { FieldGrid } from "@/components/share/compact-section";
import { SettingField } from "@/components/share/setting-field";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { CnFormValues } from "./cn-form-schema";
import { grnCurrencyId } from "./cn-grn-currency";

interface CnGeneralFieldsProps {
  readonly form: UseFormReturn<CnFormValues>;
  readonly disabled: boolean;
  /** โหมดดู: ทุกช่องเป็นข้อความ (ป้ายจาง + ค่าเด่น) ไม่ใช่ input ที่ disable */
  readonly isView?: boolean;
  readonly vendorName?: string;
  /** ชื่อเหตุผลของใบที่บันทึกแล้ว — ฟอร์มถือแค่ id */
  readonly reasonName?: string | null;
  /** รหัสสกุลเงินของใบที่บันทึกแล้ว — ฟอร์มถือแค่ id */
  readonly currencyCode?: string | null;
  /**
   * GRN ที่ผูกกับใบไว้แล้ว — เป็น `defaultLabel` ของ lookup GRN ซึ่งโหลดทีละหน้า
   * และแสดงเฉพาะ GRN ที่ยังออก CN ได้ ใบที่ผูกไปแล้วจึงอาจไม่อยู่ในรายการเลย
   */
  readonly savedGrn?: { id: string | null; no: string | null } | null;
}

export function CnGeneralFields({
  form,
  disabled,
  isView = false,
  vendorName,
  reasonName,
  currencyCode,
  savedGrn,
}: CnGeneralFieldsProps) {
  "use no memo";
  const t = useTranslations("procurement.creditNote");
  const tfl = useTranslations("field");
  const tc = useTranslations("common");

  const errors = form.formState.errors;
  const vendorId = useWatch({ control: form.control, name: "vendor_id" });
  const invoiceNo = useWatch({ control: form.control, name: "invoice_no" });
  const values = useWatch({ control: form.control });
  const { dateFormat } = useProfile();
  const date = (v?: string | null) => formatDate(v, dateFormat) || null;
  const rate = Number(values.exchange_rate);
  const rateText = Number.isFinite(rate)
    ? rate.toLocaleString(undefined, {
        minimumFractionDigits: 5,
        maximumFractionDigits: 5,
      })
    : null;
  // GRN ยังเป็นใบเดิมของเอกสาร = รู้ชื่อ/รหัสที่ backend ส่งมา · เลือก GRN ใหม่
  // ในโหมดแก้แล้ว currency เปลี่ยนเป็น id ที่ยังไม่มีรหัส → กลับไปใช้ lookup ที่ล็อกไว้
  const sameGrn = !!values.grn_id && values.grn_id === savedGrn?.id;
  const currencyText = sameGrn ? currencyCode : null;

  return (
    // FieldGrid: คอลัมน์ตามความกว้างกล่อง (container query) ไม่ใช่ความกว้างจอ
    // ช่องที่แก้ไม่ได้ (โหมดดู หรือค่าที่ตามมาจาก GRN) เป็นข้อความ — กรอบมีเฉพาะช่องที่กรอกได้จริง
    <FieldGrid dense={isView}>
      {isView ? (
        <SettingField label={tfl("vendor")} value={vendorName} fullWidth />
      ) : (
        <Field className="@md:col-span-2">
          <FieldLabel required>{tfl("vendor")}</FieldLabel>
          <Controller
            control={form.control}
            name="vendor_id"
            render={({ field }) => (
              <LookupVendor
                value={field.value}
                onValueChange={field.onChange}
                defaultLabel={vendorName}
                disabled={disabled}
                error={errors.vendor_id?.message}
                className="text-xs"
              />
            )}
          />
        </Field>
      )}
      {isView ? (
        <SettingField label={tfl("grnNo")} value={savedGrn?.no} />
      ) : (
        <Field>
          <FieldLabel required>{tfl("grnNo")}</FieldLabel>
          <Controller
            control={form.control}
            name="grn_id"
            render={({ field }) => (
              <LookupGrnByVendorForCn
                value={field.value}
                onValueChange={field.onChange}
                onItemChange={(grn) => {
                  form.setValue("grn_date", grn.grn_date ?? "");
                  form.setValue("currency_code", grnCurrencyId(grn));
                  form.setValue("exchange_rate", grn.exchange_rate ?? 1);
                  form.setValue("invoice_no", grn.invoice_no ?? "");
                  form.setValue("invoice_date", grn.invoice_date ?? "");
                  form.setValue("items", [], { shouldDirty: true });
                }}
                vendorId={vendorId}
                defaultLabel={
                  field.value && field.value === savedGrn?.id
                    ? (savedGrn.no ?? undefined)
                    : undefined
                }
                disabled={disabled}
                error={errors.grn_id?.message}
                className="text-xs"
              />
            )}
          />
        </Field>
      )}
      {/* สามช่องนี้ตามมาจาก GRN ที่เลือก ไม่มีโหมดไหนแก้ได้ → ข้อความเสมอ */}
      <SettingField label={tfl("grnDate")} value={date(values.grn_date)} />
      <SettingField label={tfl("invoiceNo")} value={invoiceNo} />
      <SettingField
        label={tfl("invoiceDate")}
        value={date(values.invoice_date)}
      />
      {isView ? (
        <SettingField
          label={t("cnType")}
          value={
            values.credit_note_type === "quantity_return"
              ? t("quantityReturn")
              : values.credit_note_type === "amount_discount"
                ? t("amountDiscount")
                : null
          }
        />
      ) : (
        <Field>
          <FieldLabel required>{t("cnType")}</FieldLabel>
          <Controller
            control={form.control}
            name="credit_note_type"
            render={({ field }) => (
              <FieldSelect
                value={field.value}
                onValueChange={field.onChange}
                placeholder={tfl("selectType")}
                className="w-full text-xs"
                disabled={disabled}
                error={errors.credit_note_type?.message}
                size="sm"
              >
                <SelectContent>
                  <SelectItem value="quantity_return" className="text-xs">
                    {t("quantityReturn")}
                  </SelectItem>
                  <SelectItem value="amount_discount" className="text-xs">
                    {t("amountDiscount")}
                  </SelectItem>
                </SelectContent>
              </FieldSelect>
            )}
          />
        </Field>
      )}

      {isView ? (
        <SettingField label={tfl("reason")} value={reasonName} />
      ) : (
        <Field>
          <FieldLabel required>{tfl("reason")}</FieldLabel>
          <Controller
            control={form.control}
            name="reason"
            render={({ field }) => (
              <LookupCnReason
                value={field.value}
                onValueChange={field.onChange}
                disabled={disabled}
                error={errors.reason?.message}
                className="w-full text-xs"
              />
            )}
          />
        </Field>
      )}

      {isView ? (
        <SettingField label={tfl("docDate")} value={date(values.cn_date)} />
      ) : (
        <Field>
          <FieldLabel required>{tfl("docDate")}</FieldLabel>
          <Controller
            control={form.control}
            name="cn_date"
            render={({ field }) => (
              <FieldDatePicker
                value={field.value}
                onValueChange={field.onChange}
                placeholder={tc("selectDate")}
                className="w-full text-xs"
                disabled={disabled}
                error={errors.cn_date?.message}
              />
            )}
          />
        </Field>
      )}
      {isView ? (
        <SettingField
          label={tfl("taxInvoiceNo")}
          value={values.tax_invoice_no}
        />
      ) : (
        <Field>
          <FieldLabel htmlFor="cn-tax-invoice-no" required>
            {tfl("taxInvoiceNo")}
          </FieldLabel>
          <FieldInput
            id="cn-tax-invoice-no"
            placeholder="e.g. TAX-001"
            className="h-8"
            disabled={disabled}
            maxLength={100}
            error={errors.tax_invoice_no?.message}
            {...form.register("tax_invoice_no")}
          />
        </Field>
      )}

      {isView ? (
        <SettingField
          label={tfl("taxInvoiceDate")}
          value={date(values.tax_invoice_date)}
        />
      ) : (
        <Field>
          <FieldLabel required>{tfl("taxInvoiceDate")}</FieldLabel>
          <Controller
            control={form.control}
            name="tax_invoice_date"
            render={({ field }) => (
              <FieldDatePicker
                value={field.value}
                onValueChange={field.onChange}
                disabled={disabled}
                placeholder={tc("selectDate")}
                className="w-full text-xs"
                error={errors.tax_invoice_date?.message}
              />
            )}
          />
        </Field>
      )}
      {isView || currencyText ? (
        <SettingField
          label={tfl("currency")}
          value={currencyText ?? currencyCode}
          trailing={rateText}
        />
      ) : (
        <Field>
          <FieldLabel htmlFor="cn-exchange-rate" required>
            {tfl("currency")}
          </FieldLabel>
          {/* สกุลเงินกับเรตมาจากใบรับของที่เลือก แก้เองไม่ได้ — ใบลดหนี้ต้องอยู่
            สกุลเดียวกับ GRN ต้นทางเสมอ ไม่มี default จากโปรไฟล์อีกแล้ว */}
          <InputSuffixField disabled error={!!errors.currency_code?.message}>
            <InputSuffixAddon>
              <Controller
                control={form.control}
                name="currency_code"
                render={({ field }) => (
                  <LookupCurrency
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled
                    className="h-full w-24 rounded-none border-0 bg-transparent px-2 text-xs shadow-none focus-visible:ring-0"
                  />
                )}
              />
            </InputSuffixAddon>
            <Controller
              control={form.control}
              name="exchange_rate"
              render={({ field }) => (
                <InputSuffixAmount
                  id="cn-exchange-rate"
                  decimals={5}
                  disabled
                  value={Number(field.value) || 0}
                  onValueChange={field.onChange}
                />
              )}
            />
          </InputSuffixField>
        </Field>
      )}

      {/* คำอธิบายอยู่ในตารางเดียวกับช่องอื่น ไม่ใช่ก้อนแยกใต้ฟอร์ม — ช่อง
          บรรทัดเดียวกว้าง 2 คอลัมน์ ไม่ใช่ Textarea เพราะจำกัด 256 ตัวอักษร
          อยู่แล้ว เป็นข้อความสั้น ไม่ใช่บันทึกยาว */}
      {isView ? (
        <SettingField
          label={tfl("description")}
          value={values.description}
          fullWidth
        />
      ) : (
        <Field className="@md:col-span-2">
          <FieldLabel htmlFor="cn-description">{tfl("description")}</FieldLabel>
          <Input
            id="cn-description"
            placeholder={tfl("optional")}
            maxLength={256}
            disabled={disabled}
            className="text-xs"
            {...form.register("description")}
          />
        </Field>
      )}
    </FieldGrid>
  );
}
