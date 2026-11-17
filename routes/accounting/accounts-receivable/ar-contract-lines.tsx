import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "use-intl";
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import { Button } from "@/components/ui/button";
import { CellAction } from "@/components/ui/cell-action";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldPlainText } from "@/components/ui/field";
import { useChartOfAccountById } from "@/hooks/use-chart-of-account";
import { useCostCenterById } from "@/hooks/use-cost-center";
import {
  useGlDimensions,
  useGlDimensionValues,
} from "@/hooks/use-gl-dimensions";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { useDimensionValueFormatter } from "@/hooks/use-dimension-value-formatter";
import { formatDate } from "@/lib/date-utils";
import { ApDetailGrid } from "../accounts-payable/shared/ap-detail-grid";
import { arLineAmounts, type ArDraftLine } from "./ar-invoice-draft-model";

export function ContractLines({
  lines,
  readOnly,
  add,
  edit,
  remove,
}: {
  readonly lines: ArDraftLine[];
  readonly readOnly: boolean;
  readonly add: () => void;
  readonly edit: (line: ArDraftLine) => void;
  readonly remove: (id: string) => void;
}) {
  const t = useTranslations("accounting.arRegister");
  const tc = useTranslations("common");
  const contract = useTranslations("accounting.arContract");
  const money = useAmountFormatter();
  const mobile = useIsMobile();
  const { dateFormat } = useProfile();
  const [viewing, setViewing] = useState<ArDraftLine>();
  const open = (line: ArDraftLine) =>
    readOnly ? setViewing(line) : edit(line);
  const reference = (line: ArDraftLine) => (
    <div className="min-w-0 space-y-1 whitespace-normal">
      <CellAction onClick={() => open(line)}>
        {line.description || `${t("lineNumber", { number: line.sequence_no })}`}
      </CellAction>
      {line.reference_info && (
        <div className="text-muted-foreground text-xs whitespace-pre-wrap">
          {line.reference_info}
        </div>
      )}
      <div className="text-muted-foreground text-xs">
        {t("groupNo")}: {line.group_no ?? "—"} ·{" "}
        {formatDate(line.date_from, dateFormat) || "—"} –{" "}
        {formatDate(line.date_to, dateFormat) || "—"}
      </div>
    </div>
  );
  const columns: ColumnDef<ArDraftLine>[] = [
    { accessorKey: "sequence_no", header: "#", size: 45 },
    {
      id: "reference",
      header: t("bookingReference"),
      size: 250,
      meta: { grow: true },
      cell: ({ row }) => reference(row.original),
    },
    {
      id: "account",
      header: t("revenueAccount"),
      size: 150,
      cell: ({ row }) => (
        <div className="space-y-1">
          <div>{row.original.cr_account_code || "—"}</div>
          <div className="text-muted-foreground text-xs">
            {row.original.cr_cost_center_code || "—"}
          </div>
        </div>
      ),
    },
    {
      id: "quantity",
      header: t("quantity"),
      size: 90,
      meta: {
        cellClassName: "text-right tabular-nums",
        headerClassName: "text-right",
      },
      cell: ({ row }) => (
        <div>
          {money(Number(row.original.quantity))}
          <div className="text-muted-foreground text-xs">
            {row.original.unit_name || "—"}
          </div>
        </div>
      ),
    },
    {
      id: "unitPrice",
      header: t("unitPrice"),
      size: 100,
      meta: {
        cellClassName: "text-right tabular-nums",
        headerClassName: "text-right",
      },
      cell: ({ row }) => money(Number(row.original.unit_price)),
    },
    {
      id: "net",
      header: t("net"),
      size: 100,
      meta: {
        cellClassName: "text-right tabular-nums",
        headerClassName: "text-right",
      },
      cell: ({ row }) => money(arLineAmounts(row.original).net),
    },
    {
      id: "tax",
      header: t("outputTax"),
      size: 110,
      meta: {
        cellClassName: "text-right tabular-nums",
        headerClassName: "text-right",
      },
      cell: ({ row }) => (
        <div>
          {money(arLineAmounts(row.original).vat)}
          <div className="text-muted-foreground text-xs">
            {money(arLineAmounts(row.original).tax2)}
          </div>
        </div>
      ),
    },
    {
      id: "total",
      header: t("total"),
      size: 110,
      meta: {
        cellClassName: "text-right font-semibold tabular-nums",
        headerClassName: "text-right",
      },
      cell: ({ row }) => money(arLineAmounts(row.original).total),
    },
    {
      id: "actions",
      header: "",
      size: 75,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title={tc(readOnly ? "view" : "edit")}
            onClick={() => open(row.original)}
          >
            {readOnly ? <Eye /> : <Pencil />}
          </Button>
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-destructive"
              title={tc("delete")}
              onClick={() => remove(row.original.id)}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      ),
    },
  ];
  return (
    <CompactSection
      title={contract("items")}
      count={lines.length}
      frameless
      first
      action={
        !readOnly && (
          <Button type="button" size="sm" variant="outline" onClick={add}>
            <Plus />
            {t("addLine")}
          </Button>
        )
      }
    >
      {mobile ? (
        <div className="space-y-2">
          {lines.length ? (
            lines.map((line) => (
              <div key={line.id} className="space-y-2 border-b py-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">{reference(line)}</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    title={tc(readOnly ? "view" : "edit")}
                    onClick={() => open(line)}
                  >
                    {readOnly ? <Eye /> : <Pencil />}
                  </Button>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="text-destructive"
                      title={tc("delete")}
                      onClick={() => remove(line.id)}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
                  <span>
                    {line.cr_account_code || "—"} ·{" "}
                    {line.cr_cost_center_code || "—"}
                  </span>
                  <span>
                    {t("quantity")}: {money(Number(line.quantity))}{" "}
                    {line.unit_name}
                  </span>
                  <span>
                    {t("total")}:{" "}
                    <strong>{money(arLineAmounts(line).total)}</strong>
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground py-4 text-center text-xs">
              {contract("lineRequired")}
            </p>
          )}
        </div>
      ) : (
        <ApDetailGrid
          rows={lines}
          columns={columns}
          empty={contract("lineRequired")}
        />
      )}
      {viewing && (
        <ContractLineView line={viewing} close={() => setViewing(undefined)} />
      )}
    </CompactSection>
  );
}

function ContractLineView({
  line,
  close,
}: {
  readonly line: ArDraftLine;
  readonly close: () => void;
}) {
  const t = useTranslations("accounting.arRegister");
  const tc = useTranslations("common");
  const money = useAmountFormatter();
  const { dateFormat } = useProfile();
  const amounts = arLineAmounts(line);
  const field = (label: string, value: React.ReactNode) => (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldPlainText className="break-words whitespace-pre-wrap">
        {value || "—"}
      </FieldPlainText>
    </Field>
  );
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
            {tc("view")} · {t("lineNumber", { number: line.sequence_no })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t("bookingReference")}</h3>
            <FieldGrid>
              {field(t("memo"), line.description)}
              {field(t("groupNo"), line.group_no)}
              {field(t("referenceInfo"), line.reference_info)}
              {field(t("dateFrom"), formatDate(line.date_from, dateFormat))}
              {field(t("dateTo"), formatDate(line.date_to, dateFormat))}
              {field(
                t("quantity"),
                `${money(Number(line.quantity))} ${line.unit_name ?? ""}`,
              )}
              {field(t("unitPrice"), money(Number(line.unit_price)))}
            </FieldGrid>
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t("discount")}</h3>
            <FieldGrid>
              {field(t("subtotal"), money(amounts.subtotal))}
              {field(
                t("discountPercent"),
                `${Number(line.discount_pct ?? 0)}%`,
              )}
              {field(t("discountAmount"), money(amounts.discount))}
              {field(
                t("override"),
                tc(line.discount_is_override ? "yes" : "no"),
              )}
            </FieldGrid>
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t("revenue")}</h3>
            <FieldGrid>
              {field(
                t("revenueAccount"),
                <AccountValue id={line.cr_chart_of_accounts_id} />,
              )}
              {field(
                t("revenueCostCenter"),
                <CostCenterValue id={line.cr_cost_center_id} />,
              )}
              {field(t("net"), money(amounts.net))}
              <ContractDimensions line={line} />
            </FieldGrid>
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t("outputTax")}</h3>
            <div className="@container">
              <div className="grid gap-4 @3xl:grid-cols-2">
                {(["vat", "tax2"] as const).map((tax) => (
                  <div key={tax}>
                    <FieldGrid>
                      {field(
                        t(tax === "vat" ? "tax1Profile" : "tax2Profile"),
                        line[`${tax}_profile_name`] || t("noTax"),
                      )}
                      {field(
                        t("taxAccount"),
                        <AccountValue
                          id={line[`${tax}_chart_of_accounts_id`]}
                        />,
                      )}
                      {field(
                        t("taxCostCenter"),
                        <CostCenterValue id={line[`${tax}_cost_center_id`]} />,
                      )}
                      {field(
                        t(tax === "vat" ? "tax1Amount" : "tax2Amount"),
                        money(amounts[tax]),
                      )}
                      {field(
                        t("override"),
                        tc(line[`${tax}_is_override`] ? "yes" : "no"),
                      )}
                    </FieldGrid>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t("receivable")}</h3>
            <FieldGrid>
              {field(
                t("arAccount"),
                <AccountValue id={line.dr_chart_of_accounts_id} />,
              )}
              {field(
                t("arCostCenter"),
                <CostCenterValue id={line.dr_cost_center_id} />,
              )}
              {field(t("total"), money(amounts.total))}
            </FieldGrid>
          </section>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={close}>
              {tc("close")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AccountValue({ id }: { readonly id?: string | null }) {
  const { data } = useChartOfAccountById(id || undefined);
  return <>{data ? `${data.code} · ${data.description_1}` : "—"}</>;
}
function CostCenterValue({ id }: { readonly id?: string | null }) {
  const { data } = useCostCenterById(id || undefined);
  return <>{data ? `${data.code} · ${data.name}` : "—"}</>;
}
function ContractDimensions({ line }: { readonly line: ArDraftLine }) {
  const dimensions = line.dimensions ?? [];
  const { data } = useGlDimensions(dimensions.length > 0);
  const values = useGlDimensionValues(
    dimensions.some((item) => !!item.dimension_value_id && !item.value_code),
  );
  const formatValue = useDimensionValueFormatter();
  return (
    <>
      {dimensions.map((dimension) => (
        <Field key={dimension.dimension_id}>
          <FieldLabel>
            {data?.find((item) => item.id === dimension.dimension_id)?.name ??
              dimension.dimension_name ??
              dimension.dimension_code ??
              "Dimension"}
          </FieldLabel>
          <FieldPlainText>
            {formatValue(
              {
                ...dimension,
                value_code:
                  dimension.value_code ??
                  values.data?.find(
                    (item) => item.id === dimension.dimension_value_id,
                  )?.code,
              },
              data?.find((item) => item.id === dimension.dimension_id),
            ) || "—"}
          </FieldPlainText>
        </Field>
      ))}
    </>
  );
}
