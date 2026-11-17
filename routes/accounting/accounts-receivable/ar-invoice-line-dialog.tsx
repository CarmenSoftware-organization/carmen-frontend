import { DimensionValueInput } from "@/components/dimension/dimension-value-input";
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { LookupChartOfAccountById } from "@/components/lookup/lookup-chart-of-account-by-id";
import { LookupCostCenter } from "@/components/lookup/lookup-cost-center";
import { LookupUnit } from "@/components/lookup/lookup-unit";
import { LookupTaxProfile } from "@/components/lookup/lookup-tax-profile";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import { useBuCode } from "@/hooks/use-bu-code";
import { useChartOfAccountById } from "@/hooks/use-chart-of-account";
import {
  useGlDimensions,
  useGlDimensionValues,
} from "@/hooks/use-gl-dimensions";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { coaRulesKey, readCoaRules } from "@/lib/coa-dimension-rules";
import { isoToDateInput } from "@/lib/date-utils";
import {
  CHART_OF_ACCOUNT_TYPE,
  type ChartOfAccount,
} from "@/types/chart-of-accounts";
import { visibleLineDimensions } from "../documents/journal-line-dimensions";
import { arLineAmounts, type ArDraftLine } from "./ar-invoice-draft-model";

const GRID = "grid min-w-0 gap-x-4 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-3";

export function ArInvoiceLineDialog({
  line,
  isNew,
  close,
  save,
}: {
  readonly line: ArDraftLine;
  readonly isNew: boolean;
  readonly close: () => void;
  readonly save: (line: ArDraftLine) => void;
}) {
  const t = useTranslations("accounting.arRegister");
  const tc = useTranslations("common");
  const money = useAmountFormatter();
  const [draft, setDraft] = useState(line);
  const [error, setError] = useState("");
  const { data: creditAccount } = useChartOfAccountById(
    draft.cr_chart_of_accounts_id || undefined,
  );
  const { data: debitAccount } = useChartOfAccountById(
    draft.dr_chart_of_accounts_id || undefined,
  );
  const set = (patch: Partial<ArDraftLine>) =>
    setDraft((previous) => ({ ...previous, ...patch }));
  const amounts = arLineAmounts(draft);
  const numberField = (
    key: "quantity" | "unit_price" | "discount_pct",
    label: string,
    max?: number,
  ) => (
    <Field>
      <FieldLabel htmlFor={`ar-line-${key}`} required={key !== "discount_pct"}>
        {label}
      </FieldLabel>
      <FieldInput
        id={`ar-line-${key}`}
        type="number"
        step="any"
        min={key === "quantity" ? "0.0001" : 0}
        max={max}
        value={draft[key] ?? ""}
        onChange={(event) => set({ [key]: event.target.value })}
        required={key !== "discount_pct"}
      />
    </Field>
  );
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.cr_chart_of_accounts_id || !draft.cr_cost_center_id) {
      setError(t("revenueRequired"));
      return;
    }
    if (
      [creditAccount, debitAccount].some(
        (account) =>
          account &&
          [
            CHART_OF_ACCOUNT_TYPE.HEADER,
            CHART_OF_ACCOUNT_TYPE.SUMMARY,
          ].includes(account.type),
      )
    ) {
      setError(t("accountNotPostable"));
      return;
    }
    if (
      !Number.isFinite(amounts.total) ||
      Number(draft.quantity) <= 0 ||
      Number(draft.unit_price) < 0 ||
      amounts.discount < 0 ||
      amounts.discount > amounts.subtotal ||
      amounts.vat < 0 ||
      amounts.tax2 < 0
    ) {
      setError(t("invalidAmounts"));
      return;
    }
    if (draft.date_from && draft.date_to && draft.date_from > draft.date_to) {
      setError(t("invalidDateRange"));
      return;
    }
    save({
      ...draft,
      description: draft.description?.trim() || null,
      cr_account_code: creditAccount?.code ?? draft.cr_account_code,
      dr_account_code: debitAccount?.code ?? draft.dr_account_code,
      discount_amount: amounts.discount,
      vat_amount: amounts.vat,
      tax2_amount: amounts.tax2,
    });
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>
            {t(isNew ? "addLine" : "editLine")} · {draft.sequence_no}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="@container space-y-4">
          <LineSection title={t("bookingReference")}>
            <div className={GRID}>
              <Field className="@md:col-span-2">
                <FieldLabel htmlFor="ar-line-description">
                  {t("memo")}
                </FieldLabel>
                <FieldInput
                  id="ar-line-description"
                  value={draft.description ?? ""}
                  onChange={(event) => set({ description: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ar-line-group">{t("groupNo")}</FieldLabel>
                <FieldInput
                  id="ar-line-group"
                  type="number"
                  min={1}
                  step={1}
                  value={draft.group_no ?? 1}
                  onChange={(event) =>
                    set({ group_no: Number(event.target.value) })
                  }
                />
              </Field>
              <Field className="@md:col-span-2">
                <FieldLabel htmlFor="ar-line-reference">
                  {t("referenceInfo")}
                </FieldLabel>
                <Textarea
                  id="ar-line-reference"
                  rows={2}
                  value={draft.reference_info ?? ""}
                  onChange={(event) =>
                    set({ reference_info: event.target.value })
                  }
                />
              </Field>
              <div className="grid gap-3">
                <Field>
                  <FieldLabel htmlFor="ar-line-from">
                    {t("dateFrom")}
                  </FieldLabel>
                  <FieldInput
                    id="ar-line-from"
                    type="date"
                    value={isoToDateInput(draft.date_from ?? "")}
                    onChange={(event) =>
                      set({ date_from: event.target.value || null })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ar-line-to">{t("dateTo")}</FieldLabel>
                  <FieldInput
                    id="ar-line-to"
                    type="date"
                    value={isoToDateInput(draft.date_to ?? "")}
                    onChange={(event) =>
                      set({ date_to: event.target.value || null })
                    }
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel>{t("unit")}</FieldLabel>
                <LookupUnit
                  value={draft.unit_id ?? ""}
                  defaultLabel={draft.unit_name ?? undefined}
                  onValueChange={(id) =>
                    set({ unit_id: id || null, unit_name: null })
                  }
                  onItemChange={(unit) => set({ unit_name: unit.name })}
                />
              </Field>
              {numberField("quantity", t("quantity"))}
              {numberField("unit_price", t("unitPrice"))}
            </div>
          </LineSection>
          <LineSection title={t("discount")}>
            <div className={GRID}>
              <Field>
                <FieldLabel>{t("subtotal")}</FieldLabel>
                <FieldPlainText>{money(amounts.subtotal)}</FieldPlainText>
              </Field>
              {numberField("discount_pct", t("discountPercent"), 100)}
              <OverrideAmount
                id="ar-line-discount"
                label={t("discountAmount")}
                checked={!!draft.discount_is_override}
                amount={amounts.discount}
                inputValue={draft.discount_amount ?? ""}
                changeOverride={(checked) =>
                  set({
                    discount_is_override: checked,
                    discount_amount: amounts.discount,
                  })
                }
                changeAmount={(value) => set({ discount_amount: value })}
              />
            </div>
          </LineSection>
          <LineSection title={t("revenue")}>
            <div className={GRID}>
              <Field>
                <FieldLabel required>{t("revenueAccount")}</FieldLabel>
                <LookupChartOfAccountById
                  value={draft.cr_chart_of_accounts_id}
                  onValueChange={(id) => {
                    if ((id ?? "") !== draft.cr_chart_of_accounts_id)
                      set({
                        cr_chart_of_accounts_id: id ?? "",
                        cr_account_code: null,
                        dimensions: [],
                      });
                  }}
                  placeholder={t("revenueAccount")}
                />
              </Field>
              <Field role="group" aria-labelledby="ar-line-revenue-center">
                <FieldLabel id="ar-line-revenue-center" required>
                  {t("revenueCostCenter")}
                </FieldLabel>
                <LookupCostCenter
                  value={draft.cr_cost_center_id}
                  onValueChange={(id, item) =>
                    set({
                      cr_cost_center_id: id ?? "",
                      cr_cost_center_code: item?.code,
                    })
                  }
                  modal
                />
              </Field>
              <Field>
                <FieldLabel>{t("net")}</FieldLabel>
                <FieldPlainText>{money(amounts.net)}</FieldPlainText>
              </Field>
              {draft.cr_chart_of_accounts_id && (
                <ArLineDimensions
                  line={draft}
                  account={creditAccount}
                  change={(dimensions) => set({ dimensions })}
                />
              )}
            </div>
          </LineSection>
          <LineSection title={t("outputTax")}>
            <div className="grid gap-4 @3xl:grid-cols-2">
              {(["vat", "tax2"] as const).map((tax) => (
                <div key={tax} className="min-w-0 space-y-3">
                  <Field>
                    <FieldLabel>
                      {t(tax === "vat" ? "tax1Profile" : "tax2Profile")}
                    </FieldLabel>
                    <div className="flex min-w-0 gap-2">
                      <div className="min-w-0 flex-1">
                        <LookupTaxProfile
                          value={draft[`${tax}_tax_profile_id`] ?? ""}
                          onValueChange={(id, rate, name) =>
                            set({
                              [`${tax}_tax_profile_id`]: id,
                              [`${tax}_rate`]: rate,
                              [`${tax}_profile_name`]: name,
                            })
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          set({
                            [`${tax}_tax_profile_id`]: null,
                            [`${tax}_rate`]: 0,
                            [`${tax}_amount`]: 0,
                            [`${tax}_is_override`]: false,
                          })
                        }
                      >
                        {t("noTax")}
                      </Button>
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel>{t("taxAccount")}</FieldLabel>
                    <LookupChartOfAccountById
                      value={draft[`${tax}_chart_of_accounts_id`] ?? null}
                      onValueChange={(id) =>
                        set({ [`${tax}_chart_of_accounts_id`]: id })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("taxCostCenter")}</FieldLabel>
                    <LookupCostCenter
                      value={draft[`${tax}_cost_center_id`] ?? null}
                      onValueChange={(id) =>
                        set({ [`${tax}_cost_center_id`]: id })
                      }
                      modal
                    />
                  </Field>
                  <OverrideAmount
                    id={`ar-line-${tax}`}
                    label={t(tax === "vat" ? "tax1Amount" : "tax2Amount")}
                    checked={!!draft[`${tax}_is_override`]}
                    amount={amounts[tax]}
                    inputValue={draft[`${tax}_amount`] ?? ""}
                    changeOverride={(checked) =>
                      set({
                        [`${tax}_is_override`]: checked,
                        [`${tax}_amount`]: amounts[tax],
                      })
                    }
                    changeAmount={(value) => set({ [`${tax}_amount`]: value })}
                  />
                </div>
              ))}
            </div>
          </LineSection>
          <LineSection title={t("receivable")}>
            <div className={GRID}>
              <Field>
                <FieldLabel>{t("arAccount")}</FieldLabel>
                <LookupChartOfAccountById
                  value={draft.dr_chart_of_accounts_id ?? null}
                  onValueChange={(id) =>
                    set({ dr_chart_of_accounts_id: id, dr_account_code: null })
                  }
                  placeholder={t("defaultArAccount")}
                />
              </Field>
              <Field role="group" aria-labelledby="ar-line-receivable-center">
                <FieldLabel id="ar-line-receivable-center">
                  {t("arCostCenter")}
                </FieldLabel>
                <LookupCostCenter
                  value={draft.dr_cost_center_id ?? null}
                  onValueChange={(id) => set({ dr_cost_center_id: id })}
                  modal
                />
              </Field>
              <Field>
                <FieldLabel>{t("total")}</FieldLabel>
                <FieldPlainText className="font-semibold">
                  {money(amounts.total)}
                </FieldPlainText>
              </Field>
            </div>
          </LineSection>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              {tc("cancel")}
            </Button>
            <Button type="submit">{isNew ? tc("add") : tc("save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LineSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function OverrideAmount({
  id,
  label,
  checked,
  amount,
  inputValue,
  changeOverride,
  changeAmount,
}: {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
  readonly amount: number;
  readonly inputValue: string | number;
  readonly changeOverride: (value: boolean) => void;
  readonly changeAmount: (value: string) => void;
}) {
  const t = useTranslations("accounting.arRegister");
  return (
    <Field>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <label className="flex items-center gap-1.5 text-xs">
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => changeOverride(value === true)}
          />
          {t("override")}
        </label>
      </div>
      <FieldInput
        id={id}
        type="number"
        step="any"
        min={0}
        value={checked ? inputValue : amount}
        readOnly={!checked}
        onChange={(event) => changeAmount(event.target.value)}
      />
    </Field>
  );
}

function ArLineDimensions({
  line,
  account,
  change,
}: {
  readonly line: ArDraftLine;
  readonly account?: ChartOfAccount;
  readonly change: (values: NonNullable<ArDraftLine["dimensions"]>) => void;
}) {
  const t = useTranslations("accounting.arRegister");
  const bu = useBuCode();
  const id = line.cr_chart_of_accounts_id;
  const rules = useQuery({
    queryKey: coaRulesKey(bu, id),
    queryFn: () => readCoaRules(bu!, id),
    enabled: !!bu,
  });
  const selected = line.dimensions ?? [];
  const hasDimensions = Boolean(
    rules.data?.length ||
    account?.allowed_dimensions?.length ||
    selected.length,
  );
  const dimensions = useGlDimensions(hasDimensions);
  const values = useGlDimensionValues(hasDimensions);
  const visible = visibleLineDimensions(
    dimensions.data ?? [],
    account,
    rules.data ?? [],
    selected,
  );

  if (
    rules.isError ||
    (hasDimensions && (dimensions.isError || values.isError))
  ) {
    return (
      <p role="status" className="text-destructive text-xs @md:col-span-2">
        {t("dimensionsLoadError")}
      </p>
    );
  }
  return visible.map((dimension) => {
    const labelId = `ar-line-dimension-${dimension.id}`;
    return (
      <Field key={dimension.id}>
        <FieldLabel
          id={labelId}
          required={rules.data?.some(
            (rule) =>
              rule.dimension_id === dimension.id &&
              rule.requirement === "mandatory",
          )}
        >
          {dimension.name}
        </FieldLabel>
        <DimensionValueInput
          dimension={dimension}
          value={selected.find((item) => item.dimension_id === dimension.id)}
          disabled={values.isPending}
          onChange={(next) =>
            change([
              ...selected.filter((item) => item.dimension_id !== dimension.id),
              ...(next ? [next] : []),
            ])
          }
        />
      </Field>
    );
  });
}
