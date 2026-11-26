import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { SummaryBar } from "@/components/ui/summary-bar";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { ApDetailGrid } from "../accounts-payable/shared/ap-detail-grid";
import { useJournalVoucher } from "../journal-voucher/use-journal-voucher";

/** Journal posted by the receipt; empty until the receipt is submitted. */
export function ReceiptJournal({
  jvId,
  jvNo,
  voidJvId,
  currency,
}: {
  readonly jvId?: string | null;
  readonly jvNo?: string | null;
  /** reversing journal of a voided posted receipt */
  readonly voidJvId?: string | null;
  readonly currency: string;
}) {
  const t = useTranslations("accounting.arRegister");
  const tr = useTranslations("accounting.arReceipt");
  const money = useAmountFormatter();
  const query = useJournalVoucher(jvId ?? undefined);
  const rows = (query.data?.lines ?? []).map((line) => ({
    sequence: line.sequence_no,
    account: line.account_code || null,
    center: line.department_code || null,
    comment: line.comment,
    currency: line.currency_code,
    rate: Number(line.exchange_rate),
    debit: Number(line.debit),
    credit: Number(line.credit),
  }));
  const debit = rows.reduce((sum, line) => sum + line.debit, 0);
  const credit = rows.reduce((sum, line) => sum + line.credit, 0);
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return (
    <div className="space-y-3">
      {jvId ? (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/general-ledger/journal-voucher/${jvId}`}>
              {jvNo || t("journal")}
            </Link>
          </Button>
          {voidJvId && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/general-ledger/journal-voucher/${voidJvId}`}>
                {tr("voidJournal")}
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">{tr("journalHint")}</p>
      )}
      <ApDetailGrid
        rows={rows}
        empty={t("noRecords")}
        columns={[
          { accessorKey: "sequence", header: "#" },
          { accessorKey: "account", header: t("account") },
          { accessorKey: "center", header: t("costCenter") },
          { accessorKey: "comment", header: t("memo") },
          { accessorKey: "currency", header: t("currency") },
          { accessorKey: "rate", header: t("rate") },
          {
            id: "debit",
            header: t("debit"),
            cell: ({ row }) => money(row.original.debit),
          },
          {
            id: "credit",
            header: t("credit"),
            cell: ({ row }) => money(row.original.credit),
          },
        ]}
      />
      <SummaryBar
        items={[
          { key: "rows", label: t("rowCount"), value: rows.length },
          {
            key: "debit",
            label: t("debit"),
            value: money(debit),
            suffix: currency,
          },
          {
            key: "credit",
            label: t("credit"),
            value: money(credit),
            suffix: currency,
          },
          {
            key: "variance",
            label: t("variance"),
            value: money(debit - credit),
            emphasis: true,
          },
        ]}
      />
    </div>
  );
}
