import { useArInvoiceLineLabels } from "./use-ar-invoice-line-labels";
import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { SummaryBar } from "@/components/ui/summary-bar";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { ApDetailGrid } from "../accounts-payable/shared/ap-detail-grid";
import { useJournalVoucher } from "../journal-voucher/use-journal-voucher";
import { arLineAmounts, draftLineFromRecord } from "./ar-invoice-draft-model";
import type { ArRegisterDocument } from "./use-ar-register";

export function InvoiceJournal({
  document,
}: {
  readonly document: ArRegisterDocument;
}) {
  const t = useTranslations("accounting.arRegister");
  const money = useAmountFormatter();
  const query = useJournalVoucher(document.gl_jv_id ?? undefined);
  const labeled = useArInvoiceLineLabels(
    (document.tb_ar_invoice_detail ?? []).map(draftLineFromRecord),
  );
  const actual = query.data?.lines.map((line) => ({
    sequence: line.sequence_no,
    account:
      line.account_code || labeled.accounts.get(line.account_id)?.code || null,
    center:
      line.department_code ||
      (line.department_id
        ? labeled.centers.get(line.department_id)?.code
        : null) ||
      null,
    comment: line.comment,
    currency: line.currency_code,
    rate: Number(line.exchange_rate),
    debit: Number(line.debit),
    credit: Number(line.credit),
    dimensions: line.dimension.length,
  }));
  const preview = labeled.lines
    .flatMap((line) => {
      const amount = arLineAmounts(line);
      const common = {
        comment: line.description ?? null,
        currency: document.currency_code,
        rate: Number(document.exchange_rate ?? 1),
        dimensions: 0,
      };
      return [
        {
          ...common,
          account: line.dr_account_code || t("defaultArAccount"),
          center: line.dr_cost_center_code ?? null,
          debit: amount.total,
          credit: 0,
        },
        {
          ...common,
          account: line.cr_account_code || "—",
          center: line.cr_cost_center_code ?? null,
          debit: 0,
          credit: amount.net,
          dimensions: line.dimensions?.length ?? 0,
        },
        ...(amount.vat
          ? [
              {
                ...common,
                account: line.vat_account_code || t("tax1Profile"),
                center: line.vat_cost_center_code ?? null,
                debit: 0,
                credit: amount.vat,
              },
            ]
          : []),
        ...(amount.tax2
          ? [
              {
                ...common,
                account: line.tax2_account_code || t("tax2Profile"),
                center: line.tax2_cost_center_code ?? null,
                debit: 0,
                credit: amount.tax2,
              },
            ]
          : []),
      ];
    })
    .filter((line) => line.debit !== 0 || line.credit !== 0)
    .map((line, index) => ({
      ...line,
      sequence: index + 1,
      ...(document.doc_type === "credit_note"
        ? { debit: line.credit, credit: line.debit }
        : {}),
    }));
  const rows = actual ?? preview;
  const debit = rows.reduce((sum, line) => sum + line.debit, 0),
    credit = rows.reduce((sum, line) => sum + line.credit, 0);
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return (
    <div className="space-y-3">
      {document.gl_jv_id ? (
        <Button asChild variant="outline" size="sm">
          <Link to={`/accounting/journal-voucher/${document.gl_jv_id}`}>
            {document.gl_jv_no || t("journal")}
          </Link>
        </Button>
      ) : (
        <p className="text-muted-foreground text-xs">
          {t(document.is_pms_folio ? "pmsNoRepost" : "journalPreview")}
        </p>
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
          { accessorKey: "dimensions", header: t("dimensions") },
        ]}
      />
      <SummaryBar
        items={[
          { key: "rows", label: t("rowCount"), value: rows.length },
          {
            key: "debit",
            label: t("debit"),
            value: money(debit),
            suffix: document.currency_code,
          },
          {
            key: "credit",
            label: t("credit"),
            value: money(credit),
            suffix: document.currency_code,
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
