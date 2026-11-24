import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { FieldInput } from "@/components/ui/field";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { round2 } from "@/lib/currency-utils";
import { formatDate } from "@/lib/date-utils";
import { ApDetailGrid } from "../accounts-payable/shared/ap-detail-grid";
import {
  allocationFromOutstanding,
  type ReceiptAllocation,
} from "./ar-receipt-model";
import {
  useArOutstandingInvoices,
  type OutstandingInvoice,
} from "./use-ar-receipt";

/**
 * Picks posted invoices that still have an unreserved balance, from the
 * backend outstanding-invoices lookup (caps already exclude other receipts'
 * reservations). Returns allocations; amount defaults to the available balance.
 */
export function ReceiptInvoiceDialog({
  customerId,
  customerName,
  currency,
  currencyId,
  receiptId,
  selectedIds,
  close,
  onAdd,
}: {
  readonly customerId: string;
  readonly customerName?: string;
  readonly currency: string;
  readonly currencyId?: string;
  /** receipt being edited: its own reservations are not counted */
  readonly receiptId?: string;
  readonly selectedIds: readonly string[];
  readonly close: () => void;
  readonly onAdd: (allocations: ReceiptAllocation[]) => void;
}) {
  const t = useTranslations("accounting.arReceipt");
  const tc = useTranslations("common");
  const money = useAmountFormatter();
  const { dateFormat } = useProfile();
  const query = useArOutstandingInvoices(
    customerId,
    currencyId || undefined,
    receiptId,
  );
  const [picked, setPicked] = useState<Record<string, number>>({});
  const rows = useMemo(
    () =>
      (query.data ?? []).filter(
        (row) =>
          row.currency_code === currency &&
          Number(row.available_amount) > 0 &&
          !selectedIds.includes(row.ar_invoice_id),
      ),
    [query.data, currency, selectedIds],
  );
  const pickedRows = rows.filter((row) => row.ar_invoice_id in picked);
  const valid = pickedRows.every((row) => {
    const amount = picked[row.ar_invoice_id];
    return (
      Number.isFinite(amount) &&
      amount > 0 &&
      amount <= Number(row.available_amount)
    );
  });
  const toggle = (row: OutstandingInvoice, checked: boolean) =>
    setPicked((previous) => {
      const next = { ...previous };
      if (checked) next[row.ar_invoice_id] = Number(row.available_amount);
      else delete next[row.ar_invoice_id];
      return next;
    });
  const columns = useMemo(
    () => [
      {
        id: "pick",
        header: "",
        cell: ({ row }: { row: { original: OutstandingInvoice } }) => (
          <Checkbox
            aria-label={row.original.doc_no}
            checked={row.original.ar_invoice_id in picked}
            onCheckedChange={(checked) => toggle(row.original, checked === true)}
          />
        ),
      },
      { accessorKey: "doc_no", header: t("invoiceNo") },
      {
        id: "doc_type",
        header: t("invoiceType"),
        cell: ({ row }: { row: { original: OutstandingInvoice } }) =>
          t(`invoiceTypes.${row.original.doc_type}`),
      },
      {
        id: "doc_date",
        header: t("date"),
        cell: ({ row }: { row: { original: OutstandingInvoice } }) =>
          formatDate(row.original.doc_date, dateFormat),
      },
      {
        id: "outstanding",
        header: t("outstanding"),
        meta: { cellClassName: "text-right tabular-nums" },
        cell: ({ row }: { row: { original: OutstandingInvoice } }) =>
          money(Number(row.original.outstanding_amount)),
      },
      {
        id: "available",
        header: t("availableAmount"),
        meta: { cellClassName: "text-right tabular-nums" },
        cell: ({ row }: { row: { original: OutstandingInvoice } }) =>
          money(Number(row.original.available_amount)),
      },
      {
        id: "applied",
        header: t("appliedAmount"),
        meta: { cellClassName: "text-right" },
        cell: ({ row }: { row: { original: OutstandingInvoice } }) => {
          const id = row.original.ar_invoice_id;
          if (!(id in picked)) return null;
          const available = Number(row.original.available_amount);
          return (
            <FieldInput
              type="number"
              min="0.01"
              max={available}
              step="0.01"
              aria-label={`${t("appliedAmount")} ${row.original.doc_no}`}
              value={picked[id] || ""}
              aria-invalid={!(picked[id] > 0 && picked[id] <= available)}
              onChange={(event) =>
                setPicked((previous) => ({
                  ...previous,
                  [id]: round2(Number(event.target.value)),
                }))
              }
              className="w-32 text-right tabular-nums"
            />
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toggle only touches setPicked
    [picked, t, money, dateFormat],
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
              customer: customerName ?? "",
              currency,
            })}
          </DialogDescription>
        </DialogHeader>
        {query.isError ? (
          <ErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <ApDetailGrid
            rows={rows}
            columns={columns}
            empty={query.isLoading ? tc("loading") : t("noEligibleInvoices")}
          />
        )}
        {!valid && (
          <p role="alert" className="text-destructive text-xs">
            {t("allocationExceedsOutstanding")}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {tc("close")}
          </Button>
          <Button
            type="button"
            disabled={pickedRows.length === 0 || !valid}
            onClick={() =>
              onAdd(
                pickedRows.map((row) => ({
                  ...allocationFromOutstanding(row, customerId),
                  amount: picked[row.ar_invoice_id],
                })),
              )
            }
          >
            {t("addSelected", { count: pickedRows.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
