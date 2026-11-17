import {
  invoiceMockDepositSchema,
  type InvoiceTaxEntity,
  type InvoiceMockDeposit,
} from "./ar-invoice-supplement-model";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldInput,
  FieldLabel,
  FieldPlainText,
} from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAmountFormatter } from "@/hooks/use-number-formatter";

export function InvoiceTaxEntityFields({
  value,
  change,
  required = false,
}: {
  readonly value: InvoiceTaxEntity;
  readonly required?: boolean;
  readonly change?: (value: InvoiceTaxEntity) => void;
}) {
  const t = useTranslations("accounting.arRegister");
  return (
    <div className="@container space-y-3">
      {change && (
        <p className="text-muted-foreground text-xs">{t("taxEntityMock")}</p>
      )}
      <div className="grid min-w-0 gap-x-4 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4">
        {(
          [
            "registeredName",
            "taxId",
            "branchNo",
            "address1",
            "address2",
            "province",
            "postalCode",
          ] as const
        ).map((field) => (
          <Field
            key={field}
            className={
              field === "registeredName" ||
              field === "address1" ||
              field === "address2"
                ? "@md:col-span-2"
                : ""
            }
          >
            <FieldLabel
              htmlFor={`invoice-tax-${field}`}
              required={required && field !== "address2"}
            >
              {t(field)}
            </FieldLabel>
            {change ? (
              <FieldInput
                id={`invoice-tax-${field}`}
                required={required && field !== "address2"}
                value={value[field]}
                maxLength={
                  field === "taxId"
                    ? 13
                    : field === "branchNo" || field === "postalCode"
                      ? 5
                      : 255
                }
                onChange={(event) =>
                  change({ ...value, [field]: event.target.value })
                }
              />
            ) : (
              <FieldPlainText>{value[field] || "—"}</FieldPlainText>
            )}
          </Field>
        ))}
      </div>
    </div>
  );
}
export function InvoiceMockDeposits({
  rows,
  change,
  rate,
  currency,
  maxAmount,
  disabled,
}: {
  readonly rows: InvoiceMockDeposit[];
  readonly change?: (rows: InvoiceMockDeposit[]) => void;
  readonly rate: number;
  readonly currency: string;
  readonly maxAmount: number;
  readonly disabled?: boolean;
}) {
  const t = useTranslations("accounting.arRegister");
  const tc = useTranslations("common");
  const money = useAmountFormatter();
  const [draft, setDraft] = useState<InvoiceMockDeposit | null>(null);
  return (
    <section className="space-y-3 border-t pt-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {t("applyDeposit")}{" "}
          <span className="text-muted-foreground text-xs font-normal">
            {t("mock")}
          </span>
        </h3>
        {change && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || maxAmount <= 0}
            onClick={() =>
              setDraft({
                id: crypto.randomUUID(),
                number: "",
                date: new Date().toISOString().slice(0, 10),
                rate,
                available: 0,
                amount: 0,
              })
            }
          >
            <Plus />
            {t("applyDeposit")}
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        {t("depositMockDescription")}
      </p>
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap items-center gap-3 border-b py-2 text-xs"
        >
          <span className="min-w-0 flex-1">
            {row.number} · {row.date}
          </span>
          <span className="text-destructive tabular-nums">
            −{money(row.amount)} {currency}
          </span>
          <span>
            {t("realizedFx")}: {money(row.amount * (rate - row.rate))}
          </span>
          {change && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("removeReference")}
              disabled={disabled}
              onClick={() => change(rows.filter((item) => item.id !== row.id))}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      ))}
      {draft && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setDraft(null);
          }}
        >
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>
                {t("applyDeposit")} · {t("mock")}
              </DialogTitle>
            </DialogHeader>
            <div className="@container grid gap-3 @md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="mock-deposit-no" required>
                  {t("number")}
                </FieldLabel>
                <FieldInput
                  id="mock-deposit-no"
                  value={draft.number}
                  onChange={(event) =>
                    setDraft({ ...draft, number: event.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="mock-deposit-date">{t("date")}</FieldLabel>
                <FieldInput
                  id="mock-deposit-date"
                  type="date"
                  value={draft.date}
                  onChange={(event) =>
                    setDraft({ ...draft, date: event.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel>{t("currency")}</FieldLabel>
                <FieldPlainText>{currency}</FieldPlainText>
              </Field>
              {(["available", "amount", "rate"] as const).map((field) => (
                <Field key={field}>
                  <FieldLabel htmlFor={`mock-deposit-${field}`} required>
                    {t(
                      field === "available"
                        ? "availableAmount"
                        : field === "amount"
                          ? "applied"
                          : "exchangeRate",
                    )}
                  </FieldLabel>
                  <FieldInput
                    id={`mock-deposit-${field}`}
                    type="number"
                    min="0.00001"
                    step="any"
                    value={draft[field]}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        [field]: Number(event.target.value),
                      })
                    }
                  />
                </Field>
              ))}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDraft(null)}
              >
                {tc("cancel")}
              </Button>
              <Button
                type="button"
                disabled={
                  !invoiceMockDepositSchema.safeParse(draft).success ||
                  draft.amount > maxAmount
                }
                onClick={() => {
                  if (change) {
                    change([...rows, draft]);
                    setDraft(null);
                  }
                }}
              >
                {t("apply")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
