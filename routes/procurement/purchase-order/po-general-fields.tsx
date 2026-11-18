import { useEffect } from "react";
import { useTranslations } from "use-intl";
import {
  Controller,
  useFormState,
  useWatch,
  type UseFormReturn,
} from "react-hook-form";
import { Field, FieldLabel, FieldDatePicker } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LookupVendor } from "@/components/lookup/lookup-vendor";
import { LookupCreditTerm } from "@/components/lookup/lookup-credit-term";
import { LookupCurrency } from "@/components/lookup/lookup-currency";
import { useCurrency } from "@/hooks/use-currency";
import { useEntitiesByIds } from "@/hooks/use-entities-by-ids";
import type { Currency } from "@/types/currency";
import { useProfile } from "@/hooks/use-profile";
import { FieldGrid } from "@/components/share/compact-section";
import { SettingField } from "@/components/share/setting-field";
import { formatDate } from "@/lib/date-utils";
import { LookupWorkflow } from "@/components/lookup/lookup-workflow";
import { WORKFLOW_TYPE } from "@/types/workflows";
import type { PoFormValues } from "./po-form-schema";
import {
  InputSuffixAddon,
  InputSuffixField,
  InputSuffixAmount,
} from "@/components/ui/input/input-suffix";

interface PoGeneralFieldsProps {
  readonly form: UseFormReturn<PoFormValues>;
  readonly disabled: boolean;
  readonly isManual: boolean;
  readonly readOnly?: boolean;
  readonly isDraft?: boolean;
  readonly isAdd?: boolean;
  /**
   * โหมดดูของหน้า — ตัดสินว่าช่องเป็นข้อความหรือช่องกรอก · แยกจาก `disabled` เพราะ
   * disabled รวม isPending ด้วย ถ้าใช้ตัวนั้น ช่องจะกลายเป็นข้อความชั่วขณะตอนกด Save
   */
  readonly isView?: boolean;
  /** ใบจาก price list ที่พ้น draft — เนื้อหาล็อก ช่องเป็นข้อความแม้อยู่โหมดแก้ */
  readonly contentLocked?: boolean;
  /** ชื่อ workflow สำหรับโหมดข้อความ — ฟอร์มเก็บแค่ workflow_id */
  readonly workflowName?: string;
}

export function PoGeneralFields({
  form,
  disabled,
  isManual,
  readOnly = false,
  isDraft = true,
  isAdd = false,
  isView = false,
  contentLocked = false,
  workflowName,
}: PoGeneralFieldsProps) {
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const { defaultCurrencyId, dateFormat } = useProfile();

  const currencyId = useWatch({ control: form.control, name: "currency_id" });
  const vendorName = useWatch({ control: form.control, name: "vendor_name" });

  // ดึงเฉพาะสกุลตั้งต้นของ BU ตอนที่ฟอร์มยังไม่มีสกุล (ใบใหม่) — ใช้ตั้ง code + rate
  const { items: defaultCurrencies } = useEntitiesByIds<Currency>({
    useListHook: useCurrency,
    ids: !currencyId && defaultCurrencyId ? [defaultCurrencyId] : [],
  });

  const creditTermId = useWatch({
    control: form.control,
    name: "credit_term_id",
  });

  useEffect(() => {
    if (currencyId || !defaultCurrencyId) return;
    const currency = defaultCurrencies.find(
      (c) => c.id === defaultCurrencyId && c.is_active,
    );
    if (currency) {
      form.setValue("currency_id", defaultCurrencyId);
      form.setValue("currency_code", currency.code);
      form.setValue("exchange_rate", currency.exchange_rate);
    }
  }, [currencyId, defaultCurrencyId, defaultCurrencies, form]);

  // Fields editable only when PO is manual (linked PO locks these)
  const fieldDisabled = disabled || readOnly;
  const manualFieldDisabled = fieldDisabled || !isManual;
  const workflowDisabled = manualFieldDisabled || !isDraft;

  // ช่องเป็นข้อความ (ป้ายจาง + ค่าเด่น ไม่มีกรอบ — กฎ 7 ของ carmen-blue-ui-design ทรงเดียวกับ
  // หัวเอกสาร PR/GRN) เมื่อโหมดดู หรือช่องนั้นถูกล็อกถาวร: role อนุมัติ/ใบจบแล้ว (readOnly),
  // ใบ price list พ้น draft, PO จาก PR (ผู้ขาย), workflow พ้น draft · ไม่ใช้ `disabled` ตัดสิน
  // เพราะรวม isPending — ช่องจะกระพริบเป็นข้อความตอนกด Save
  const textMode = isView || readOnly || contentLocked;
  const vendorText = textMode || !isManual;
  const workflowText = vendorText || !isDraft;

  const values = useWatch({ control: form.control });
  // subscribe error เอง — คอมโพเนนต์นี้ถูกส่งเป็น ribbon ของหัวเอกสาร (React Compiler memo
  // element ไว้) อ่าน form.formState.errors จาก prop แล้วไม่ re-render ตอน validate
  const { errors } = useFormState({ control: form.control });
  const date = (v?: string | null) => formatDate(v, dateFormat) || null;
  const rate = Number(values.exchange_rate);
  const rateText = Number.isFinite(rate)
    ? rate.toLocaleString(undefined, {
        minimumFractionDigits: 5,
        maximumFractionDigits: 5,
      })
    : null;

  return (
    // FieldGrid: คอลัมน์ตามความกว้างกล่อง (container query) ไม่ใช่จอ · ลำดับช่องเท่าเดิมทั้งสองโหมด
    // dense = โหมดดู 2 คอลัมน์ตั้งแต่กล่องแคบสุด (ห้ามใช้กับช่องกรอก)
    <FieldGrid dense={isView}>
      {workflowText ? (
        <SettingField label={tfl("workflow")} value={workflowName} />
      ) : (
        <Field>
          <FieldLabel required>{tfl("workflow")}</FieldLabel>
          <Controller
            control={form.control}
            name="workflow_id"
            render={({ field, fieldState }) => (
              <LookupWorkflow
                value={field.value}
                onValueChange={field.onChange}
                workflowType={WORKFLOW_TYPE.PO}
                creatableOnly={isAdd}
                disabled={workflowDisabled}
                className="w-full text-xs"
                error={fieldState.error?.message}
              />
            )}
          />
        </Field>
      )}
      {/* ชื่อผู้ขายยาวกว่าช่องอื่นเป็นปกติ — กิน 2 คอลัมน์กันโดนตัด */}
      {vendorText ? (
        <SettingField label={tfl("vendor")} value={vendorName} fullWidth />
      ) : (
        <Field className="@md:col-span-2">
          <FieldLabel required>{tfl("vendor")}</FieldLabel>
          <Controller
            control={form.control}
            name="vendor_id"
            render={({ field, fieldState }) => (
              <LookupVendor
                value={field.value}
                onValueChange={field.onChange}
                onItemChange={(vendor) => {
                  form.setValue("vendor_name", vendor.name ?? "");
                }}
                defaultLabel={vendorName || undefined}
                disabled={manualFieldDisabled}
                error={fieldState.error?.message}
                className="text-xs"
              />
            )}
          />
        </Field>
      )}

      {textMode ? (
        <SettingField
          label={tfl("creditTerm")}
          value={values.credit_term_name}
        />
      ) : (
        <Field>
          <FieldLabel>{tfl("creditTerm")}</FieldLabel>
          <LookupCreditTerm
            value={creditTermId}
            onValueChange={(val, creditTerm) => {
              form.setValue("credit_term_id", val);
              if (creditTerm) {
                form.setValue("credit_term_name", creditTerm.name ?? "");
                form.setValue("credit_term_value", creditTerm.value ?? 0);
              }
            }}
            disabled={fieldDisabled}
          />
        </Field>
      )}
      {/* วันที่ใบสั่งซื้อ — คู่กับวันที่ส่งของ อ่านด้วยกัน (สั่งวันไหน ของถึงวันไหน)
          ค่าตั้งต้นเป็นวันนี้ (ดู getDefaultValues) */}
      {textMode ? (
        <SettingField
          label={tfl("orderDate")}
          value={date(values.order_date)}
        />
      ) : (
        <Field>
          <FieldLabel required>{tfl("orderDate")}</FieldLabel>
          <Controller
            control={form.control}
            name="order_date"
            render={({ field, fieldState }) => (
              <FieldDatePicker
                value={field.value}
                onValueChange={field.onChange}
                disabled={fieldDisabled}
                placeholder={tc("selectDate")}
                className="w-full text-xs"
                error={fieldState.error?.message}
              />
            )}
          />
        </Field>
      )}
      {textMode ? (
        <SettingField
          label={tfl("deliveryDate")}
          value={date(values.delivery_date)}
        />
      ) : (
        <Field>
          <FieldLabel required>{tfl("deliveryDate")}</FieldLabel>
          <Controller
            control={form.control}
            name="delivery_date"
            render={({ field, fieldState }) => (
              <FieldDatePicker
                value={field.value}
                onValueChange={field.onChange}
                disabled={fieldDisabled}
                placeholder={tc("selectDate")}
                className="w-full text-xs"
                error={fieldState.error?.message}
              />
            )}
          />
        </Field>
      )}
      {/* สกุลเงิน: PO จาก PR ล็อกแค่ตัวสกุล เรตยัง override ได้ จึงเป็นข้อความเฉพาะ textMode */}
      {textMode ? (
        <SettingField
          label={tfl("currency")}
          value={values.currency_code}
          example={rateText}
        />
      ) : (
        <Field>
          {/* ป้ายชิดขวาให้ตรงกับตัวเลขในช่อง ซึ่งจัดชิดขวาแบบคอลัมน์ตัวเลข
              (FieldLabel เป็น w-fit — ดันด้วย ml-auto ไม่ใช่ text-right) */}
          <FieldLabel required htmlFor="po-exchange-rate" className="ml-auto">
            {tfl("currency")}
          </FieldLabel>
          <InputSuffixField
            className="h-8"
            disabled={fieldDisabled}
            error={!!errors.currency_id?.message}
          >
            <InputSuffixAddon>
              <Controller
                control={form.control}
                name="currency_id"
                render={({ field }) => (
                  <LookupCurrency
                    value={field.value}
                    onValueChange={field.onChange}
                    onItemChange={(currency) => {
                      form.setValue("currency_code", currency.code ?? "");
                      form.setValue(
                        "exchange_rate",
                        currency.exchange_rate ?? 1,
                      );
                    }}
                    disabled={manualFieldDisabled}
                    className="h-full w-24 rounded-none border-0 bg-transparent px-2 text-xs shadow-none focus-visible:ring-0"
                  />
                )}
              />
            </InputSuffixAddon>
            {/* เรตแลกเปลี่ยนโชว์ทศนิยม 5 ตำแหน่งเสมอ (1 → 1.00000) */}
            <Controller
              control={form.control}
              name="exchange_rate"
              render={({ field }) => (
                <InputSuffixAmount
                  id="po-exchange-rate"
                  decimals={5}
                  disabled={fieldDisabled}
                  value={Number(field.value) || 0}
                  onValueChange={field.onChange}
                />
              )}
            />
          </InputSuffixField>
        </Field>
      )}

      {/* คำอธิบาย/หมายเหตุ อยู่ในกริดเดียวกับช่องอื่น — ช่องกรอกกว้าง 2 คอลัมน์ · โหมดข้อความ
          (ทรง PR) data-wide = เต็มแถวบนมือถือ ตั้งแต่ @md เหลือคอลัมน์เดียว ค่าส่วนใหญ่สั้นหรือ —
          กิน 2 ช่องแล้วหัวใบสูงขึ้นสองแถวเปล่า ๆ */}
      {textMode ? (
        <div data-wide="" className="min-w-0 @md:col-span-1!">
          <SettingField label={tfl("description")} value={values.description} />
        </div>
      ) : (
        <Field className="@md:col-span-2">
          <FieldLabel htmlFor="po-description">{tfl("description")}</FieldLabel>
          <Input
            id="po-description"
            placeholder={tfl("optional")}
            maxLength={256}
            disabled={fieldDisabled}
            className="text-xs"
            {...form.register("description")}
          />
        </Field>
      )}

      {textMode ? (
        <div data-wide="" className="min-w-0 @md:col-span-1!">
          <SettingField label={tfl("remarks")} value={values.remarks} />
        </div>
      ) : (
        <Field className="@md:col-span-2">
          <FieldLabel htmlFor="po-remarks">{tfl("remarks")}</FieldLabel>
          <Input
            id="po-remarks"
            placeholder={tfl("optional")}
            maxLength={256}
            disabled={fieldDisabled}
            className="text-xs"
            {...form.register("remarks")}
          />
        </Field>
      )}
    </FieldGrid>
  );
}
