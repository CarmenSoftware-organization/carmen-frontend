import { useState } from "react";
import { useTranslations } from "use-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import type { ArInvoiceReferenceInput } from "./ar-invoice-draft-model";
import { useArRegister } from "./use-ar-register";

export function ArInvoiceReferences({
  customerId,
  currency,
  rate,
  references,
  change,
  disabled,
}: {
  readonly customerId?: string;
  readonly currency: string;
  readonly rate: number;
  readonly references: ArInvoiceReferenceInput[];
  readonly change: (value: ArInvoiceReferenceInput[]) => void;
  readonly disabled: boolean;
}) {
  const t = useTranslations("accounting.arRegister");
  const money = useAmountFormatter();
  const [selected, setSelected] = useState("");
  const [amount, setAmount] = useState("");
  const query = useArRegister(
    {
      perpage: 100,
      filter: `doc_type|string:credit_note;doc_status|string:posted${customerId ? `;customer_id|string:${customerId}` : ""}`,
    },
    { enabled: !!customerId },
  );
  const rows = (query.data?.data ?? []).filter(
    (row) =>
      row.currency_code === currency &&
      Number(row.exchange_rate) === rate &&
      !references.some((ref) => ref.ref_ar_invoice_id === row.id),
  );
  const row = rows.find((item) => item.id === selected);
  const available = row
    ? Math.min(
        Number(row.outstanding_amount),
        Number(row.total_amount) - Number(row.reference_applied_amount ?? 0),
      )
    : 0;
  function add() {
    if (
      disabled ||
      !row ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0 ||
      Number(amount) > available
    )
      return;
    change([
      ...references,
      { ref_ar_invoice_id: row.id, applied_amount: amount },
    ]);
    setSelected("");
    setAmount("");
  }
  return (
    <div className="@container space-y-3">
      <p className="text-muted-foreground text-xs">{t("referenceRules")}</p>
      <div className="grid min-w-0 gap-3 @md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] @md:items-end">
        <Field>
          <FieldLabel>{t("applyCreditNote")}</FieldLabel>
          <Select
            value={selected}
            onValueChange={(id) => {
              setSelected(id);
              const item = rows.find((row) => row.id === id);
              setAmount(
                String(
                  item
                    ? Math.min(
                        Number(item.outstanding_amount),
                        Number(item.total_amount) -
                          Number(item.reference_applied_amount ?? 0),
                      )
                    : 0,
                ),
              );
            }}
            disabled={disabled || !customerId || query.isPending}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("selectReference")} />
            </SelectTrigger>
            <SelectContent>
              {rows.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.doc_no} · {money(Number(row.outstanding_amount))}{" "}
                  {row.currency_code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="ar-reference-amount">{t("applied")}</FieldLabel>
          <FieldInput
            id="ar-reference-amount"
            type="number"
            min="0.01"
            max={available}
            step="any"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={disabled || !selected}
          />
        </Field>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={
            disabled ||
            !row ||
            Number(amount) <= 0 ||
            Number(amount) > available
          }
        >
          <Plus />
          {t("apply")}
        </Button>
      </div>
      {query.isError && (
        <p role="alert" className="text-destructive text-xs">
          {t("referencesLoadError")}
        </p>
      )}
      {references.map((reference) => (
        <div
          key={reference.ref_ar_invoice_id}
          className="flex min-w-0 items-center gap-3 border-b py-2 text-xs"
        >
          <span className="min-w-0 flex-1 truncate">
            {query.data?.data.find(
              (row) => row.id === reference.ref_ar_invoice_id,
            )?.doc_no || reference.ref_ar_invoice_id}
          </span>
          <span className="text-destructive tabular-nums">
            −{money(Number(reference.applied_amount))} {currency}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("removeReference")}
            disabled={disabled}
            onClick={() =>
              change(
                references.filter(
                  (item) =>
                    item.ref_ar_invoice_id !== reference.ref_ar_invoice_id,
                ),
              )
            }
          >
            <Trash2 />
          </Button>
        </div>
      ))}
    </div>
  );
}
