import { useArInvoiceLineLabels } from "./use-ar-invoice-line-labels";
import { useTranslations } from "use-intl";
import { SummaryBar } from "@/components/ui/summary-bar";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { round2 } from "@/lib/currency-utils";
import { ApDetailGrid } from "../accounts-payable/shared/ap-detail-grid";
import { arLineAmounts, type ArDraftLine } from "./ar-invoice-draft-model";

export function ArInvoiceTaxLines({
  lines,
  exchangeRate,
  baseCurrency,
}: {
  readonly lines: ArDraftLine[];
  readonly exchangeRate: number;
  readonly baseCurrency: string;
}) {
  const t = useTranslations("accounting.arRegister");
  const money = useAmountFormatter();
  const labeled = useArInvoiceLineLabels(lines);
  const rows = labeled.lines.flatMap((line) => {
    const amount = arLineAmounts(line);
    const base =
      round2(amount.subtotal * exchangeRate) -
      round2(amount.discount * exchangeRate);
    return (["vat", "tax2"] as const).flatMap((tax) =>
      line[`${tax}_tax_profile_id`]
        ? [
            {
              id: `${line.id}-${tax}`,
              sequence: line.sequence_no,
              profile:
                line[`${tax}_profile_name`] ||
                t(tax === "vat" ? "tax1Profile" : "tax2Profile"),
              description: line.description,
              base,
              rate: Number(line[`${tax}_rate`] || 0),
              tax: round2(amount[tax] * exchangeRate),
            },
          ]
        : [],
    );
  });
  return (
    <div className="space-y-3">
      <ApDetailGrid
        rows={rows}
        empty={t("noRecords")}
        columns={[
          { accessorKey: "sequence", header: "#" },
          { accessorKey: "profile", header: t("tax") },
          { accessorKey: "description", header: t("memo") },
          {
            id: "base",
            header: t("taxBase"),
            cell: ({ row }) => money(row.original.base),
          },
          {
            id: "rate",
            header: t("rate"),
            cell: ({ row }) => `${row.original.rate}%`,
          },
          {
            id: "tax",
            header: t("taxAmount"),
            cell: ({ row }) => money(row.original.tax),
          },
          {
            id: "total",
            header: t("total"),
            cell: ({ row }) =>
              money(round2(row.original.base + row.original.tax)),
          },
        ]}
      />
      <SummaryBar
        items={[
          {
            key: "tax",
            label: t("taxAmount"),
            value: money(rows.reduce((sum, row) => sum + row.tax, 0)),
            suffix: baseCurrency,
          },
        ]}
      />
    </div>
  );
}
