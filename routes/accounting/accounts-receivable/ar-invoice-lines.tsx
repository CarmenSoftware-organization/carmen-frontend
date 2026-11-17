import { useArInvoiceLineLabels } from "./use-ar-invoice-line-labels";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldPlainText } from "@/components/ui/field";
import { CellAction } from "@/components/ui/cell-action";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { ApDetailGrid } from "../accounts-payable/shared/ap-detail-grid";
import {
  arLineAmounts,
  type ArDraftLine,
  type ArInvoiceLineRecord,
} from "./ar-invoice-draft-model";

export function ArInvoiceLines({
  lines,
  edit,
  remove,
}: {
  readonly lines: ArDraftLine[];
  readonly edit?: (line: ArDraftLine) => void;
  readonly remove?: (line: ArDraftLine) => void;
}) {
  const t = useTranslations("accounting.arRegister");
  const money = useAmountFormatter();
  const labeled = useArInvoiceLineLabels(lines);
  const [view, setView] = useState<ArDraftLine | null>(null);
  return (
    <>
      <ApDetailGrid
        rows={labeled.lines}
        empty={t("noRecords")}
        columns={[
          { accessorKey: "sequence_no", header: "#" },
          {
            accessorKey: "description",
            header: t("memo"),
            cell: ({ row: { original: line } }) => (
              <div className="min-w-40 space-y-1">
                {
                  <CellAction
                    onClick={() => (edit ? edit(line) : setView(line))}
                  >
                    {line.description ||
                      t("lineNumber", { number: line.sequence_no })}
                  </CellAction>
                }
                <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <span>
                    {t("revenueAccount")}: {line.cr_account_code || "—"}
                  </span>
                  <span>
                    {t("revenueCostCenter")}: {line.cr_cost_center_code || "—"}
                  </span>
                </div>
                {line.reference_info && (
                  <p className="text-muted-foreground text-xs whitespace-pre-line">
                    {line.reference_info}
                  </p>
                )}
                {Boolean(
                  line.dimensions?.length ||
                  (line as ArInvoiceLineRecord).tb_ar_invoice_detail_dimension
                    ?.length,
                ) && (
                  <p className="text-muted-foreground text-xs">
                    {t("dimensionCount", {
                      count:
                        line.dimensions?.length ??
                        (line as ArInvoiceLineRecord)
                          .tb_ar_invoice_detail_dimension?.length ??
                        0,
                    })}
                  </p>
                )}
              </div>
            ),
          },
          { accessorKey: "unit_name", header: t("unit") },
          { accessorKey: "quantity", header: t("quantity") },
          {
            accessorKey: "unit_price",
            header: t("unitPrice"),
            cell: ({ row }) => money(Number(row.original.unit_price)),
          },
          {
            id: "subtotal",
            header: t("subtotal"),
            cell: ({ row }) => money(arLineAmounts(row.original).subtotal),
          },
          {
            id: "discount",
            header: t("discount"),
            cell: ({ row }) => money(arLineAmounts(row.original).discount),
          },
          {
            id: "net",
            header: t("net"),
            cell: ({ row }) => money(arLineAmounts(row.original).net),
          },
          {
            id: "tax",
            header: t("tax"),
            cell: ({ row }) =>
              money(
                arLineAmounts(row.original).vat +
                  arLineAmounts(row.original).tax2,
              ),
          },
          {
            id: "total",
            header: t("totalUnpaid"),
            cell: ({ row: { original: line } }) => (
              <div className="tabular-nums">
                <div>{money(arLineAmounts(line).total)}</div>
                <div className="text-muted-foreground text-xs">
                  {money(
                    Number(
                      (line as ArInvoiceLineRecord).unpaid_amount ??
                        arLineAmounts(line).total,
                    ),
                  )}
                </div>
              </div>
            ),
          },
          ...(remove
            ? [
                {
                  id: "actions",
                  cell: ({
                    row: { original: line },
                  }: {
                    row: { original: ArDraftLine };
                  }) => (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("removeLine", { number: line.sequence_no })}
                      onClick={() => remove(line)}
                    >
                      <Trash2 />
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />
      {view && <InvoiceLineView line={view} close={() => setView(null)} />}
    </>
  );
}

function InvoiceLineView({
  line,
  close,
}: {
  readonly line: ArDraftLine;
  readonly close: () => void;
}) {
  const t = useTranslations("accounting.arRegister");
  const money = useAmountFormatter();
  const amount = arLineAmounts(line);
  const fields = [
    [t("memo"), line.description],
    [t("groupNo"), line.group_no ?? 1],
    [t("referenceInfo"), line.reference_info],
    [t("dateFrom"), line.date_from?.slice(0, 10)],
    [t("dateTo"), line.date_to?.slice(0, 10)],
    [t("unit"), line.unit_name],
    [t("quantity"), line.quantity],
    [t("unitPrice"), money(Number(line.unit_price))],
    [t("subtotal"), money(amount.subtotal)],
    [t("discountPercent"), line.discount_pct ?? 0],
    [t("discountAmount"), money(amount.discount)],
    [t("net"), money(amount.net)],
    [t("tax1Profile"), line.vat_profile_name],
    [t("tax1Amount"), money(amount.vat)],
    [t("tax2Profile"), line.tax2_profile_name],
    [t("tax2Amount"), money(amount.tax2)],
    [t("total"), money(amount.total)],
  ];
  const dimensions =
    line.dimensions ??
    (line as ArInvoiceLineRecord).tb_ar_invoice_detail_dimension ??
    [];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>
            {t("lineNumber", { number: line.sequence_no })}
          </DialogTitle>
        </DialogHeader>
        <div className="@container space-y-4">
          <div className="grid gap-x-4 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-3">
            {fields.map(([label, value]) => (
              <Field key={label}>
                <FieldLabel>{label}</FieldLabel>
                <FieldPlainText className="whitespace-pre-line">
                  {value ?? "—"}
                </FieldPlainText>
              </Field>
            ))}
          </div>
          <div className="grid gap-3 @md:grid-cols-2">
            <LabelField
              title={t("revenueAccount")}
              value={line.cr_account_code}
            />
            <LabelField
              title={t("revenueCostCenter")}
              value={line.cr_cost_center_code}
            />
            <LabelField title={t("arAccount")} value={line.dr_account_code} />
            <LabelField
              title={t("arCostCenter")}
              value={line.dr_cost_center_code}
            />
            <LabelField
              title={`${t("tax1Profile")} · ${t("taxAccount")}`}
              value={line.vat_account_code}
            />
            <LabelField
              title={t("taxCostCenter")}
              value={line.vat_cost_center_code}
            />
            <LabelField
              title={`${t("tax2Profile")} · ${t("taxAccount")}`}
              value={line.tax2_account_code}
            />
            <LabelField
              title={t("taxCostCenter")}
              value={line.tax2_cost_center_code}
            />
          </div>
          {dimensions.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {dimensions.map((item) => (
                <Field key={item.gl_dimension_id}>
                  <FieldLabel>
                    {item.dimension_code || t("dimensions")}
                  </FieldLabel>
                  <FieldPlainText>{item.value_code || "—"}</FieldPlainText>
                </Field>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
function LabelField({
  title,
  value,
}: {
  readonly title: string;
  readonly value?: string | null;
}) {
  return (
    <Field>
      <FieldLabel>{title}</FieldLabel>
      <FieldPlainText>{value || "—"}</FieldPlainText>
    </Field>
  );
}
