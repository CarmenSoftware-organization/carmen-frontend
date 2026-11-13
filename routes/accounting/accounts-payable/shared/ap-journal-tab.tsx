import { Link } from "react-router";
import { useTranslations } from "use-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { useJournalVoucher } from "@/routes/accounting/journal-voucher/use-journal-voucher";
import type { JournalVoucherLine } from "@/types/journal-voucher";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { ApDetailGrid } from "./ap-detail-grid";

export function ApJournalTab({ id }: { readonly id?: string | null }) {
  const t = useTranslations("accounting.accountsPayable.ui");
  const query = useJournalVoucher(id ?? undefined);
  const money = useAmountFormatter();
  if (query.isLoading && id) return <Skeleton className="h-32" />;
  if (query.isError)
    return (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    );
  const columns: ColumnDef<JournalVoucherLine>[] = [
    { accessorKey: "account_code", header: t("account") },
    { accessorKey: "account_name", header: t("description") },
    { accessorKey: "department_code", header: t("costCenter") },
    { accessorKey: "comment", header: t("comment") },
    { accessorKey: "currency_code", header: t("currency") },
    { accessorKey: "exchange_rate", header: t("exchangeRate") },
    ...(["debit", "credit", "base_debit", "base_credit"] as const).map(
      (key) => ({
        accessorKey: key,
        header: t(key),
        cell: ({ row }: { row: { original: JournalVoucherLine } }) => (
          <span className="block text-right tabular-nums">
            {money(Number(row.original[key]))}
          </span>
        ),
      }),
    ),
  ];
  return (
    <div className="space-y-3">
      {id ? (
        <Link
          className="text-primary text-xs underline"
          to={`/accounting/journal-voucher/${id}`}
        >
          {query.data?.display_no || t("openJournal")}
        </Link>
      ) : (
        <p className="text-muted-foreground text-xs">
          {t("journalAfterPosting")}
        </p>
      )}
      <ApDetailGrid
        rows={query.data?.lines ?? []}
        columns={columns}
        empty={t("noJournal")}
      />
    </div>
  );
}
