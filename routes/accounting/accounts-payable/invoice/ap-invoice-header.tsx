import { useTranslations } from "use-intl";
import { LookupCreditTerm } from "@/components/lookup/lookup-credit-term";
import { LookupCurrency } from "@/components/lookup/lookup-currency";
import { LookupVendor } from "@/components/lookup/lookup-vendor";
import { Card, CardContent } from "@/components/ui/card";
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
import { useProfile } from "@/hooks/use-profile";
import { addDays, formatDate, isoToDateInput } from "@/lib/date-utils";
import type { ApDocType } from "@/types/accounts-payable";
import {
  ymdToPickerValue,
  type InvoiceErrorKey,
  type InvoiceForm,
} from "./ap-invoice-form";
import { ApReadValue } from "../shared/ap-read-value";

const DOC_TYPES: ApDocType[] = [
  "invoice",
  "debit_note",
  "credit_note",
  "deposit",
];
const DECIMAL_RE = /^\d*(\.\d*)?$/;

/** ส่วนหัวของฟอร์ม AP invoice — vendor/currency/doc_type แก้ได้เฉพาะตอนสร้าง */
export function InvoiceHeader({
  form,
  onChange,
  isNew,
  editable,
  errors,
  dueDate,
}: {
  readonly form: InvoiceForm;
  readonly onChange: (patch: Partial<InvoiceForm>) => void;
  readonly isNew: boolean;
  readonly editable: boolean;
  readonly errors: ReadonlySet<InvoiceErrorKey>;
  /** due_date จาก backend (ใช้เมื่อไม่ได้แก้อยู่) */
  readonly dueDate?: string;
}) {
  const t = useTranslations("accounting.accountsPayable.invoice");
  const { dateFormat } = useProfile();
  const err = (key: InvoiceErrorKey) =>
    errors.has(key) ? (
      <FieldError>{t(`detail.errors.${key}`)}</FieldError>
    ) : null;
  const computedDue = form.invoice_date
    ? addDays(ymdToPickerValue(form.invoice_date), form.credit_term_days)
    : "";
  const due = editable ? computedDue : (dueDate ?? computedDue);

  return (
    <Card>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field>
          <FieldLabel required>{t("docType")}</FieldLabel>
          {editable ? (
            <Select
              value={form.doc_type}
              disabled={!isNew}
              onValueChange={(value) =>
                onChange({ doc_type: value as ApDocType })
              }
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`docTypes.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <ApReadValue>{t(`docTypes.${form.doc_type}`)}</ApReadValue>
          )}
        </Field>
        <Field>
          <FieldLabel required>{t("docDate")}</FieldLabel>
          <DatePicker
            value={ymdToPickerValue(form.doc_date)}
            onValueChange={(iso) => onChange({ doc_date: isoToDateInput(iso) })}
            readOnly={!editable}
            hideClear
            invalid={errors.has("docDate")}
            className="w-full"
          />
          {err("docDate")}
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel required>{t("vendor")}</FieldLabel>
          {isNew && editable ? (
            <LookupVendor
              value={form.vendor_id}
              onValueChange={(id) => onChange({ vendor_id: id })}
              onItemChange={(vendor) =>
                onChange({ vendor_name: vendor.name ?? vendor.code ?? "" })
              }
              error={errors.has("vendor") ? t("detail.errors.vendor") : undefined}
            />
          ) : (
            <span className="inline-flex min-h-8 items-center text-xs font-medium">
              {form.vendor_name || "—"}
            </span>
          )}
        </Field>
        <Field>
          <FieldLabel required>{t("vendorInvoiceNo")}</FieldLabel>
          {editable ? (
            <Input
              value={form.vendor_invoice_no}
              maxLength={100}
              aria-invalid={errors.has("vendorInvoiceNo") || undefined}
              onChange={(event) =>
                onChange({ vendor_invoice_no: event.target.value })
              }
            />
          ) : (
            <ApReadValue>{form.vendor_invoice_no}</ApReadValue>
          )}
          {err("vendorInvoiceNo")}
        </Field>
        <Field>
          <FieldLabel required>{t("detail.invoiceDate")}</FieldLabel>
          <DatePicker
            value={ymdToPickerValue(form.invoice_date)}
            onValueChange={(iso) =>
              onChange({ invoice_date: isoToDateInput(iso) })
            }
            readOnly={!editable}
            hideClear
            invalid={errors.has("invoiceDate")}
            className="w-full"
          />
          {err("invoiceDate")}
        </Field>
        <Field>
          <FieldLabel>{t("detail.creditTerm")}</FieldLabel>
          {editable ? (
            <LookupCreditTerm
              value={form.credit_term_id}
              onValueChange={(id, term) =>
                onChange({
                  credit_term_id: id,
                  credit_term_days: term?.value ?? form.credit_term_days,
                })
              }
            />
          ) : (
            <span className="inline-flex min-h-8 items-center text-xs font-medium">
              {t("detail.days", { count: form.credit_term_days })}
            </span>
          )}
        </Field>
        <Field>
          <FieldLabel>{t("detail.dueDate")}</FieldLabel>
          <span className="inline-flex min-h-8 items-center text-xs font-medium">
            {due ? formatDate(due, dateFormat) : "—"}
          </span>
        </Field>
        <Field>
          <FieldLabel>{t("detail.currency")}</FieldLabel>
          {isNew && editable ? (
            <LookupCurrency
              fullWidth
              value={form.currency_id}
              onValueChange={(id) => onChange({ currency_id: id })}
              onItemChange={(currency) =>
                onChange({
                  currency_code: currency.code ?? "",
                  exchange_rate:
                    currency.exchange_rate != null
                      ? String(currency.exchange_rate)
                      : form.exchange_rate,
                })
              }
            />
          ) : (
            <span className="inline-flex min-h-8 items-center text-xs font-medium">
              {form.currency_code || "—"}
            </span>
          )}
        </Field>
        <Field>
          <FieldLabel>{t("detail.exchangeRate")}</FieldLabel>
          {editable ? (
            <Input
              inputMode="decimal"
              className="text-right tabular-nums"
              value={form.exchange_rate}
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
        <Field className="sm:col-span-2 lg:col-span-4">
          <FieldLabel>{t("detail.description")}</FieldLabel>
          {editable ? (
            <Textarea
              rows={2}
              value={form.description}
              onChange={(event) =>
                onChange({ description: event.target.value })
              }
            />
          ) : (
            <ApReadValue multiline>{form.description}</ApReadValue>
          )}
        </Field>
      </CardContent>
    </Card>
  );
}
