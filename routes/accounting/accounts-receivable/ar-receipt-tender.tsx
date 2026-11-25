import { useTranslations } from "use-intl";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDatePicker,
  FieldInput,
  FieldLabel,
  FieldPlainText,
  FieldSelect,
} from "@/components/ui/field";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { useBankAccounts } from "@/hooks/use-accounting-master";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { ACTIVE_ONLY_FILTER } from "@/hooks/use-lookup-pagination";
import { useTaxProfile } from "@/hooks/use-tax-profile";
import { isoToDateInput } from "@/lib/date-utils";
import {
  receiptWhtBase,
  RECEIPT_PAY_TYPES,
  suggestedReceiptWht,
  type ArReceipt,
  type ReceiptTender,
} from "./ar-receipt-model";

/** One tender (single payment channel) with bank charge. */
export function ReceiptTenderSection({
  receipt,
  readonly,
  baseCurrency,
  patch,
}: {
  readonly receipt: ArReceipt;
  readonly readonly: boolean;
  readonly baseCurrency: string;
  readonly patch: (patch: Partial<ReceiptTender>) => void;
}) {
  const t = useTranslations("accounting.arReceipt");
  const money = useAmountFormatter();
  const tender = receipt.tender;
  const accounts = useBankAccounts().data ?? [];
  const banks = accounts.filter(
    (bank) =>
      bank.id === tender.bankAccountId ||
      (bank.is_active &&
        (!bank.currency_code ||
          bank.currency_code === receipt.currency ||
          bank.currency_code === baseCurrency)),
  );
  const bankLabel =
    tender.bankAccountLabel ||
    banks.find((bank) => bank.id === tender.bankAccountId)?.account_name ||
    "—";
  const num = (key: "amount" | "charge", label: string) => (
    <Field>
      <FieldLabel htmlFor={`receipt-${key}`} required={key === "amount"}>
        {label} ({receipt.currency})
      </FieldLabel>
      {readonly ? (
        <FieldPlainText className="tabular-nums">
          {money(tender[key])}
        </FieldPlainText>
      ) : (
        <FieldInput
          id={`receipt-${key}`}
          type="number"
          min="0"
          step="0.01"
          value={tender[key]}
          className="text-right tabular-nums"
          onChange={(event) => patch({ [key]: Number(event.target.value) })}
        />
      )}
    </Field>
  );
  const text = (
    key: "reference" | "payerName" | "chequeNo",
    label: string,
    max: number,
  ) => (
    <Field>
      <FieldLabel htmlFor={`receipt-${key}`}>{label}</FieldLabel>
      {readonly ? (
        <FieldPlainText>{tender[key] || "—"}</FieldPlainText>
      ) : (
        <FieldInput
          id={`receipt-${key}`}
          value={tender[key]}
          maxLength={max}
          onChange={(event) => patch({ [key]: event.target.value })}
        />
      )}
    </Field>
  );
  return (
    <div className="grid grid-cols-1 gap-4 @xl/receipt:grid-cols-4">
      <Field>
        <FieldLabel>{t("payType")}</FieldLabel>
        {readonly ? (
          <FieldPlainText>{t(`payTypes.${tender.method}`)}</FieldPlainText>
        ) : (
          <FieldSelect
            value={tender.method}
            onValueChange={(value) =>
              patch({ method: value as ReceiptTender["method"] })
            }
          >
            <SelectContent>
              {RECEIPT_PAY_TYPES.map((method) => (
                <SelectItem key={method} value={method}>
                  {t(`payTypes.${method}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </FieldSelect>
        )}
      </Field>
      <Field className="@xl/receipt:col-span-2">
        <FieldLabel required>{t("bankAccountPick")}</FieldLabel>
        {readonly ? (
          <FieldPlainText>{bankLabel}</FieldPlainText>
        ) : (
          <FieldSelect
            value={tender.bankAccountId}
            onValueChange={(value) => {
              const bank = banks.find((row) => row.id === value);
              patch({
                bankAccountId: value,
                bankAccountLabel: bank
                  ? [bank.code, bank.account_name].filter(Boolean).join(" · ")
                  : "",
              });
            }}
          >
            <SelectContent>
              {banks.map((bank) => (
                <SelectItem key={bank.id} value={bank.id}>
                  {[bank.code, bank.account_name, bank.currency_code]
                    .filter(Boolean)
                    .join(" · ")}
                </SelectItem>
              ))}
            </SelectContent>
          </FieldSelect>
        )}
      </Field>
      <Field>
        <FieldLabel>{t("valueDate")}</FieldLabel>
        <FieldDatePicker
          className="w-full"
          value={tender.date}
          onValueChange={(value) => patch({ date: isoToDateInput(value) })}
          readOnly={readonly}
          hideClear
        />
      </Field>
      {num("amount", t("receivedAmount"))}
      {num("charge", t("bankCharge"))}
      {text("reference", t("reference"), 100)}
      {text("payerName", t("payerName"), 200)}
      {tender.method === "cheque" && (
        <>
          {text("chequeNo", t("chequeNo"), 50)}
          <Field>
            <FieldLabel>{t("chequeDate")}</FieldLabel>
            <FieldDatePicker
              className="w-full"
              value={tender.chequeDate}
              onValueChange={(value) =>
                patch({ chequeDate: isoToDateInput(value) })
              }
              readOnly={readonly}
              hideClear
            />
          </Field>
        </>
      )}
    </div>
  );
}

/** Withholding tax: profile gives the rate (read-only); the amount can be overridden. */
export function ReceiptWhtSection({
  receipt,
  readonly,
  set,
}: {
  readonly receipt: ArReceipt;
  readonly readonly: boolean;
  readonly set: (patch: Partial<ArReceipt>) => void;
}) {
  const t = useTranslations("accounting.arReceipt");
  const money = useAmountFormatter();
  const profiles =
    useTaxProfile({
      perpage: 100,
      filter: `tax_type|string:wht,${ACTIVE_ONLY_FILTER}`,
    }).data?.data ?? [];
  const profile = profiles.find((row) => row.id === receipt.whtProfileId);
  const base = receiptWhtBase(receipt) || receipt.whtBase;
  const suggested = (rate: number) =>
    suggestedReceiptWht(rate, receipt) || Math.round(base * rate) / 100;
  return (
    <div className="space-y-3">
      <Field>
        <FieldLabel htmlFor="receipt-wht-toggle">
          <Checkbox
            id="receipt-wht-toggle"
            checked={receipt.whtEnabled}
            disabled={readonly}
            onCheckedChange={(value) =>
              set({
                whtEnabled: value === true,
                ...(value !== true && { whtAmount: 0 }),
              })
            }
          />
          {t("whtSection")}
        </FieldLabel>
      </Field>
      {receipt.whtEnabled && (
        <div className="grid grid-cols-1 gap-4 @xl/receipt:grid-cols-4">
          <Field className="@xl/receipt:col-span-2">
            <FieldLabel required>{t("whtProfile")}</FieldLabel>
            {readonly ? (
              <FieldPlainText>{profile?.name ?? "—"}</FieldPlainText>
            ) : (
              <FieldSelect
                value={receipt.whtProfileId}
                onValueChange={(value) => {
                  const next = profiles.find((row) => row.id === value);
                  set({
                    whtProfileId: value,
                    whtAmount: next ? suggested(next.tax_rate) : 0,
                  });
                }}
              >
                <SelectContent>
                  {profiles.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </FieldSelect>
            )}
          </Field>
          <Field>
            <FieldLabel>{t("whtBase")}</FieldLabel>
            <FieldPlainText className="tabular-nums">
              {money(base)}
            </FieldPlainText>
          </Field>
          <Field>
            <FieldLabel>{t("whtRate")}</FieldLabel>
            <FieldPlainText className="tabular-nums">
              {profile ? `${profile.tax_rate}%` : "—"}
            </FieldPlainText>
          </Field>
          <Field>
            <FieldLabel htmlFor="receipt-wht-amount">
              {t("whtAmount")}
            </FieldLabel>
            {readonly ? (
              <FieldPlainText className="tabular-nums">
                {money(receipt.whtAmount)}
              </FieldPlainText>
            ) : (
              <FieldInput
                id="receipt-wht-amount"
                type="number"
                min="0"
                step="0.01"
                value={receipt.whtAmount}
                className="text-right tabular-nums"
                onChange={(event) =>
                  set({ whtAmount: Number(event.target.value) })
                }
              />
            )}
          </Field>
          <Field className="@xl/receipt:col-span-2">
            <FieldLabel htmlFor="receipt-wht-certificate">
              {t("whtCertificate")}
            </FieldLabel>
            {readonly ? (
              <FieldPlainText>{receipt.whtCertificate || "—"}</FieldPlainText>
            ) : (
              <FieldInput
                id="receipt-wht-certificate"
                value={receipt.whtCertificate}
                maxLength={100}
                onChange={(event) =>
                  set({ whtCertificate: event.target.value })
                }
              />
            )}
          </Field>
          <Field>
            <FieldLabel>{t("whtCertificateDate")}</FieldLabel>
            <FieldDatePicker
              className="w-full"
              value={receipt.whtCertificateDate}
              onValueChange={(value) =>
                set({ whtCertificateDate: isoToDateInput(value) })
              }
              readOnly={readonly}
            />
          </Field>
        </div>
      )}
    </div>
  );
}
