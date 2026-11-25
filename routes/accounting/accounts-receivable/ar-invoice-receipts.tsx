import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { ApDetailGrid } from "../accounts-payable/shared/ap-detail-grid";
import { AR_RECEIPT_PATH } from "./ar-receipt-model";
import { useArReceiptsByInvoice } from "./use-ar-receipt";

/** Receipts that settle this invoice (any status), linked to their detail page. */
export function InvoiceReceipts({
  invoiceId,
  currency,
}: {
  readonly invoiceId: string;
  readonly currency: string;
}) {
  const t = useTranslations("accounting.arRegister");
  const tr = useTranslations("accounting.arReceipt");
  const money = useAmountFormatter();
  const { dateFormat } = useProfile();
  const query = useArReceiptsByInvoice(invoiceId);
  if (query.isPending) return <Skeleton className="h-16 w-full" />;
  if (query.isError)
    return (
      <ErrorState
        error={query.error}
        message={t("receiptsLoadError")}
        onRetry={() => query.refetch()}
      />
    );
  return (
    <ApDetailGrid
      rows={query.data.data}
      empty={t("noReceipts")}
      columns={[
        {
          accessorKey: "doc_no",
          header: t("receiptNo"),
          cell: ({ row }) => (
            <Link
              className="text-primary underline-offset-2 hover:underline"
              to={`${AR_RECEIPT_PATH}/${row.original.id}`}
            >
              {row.original.doc_no}
            </Link>
          ),
        },
        {
          accessorKey: "receipt_date",
          header: t("receiptDate"),
          cell: ({ row }) =>
            row.original.receipt_date
              ? formatDate(row.original.receipt_date, dateFormat)
              : "—",
        },
        {
          accessorKey: "doc_status",
          header: t("status"),
          cell: ({ row }) => (
            <StatusChip
              status={row.original.doc_status}
              label={tr(`statuses.${row.original.doc_status}`)}
            />
          ),
        },
        {
          id: "amount",
          header: `${t("netReceived")} (${currency})`,
          cell: ({ row }) => money(Number(row.original.net_received_amount)),
          meta: { cellClassName: "text-right tabular-nums" },
        },
      ]}
    />
  );
}
