import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { LookupChartOfAccountById } from "@/components/lookup/lookup-chart-of-account-by-id";
import { LookupCostCenter } from "@/components/lookup/lookup-cost-center";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBuCode } from "@/hooks/use-bu-code";
import { useChartOfAccountById } from "@/hooks/use-chart-of-account";
import {
  useGlDimensions,
  useGlDimensionValues,
} from "@/hooks/use-gl-dimensions";
import { coaRulesKey, readCoaRules } from "@/lib/coa-dimension-rules";
import {
  CHART_OF_ACCOUNT_TYPE,
  type ChartOfAccount,
} from "@/types/chart-of-accounts";
import { visibleLineDimensions } from "../documents/journal-line-dimensions";
import type { ArDraftLine } from "./ar-invoice-draft-model";

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
    const fields = new FormData(event.currentTarget);
    const quantity = String(fields.get("quantity") ?? "").replace(/^\./, "0.");
    const unitPrice = String(fields.get("unitPrice") ?? "").replace(
      /^\./,
      "0.",
    );
    const decimal = /^\d+(\.\d+)?$/;
    if (
      !decimal.test(quantity) ||
      !decimal.test(unitPrice) ||
      Number(quantity) <= 0
    ) {
      setError(t("invalidAmounts"));
      return;
    }
    save({
      ...draft,
      description: String(fields.get("description") ?? "").trim() || null,
      quantity,
      unit_price: unitPrice,
      cr_account_code: creditAccount?.code ?? draft.cr_account_code,
      dr_account_code: debitAccount?.code ?? draft.dr_account_code,
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t(isNew ? "addLine" : "editLine")}</DialogTitle>
          <DialogDescription>
            {t("lineNumber", { number: draft.sequence_no })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="ar-line-description">{t("memo")}</FieldLabel>
              <FieldInput
                id="ar-line-description"
                name="description"
                defaultValue={draft.description ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ar-line-quantity" required>
                {t("quantity")}
              </FieldLabel>
              <FieldInput
                id="ar-line-quantity"
                name="quantity"
                type="number"
                step="any"
                min={0}
                defaultValue={draft.quantity}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ar-line-price" required>
                {t("unitPrice")}
              </FieldLabel>
              <FieldInput
                id="ar-line-price"
                name="unitPrice"
                type="number"
                step="any"
                min={0}
                defaultValue={draft.unit_price}
                required
              />
            </Field>
            <Field>
              <FieldLabel required>{t("revenueAccount")}</FieldLabel>
              <LookupChartOfAccountById
                value={draft.cr_chart_of_accounts_id}
                onValueChange={(id) => {
                  if ((id ?? "") === draft.cr_chart_of_accounts_id) return;
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
                onValueChange={(id) => set({ cr_cost_center_id: id ?? "" })}
                modal
              />
            </Field>
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
            {draft.cr_chart_of_accounts_id && (
              <ArLineDimensions
                line={draft}
                account={creditAccount}
                change={(dimensions) => set({ dimensions })}
              />
            )}
          </div>
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
  const tc = useTranslations("common");
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
    selected.map((item) => ({
      dimension_id: item.gl_dimension_id,
      dimension_value_id: item.gl_dimension_value_id,
    })),
  );

  if (
    rules.isError ||
    (hasDimensions && (dimensions.isError || values.isError))
  ) {
    return (
      <p role="status" className="text-destructive text-xs sm:col-span-2">
        {t("dimensionsLoadError")}
      </p>
    );
  }
  return visible.map((dimension) => {
    const current = selected.find(
      (item) => item.gl_dimension_id === dimension.id,
    )?.gl_dimension_value_id;
    const options = (values.data ?? []).filter(
      (value) =>
        value.dimension_id === dimension.id &&
        (value.is_active || value.id === current),
    );
    const labelId = `ar-line-dimension-${dimension.id}`;
    return (
      <Field key={dimension.id}>
        <FieldLabel
          htmlFor={labelId}
          required={rules.data?.some(
            (rule) =>
              rule.gl_dimension_id === dimension.id &&
              rule.requirement === "mandatory",
          )}
        >
          {dimension.name}
        </FieldLabel>
        <Select
          value={current ?? "none"}
          onValueChange={(id) =>
            change([
              ...selected.filter(
                (item) => item.gl_dimension_id !== dimension.id,
              ),
              ...(id === "none"
                ? []
                : [
                    {
                      gl_dimension_id: dimension.id,
                      gl_dimension_value_id: id,
                    },
                  ]),
            ])
          }
        >
          <SelectTrigger
            id={labelId}
            className="w-full"
            disabled={values.isPending}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{tc("select")}</SelectItem>
            {options.map((value) => (
              <SelectItem key={value.id} value={value.id}>
                {value.code} · {value.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    );
  });
}
