import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "use-intl";
import { LookupChartOfAccount } from "@/components/lookup/lookup-chart-of-account";
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
import {
  Field,
  FieldDatePicker,
  FieldInput,
  FieldLabel,
  FieldSelect,
} from "@/components/ui/field";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { ErrorState } from "@/components/ui/error-state";
import SearchInput from "@/components/search-input";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { useChartOfAccountById } from "@/hooks/use-chart-of-account";
import { formatDate, isoToDateInput } from "@/lib/date-utils";
import { ApDetailGrid } from "../accounts-payable/shared/ap-detail-grid";
import {
  allocationFromInvoice,
  RECEIPT_PAY_TYPES,
  type ArReceipt,
  type ReceiptAllocation,
  type ReceiptPayment,
} from "./ar-receipt-model";
import { useArRegister, useArRegisterDocument } from "./use-ar-register";

export function ReceiptPaymentDialog({
  payment,
  currency,
  close,
  save,
}: {
  readonly payment: ReceiptPayment;
  readonly currency: string;
  readonly close: () => void;
  readonly save: (payment: ReceiptPayment) => void;
}) {
  const t = useTranslations("accounting.arReceipt");
  const tc = useTranslations("common");
  const [row, setRow] = useState(payment);
  const selectedAccount = useChartOfAccountById(row.accountId || undefined);
  const [error, setError] = useState("");
  const change = <K extends keyof ReceiptPayment>(
    key: K,
    value: ReceiptPayment[K],
  ) => setRow((previous) => ({ ...previous, [key]: value }));
  function submit(event: FormEvent) {
    event.preventDefault();
    if (
      !Number.isFinite(row.amount) ||
      row.amount <= 0 ||
      !row.date ||
      (row.type === "cheque" && (!row.chequeNo.trim() || !row.chequeDate)) ||
      (row.type === "credit_card" &&
        row.cardLast4 &&
        !/^\d{4}$/.test(row.cardLast4))
    ) {
      setError(t("paymentInvalid"));
      return;
    }
    save(row);
  }
  const bankFields = row.type === "bank_transfer" || row.type === "cheque";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="@container/payment max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("paymentDetail")}</DialogTitle>
          <DialogDescription>{t("paymentDetailHint")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 @md/payment:grid-cols-2">
            <Field>
              <FieldLabel>{t("payType")}</FieldLabel>
              <FieldSelect
                value={row.type}
                onValueChange={(value) =>
                  change("type", value as ReceiptPayment["type"])
                }
              >
                <SelectContent>
                  {RECEIPT_PAY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`payTypes.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </FieldSelect>
            </Field>
            <Field>
              <FieldLabel required>{t("paymentDate")}</FieldLabel>
              <FieldDatePicker
                className="w-full"
                value={row.date}
                onValueChange={(value) => change("date", isoToDateInput(value))}
                hideClear
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="receipt-payment-amount" required>
                {t("receivedAmount")} ({currency})
              </FieldLabel>
              <FieldInput
                id="receipt-payment-amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={row.amount || ""}
                onChange={(event) =>
                  change("amount", Number(event.target.value))
                }
                className="text-right tabular-nums"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="receipt-payment-reference">
                {t("reference")}
              </FieldLabel>
              <FieldInput
                id="receipt-payment-reference"
                value={row.reference}
                maxLength={100}
                onChange={(event) => change("reference", event.target.value)}
              />
            </Field>
            {bankFields && (
              <>
                <Field>
                  <FieldLabel htmlFor="receipt-bank">{t("bank")}</FieldLabel>
                  <FieldInput
                    id="receipt-bank"
                    value={row.bank}
                    maxLength={150}
                    onChange={(event) => change("bank", event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="receipt-bank-branch">
                    {t("bankBranch")}
                  </FieldLabel>
                  <FieldInput
                    id="receipt-bank-branch"
                    value={row.branch}
                    maxLength={150}
                    onChange={(event) => change("branch", event.target.value)}
                  />
                </Field>
                <Field className="@md/payment:col-span-2">
                  <FieldLabel htmlFor="receipt-bank-account">
                    {t("bankAccount")}
                  </FieldLabel>
                  <FieldInput
                    id="receipt-bank-account"
                    value={row.bankAccount}
                    maxLength={100}
                    onChange={(event) =>
                      change("bankAccount", event.target.value)
                    }
                  />
                </Field>
              </>
            )}
            {row.type === "cheque" && (
              <>
                <Field>
                  <FieldLabel htmlFor="receipt-cheque-no" required>
                    {t("chequeNo")}
                  </FieldLabel>
                  <FieldInput
                    id="receipt-cheque-no"
                    value={row.chequeNo}
                    maxLength={50}
                    required
                    onChange={(event) => change("chequeNo", event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel required>{t("chequeDate")}</FieldLabel>
                  <FieldDatePicker
                    className="w-full"
                    value={row.chequeDate}
                    onValueChange={(value) =>
                      change("chequeDate", isoToDateInput(value))
                    }
                    hideClear
                  />
                </Field>
              </>
            )}
            {row.type === "credit_card" && (
              <Field>
                <FieldLabel htmlFor="receipt-card-last4">
                  {t("cardLast4")}
                </FieldLabel>
                <FieldInput
                  id="receipt-card-last4"
                  value={row.cardLast4}
                  maxLength={4}
                  hideCounter
                  inputMode="numeric"
                  onChange={(event) => change("cardLast4", event.target.value)}
                />
              </Field>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 border-t pt-4 @md/payment:grid-cols-2">
            <Field className="min-w-0">
              <FieldLabel>{t("cashBankAccount")}</FieldLabel>
              <LookupChartOfAccount
                value={selectedAccount.data?.code ?? ""}
                selectedItems={
                  selectedAccount.data ? [selectedAccount.data] : undefined
                }
                demoFallback={false}
                onValueChange={(_code, account) =>
                  setRow((previous) => ({
                    ...previous,
                    accountId: account?.id ?? "",
                    accountLabel: account
                      ? `${account.code} · ${account.description_1}`
                      : "",
                  }))
                }
                className="w-full"
              />
            </Field>
            <Field className="min-w-0">
              <FieldLabel>{t("costCenter")}</FieldLabel>
              <LookupCostCenter
                value={row.costCenterId}
                onValueChange={(value) => change("costCenterId", value ?? "")}
                modal
              />
            </Field>
          </div>
          {error && (
            <p role="alert" className="text-destructive text-xs">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              {tc("cancel")}
            </Button>
            <Button type="submit">{tc("save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReceiptInvoiceDialog({
  receipt,
  close,
  add,
}: {
  readonly receipt: ArReceipt;
  readonly close: () => void;
  readonly add: (allocation: ReceiptAllocation) => void;
}) {
  const t = useTranslations("accounting.arReceipt");
  const tc = useTranslations("common");
  const money = useAmountFormatter();
  const { dateFormat } = useProfile();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string>();
  const selectedInvoice = useArRegisterDocument(selected);
  const query = useArRegister({
    search,
    page,
    perpage: 20,
    sort: "doc_date:desc",
    filter: `customer_id|string:${receipt.customerId},doc_status|string:posted`,
  });
  useEffect(() => {
    const invoice = selectedInvoice.data;
    if (
      invoice &&
      invoice.id === selected &&
      invoice.customer_id === receipt.customerId &&
      invoice.currency_code === receipt.currency &&
      invoice.doc_status === "posted" &&
      Number(invoice.outstanding_amount) > 0
    ) {
      add(allocationFromInvoice(invoice, receipt.customerId));
    }
  }, [
    selectedInvoice.data,
    selected,
    receipt.customerId,
    receipt.currency,
    add,
  ]);
  const rows = (query.data?.data ?? []).filter(
    (row) =>
      row.currency_code === receipt.currency &&
      row.customer_code === receipt.customerCode &&
      Number(row.outstanding_amount) > 0 &&
      ["invoice", "debit_note"].includes(row.doc_type) &&
      !receipt.allocations.some((allocation) => allocation.id === row.id),
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("selectInvoices")}</DialogTitle>
          <DialogDescription>
            {t("invoicePickerHint", {
              customer: receipt.customerName,
              currency: receipt.currency,
            })}
          </DialogDescription>
        </DialogHeader>
        <SearchInput
          defaultValue={search}
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        {selectedInvoice.isError && (
          <ErrorState
            error={selectedInvoice.error}
            onRetry={() => void selectedInvoice.refetch()}
          />
        )}
        {query.isError ? (
          <ErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <ApDetailGrid
            rows={rows}
            empty={query.isLoading ? tc("loading") : t("noEligibleInvoices")}
            columns={[
              { accessorKey: "doc_no", header: t("invoiceNo") },
              {
                accessorKey: "doc_date",
                header: t("date"),
                cell: ({ row }) =>
                  formatDate(row.original.doc_date, dateFormat),
              },
              {
                accessorKey: "due_date",
                header: t("dueDate"),
                cell: ({ row }) =>
                  formatDate(row.original.due_date, dateFormat),
              },
              {
                accessorKey: "outstanding_amount",
                header: t("outstanding"),
                meta: { cellClassName: "text-right tabular-nums" },
                cell: ({ row }) =>
                  money(Number(row.original.outstanding_amount)),
              },
              {
                id: "select",
                cell: ({ row }) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={selectedInvoice.isFetching}
                    onClick={() => setSelected(row.original.id)}
                  >
                    {tc("select")}
                  </Button>
                ),
              },
            ]}
          />
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={page === 1 || query.isFetching}
            onClick={() => setPage((value) => value - 1)}
          >
            {tc("previous")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={
              page >= (query.data?.paginate.pages ?? 1) || query.isFetching
            }
            onClick={() => setPage((value) => value + 1)}
          >
            {tc("next")}
          </Button>
          <Button type="button" variant="outline" onClick={close}>
            {tc("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
