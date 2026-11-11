import { useTranslations } from "use-intl";
import { LookupVendor } from "@/components/lookup/lookup-vendor";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBankAccounts } from "@/hooks/use-accounting-master";
import { isoToDateInput } from "@/lib/date-utils";
import type { ApPaymentMethod } from "@/types/accounts-payable";
import {
  PAYMENT_METHODS,
  ymdToPickerValue,
  type PaymentErrorKey,
  type PaymentForm,
} from "./ap-payment-form";
import { ApReadValue } from "../shared/ap-read-value";

const DECIMAL_RE = /^\d*(\.\d*)?$/;

export function PaymentHeader({
  form,
  onChange,
  isNew,
  editable,
  errors,
  currencyCode,
  baseCurrencyCode,
  bankLabel,
}: {
  readonly form: PaymentForm;
  readonly onChange: (patch: Partial<PaymentForm>) => void;
  readonly isNew: boolean;
  readonly editable: boolean;
  readonly errors: ReadonlySet<PaymentErrorKey>;
  /** สกุลเงินของเอกสารที่เลือกจ่าย (null = ยังไม่เลือก) — กรองบัญชีธนาคารให้สกุลตรงกัน */
  readonly currencyCode: string | null;
  readonly baseCurrencyCode: string | null;
  /** ชื่อบัญชีธนาคารจาก response (โหมดอ่าน) */
  readonly bankLabel?: string;
}) {
  const t = useTranslations("accounting.accountsPayable.payment");
  const td = useTranslations("accounting.accountsPayable.payment.detail");
  const bankAccounts = useBankAccounts().data;
  const banks = (bankAccounts ?? []).filter(
    (b) =>
      (b.is_active || b.id === form.bank_account_id) &&
      (!currencyCode ||
        !b.currency_code ||
        b.currency_code === currencyCode ||
        b.currency_code === baseCurrencyCode),
  );
  const err = (key: PaymentErrorKey) =>
    errors.has(key) ? <FieldError>{td(`errors.${key}`)}</FieldError> : null;
  const foreign =
    !!currencyCode && !!baseCurrencyCode && currencyCode !== baseCurrencyCode;
  const bankDisplay =
    bankLabel ||
    banks.find((b) => b.id === form.bank_account_id)?.account_name ||
    "—";

  return (
    <div className="grid gap-4 border-b pb-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field className="sm:col-span-2">
        <FieldLabel required>{t("vendor")}</FieldLabel>
        {isNew && editable ? (
          <LookupVendor
            value={form.vendor_id}
            onValueChange={(id) => onChange({ vendor_id: id })}
            onItemChange={(vendor) =>
              onChange({ vendor_name: vendor.name ?? vendor.code ?? "" })
            }
            error={errors.has("vendor") ? td("errors.vendor") : undefined}
          />
        ) : (
          <span className="inline-flex min-h-8 items-center text-xs font-medium">
            {form.vendor_name || "—"}
          </span>
        )}
      </Field>
      <Field>
        <FieldLabel required>{t("paymentDate")}</FieldLabel>
        <DatePicker
          value={ymdToPickerValue(form.payment_date)}
          onValueChange={(iso) =>
            onChange({ payment_date: isoToDateInput(iso) })
          }
          readOnly={!editable}
          hideClear
          invalid={errors.has("paymentDate")}
          className="w-full"
        />
        {err("paymentDate")}
      </Field>
      <Field>
        <FieldLabel>{td("paidDate")}</FieldLabel>
        <DatePicker
          value={ymdToPickerValue(form.paid_date)}
          onValueChange={(iso) => onChange({ paid_date: isoToDateInput(iso) })}
          readOnly={!editable}
          className="w-full"
        />
      </Field>
      <Field className="sm:col-span-2">
        <FieldLabel required>{t("bankAccount")}</FieldLabel>
        {editable ? (
          <Select
            value={form.bank_account_id}
            onValueChange={(value) => onChange({ bank_account_id: value })}
          >
            <SelectTrigger
              size="sm"
              aria-invalid={errors.has("bank") || undefined}
            >
              <SelectValue placeholder={td("selectBank")} />
            </SelectTrigger>
            <SelectContent>
              {banks.map((bank) => (
                <SelectItem key={bank.id} value={bank.id}>
                  {[bank.code, bank.account_name, bank.currency_code]
                    .filter(Boolean)
                    .join(" · ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="inline-flex min-h-8 items-center text-xs font-medium">
            {bankDisplay}
          </span>
        )}
        {err("bank")}
      </Field>
      <Field>
        <FieldLabel>{t("method")}</FieldLabel>
        {editable ? (
          <Select
            value={form.payment_method}
            onValueChange={(value) =>
              onChange({ payment_method: value as ApPaymentMethod })
            }
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((method) => (
                <SelectItem key={method} value={method}>
                  {t(`methods.${method}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <ApReadValue>{t(`methods.${form.payment_method}`)}</ApReadValue>
        )}
      </Field>
      <Field>
        <FieldLabel>{t("referenceNo")}</FieldLabel>
        {editable ? (
          <Input
            value={form.reference_no}
            maxLength={100}
            onChange={(event) => onChange({ reference_no: event.target.value })}
          />
        ) : (
          <ApReadValue>{form.reference_no}</ApReadValue>
        )}
      </Field>
      {form.payment_method === "cheque" && (
        <>
          <Field>
            <FieldLabel>{td("chequeNo")}</FieldLabel>
            {editable ? (
              <Input
                value={form.cheque_no}
                maxLength={50}
                onChange={(event) =>
                  onChange({ cheque_no: event.target.value })
                }
              />
            ) : (
              <ApReadValue>{form.cheque_no}</ApReadValue>
            )}
          </Field>
          <Field>
            <FieldLabel>{td("chequeDate")}</FieldLabel>
            <DatePicker
              value={ymdToPickerValue(form.cheque_date)}
              onValueChange={(iso) =>
                onChange({ cheque_date: isoToDateInput(iso) })
              }
              readOnly={!editable}
              className="w-full"
            />
          </Field>
        </>
      )}
      <Field>
        <FieldLabel>{td("currency")}</FieldLabel>
        <span className="inline-flex min-h-8 items-center text-xs font-medium">
          {currencyCode ?? "—"}
        </span>
      </Field>
      {(foreign || (!isNew && form.exchange_rate)) && (
        <Field>
          <FieldLabel>{td("exchangeRate")}</FieldLabel>
          {editable ? (
            <Input
              inputMode="decimal"
              className="text-right tabular-nums"
              value={form.exchange_rate}
              placeholder={td("exchangeRateAuto")}
              aria-invalid={errors.has("exchangeRate") || undefined}
              onChange={(event) => {
                if (DECIMAL_RE.test(event.target.value))
                  onChange({ exchange_rate: event.target.value });
              }}
            />
          ) : (
            <ApReadValue className="tabular-nums">
              {form.exchange_rate}
            </ApReadValue>
          )}
          {err("exchangeRate")}
        </Field>
      )}
      <Field className="sm:col-span-2 lg:col-span-4">
        <FieldLabel>{td("description")}</FieldLabel>
        {editable ? (
          <Textarea
            rows={2}
            value={form.description}
            onChange={(event) => onChange({ description: event.target.value })}
          />
        ) : (
          <ApReadValue multiline>{form.description}</ApReadValue>
        )}
      </Field>
    </div>
  );
}
