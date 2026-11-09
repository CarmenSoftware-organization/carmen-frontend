"use no memo";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Trash2, X } from "lucide-react";
import { useTranslations } from "use-intl";
import { LookupChartOfAccountById } from "@/components/lookup/lookup-chart-of-account-by-id";
import { LookupCostCenter } from "@/components/lookup/lookup-cost-center";
import { LookupProduct } from "@/components/lookup/lookup-product";
import { LookupTaxProfile } from "@/components/lookup/lookup-tax-profile";
import { LookupUnit } from "@/components/lookup/lookup-unit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { ApDetailGrid } from "../shared/ap-detail-grid";
import { lineAmounts, type InvoiceFormLine } from "./ap-invoice-form";

const DECIMAL_RE = /^\d*(\.\d*)?$/;

type Patch = Partial<InvoiceFormLine>;

function Label({ k }: { readonly k: string }) {
  const t = useTranslations("accounting.accountsPayable.invoice.detail.lines");
  return <>{t(k)}</>;
}

function Amount({
  value,
  className,
}: {
  readonly value: string;
  readonly className?: string;
}) {
  const format = useAmountFormatter();
  return (
    <span className={`block text-right tabular-nums ${className ?? ""}`}>
      {format(Number(value || 0))}
    </span>
  );
}

function DecimalCell({
  value,
  editable,
  label,
  onChange,
}: {
  readonly value: string;
  readonly editable: boolean;
  readonly label: string;
  readonly onChange: (value: string) => void;
}) {
  const format = useAmountFormatter();
  if (!editable)
    return (
      <span className="block text-right tabular-nums">
        {format(Number(value || 0))}
      </span>
    );
  return (
    <Input
      aria-label={label}
      inputMode="decimal"
      className="min-w-24 text-right tabular-nums"
      value={value}
      onChange={(event) => {
        if (DECIMAL_RE.test(event.target.value)) onChange(event.target.value);
      }}
    />
  );
}

function TaxCell({
  kind,
  line,
  editable,
  onChange,
}: {
  readonly kind: "vat" | "wht";
  readonly line: InvoiceFormLine;
  readonly editable: boolean;
  readonly onChange: (patch: Patch) => void;
}) {
  const t = useTranslations("accounting.accountsPayable.invoice.detail.lines");
  const profileId =
    kind === "vat" ? line.vat_tax_profile_id : line.wht_tax_profile_id;
  const rate = kind === "vat" ? line.vat_rate : line.wht_rate;
  if (!editable)
    return (
      <span className="block text-right tabular-nums">
        {profileId ? `${Number(rate)}%` : "—"}
      </span>
    );
  return (
    <div className="flex min-w-44 items-center gap-1">
      <LookupTaxProfile
        value={profileId ?? ""}
        placeholder={t(kind === "vat" ? "vatProfile" : "whtProfile")}
        onValueChange={(id, taxRate) =>
          onChange(
            kind === "vat"
              ? {
                  vat_tax_profile_id: id,
                  vat_rate: String(taxRate),
                  vat_is_override: false,
                }
              : { wht_tax_profile_id: id, wht_rate: String(taxRate) },
          )
        }
      />
      {profileId && (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={t("clearTax")}
          onClick={() =>
            onChange(
              kind === "vat"
                ? {
                    vat_tax_profile_id: null,
                    vat_rate: "0",
                    vat_is_override: false,
                  }
                : { wht_tax_profile_id: null, wht_rate: "0" },
            )
          }
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}

function RowActions({
  first,
  last,
  only,
  onUp,
  onDown,
  onRemove,
}: {
  readonly first: boolean;
  readonly last: boolean;
  readonly only: boolean;
  readonly onUp: () => void;
  readonly onDown: () => void;
  readonly onRemove: () => void;
}) {
  const t = useTranslations("accounting.accountsPayable.invoice.detail.lines");
  return (
    <div className="flex">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={t("moveUp")}
        disabled={first}
        onClick={onUp}
      >
        <ArrowUp className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={t("moveDown")}
        disabled={last}
        onClick={onDown}
      >
        <ArrowDown className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={t("remove")}
        disabled={only}
        onClick={onRemove}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

export function InvoiceLines({
  lines,
  editable,
  deposit,
  showErrors,
  onChange,
  onMove,
  onRemove,
}: {
  readonly lines: InvoiceFormLine[];
  readonly deposit: boolean;
  readonly editable: boolean;
  readonly showErrors: boolean;
  readonly onChange: (key: string, patch: Patch) => void;
  readonly onMove: (key: string, direction: -1 | 1) => void;
  readonly onRemove: (key: string) => void;
}) {
  const t = useTranslations("accounting.accountsPayable.invoice.detail.lines");
  const tc = useTranslations("common");
  const hasGrn = lines.some((line) => line.grn_no);
  const required = t("required");

  // columns ต้อง memoize และไม่พึ่งค่าที่เปลี่ยนทุก render (formatter/t) ไม่งั้น cell remount แล้ว input เสีย focus
  const columns = useMemo<ColumnDef<InvoiceFormLine>[]>(() => {
    const cols: ColumnDef<InvoiceFormLine>[] = [
      {
        id: "no",
        header: () => "#",
        cell: ({ row }) => row.index + 1,
      },
    ];
    if (hasGrn)
      cols.push({
        id: "grn",
        header: () => <Label k="grnNo" />,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.grn_no ?? "—"}
          </span>
        ),
      });
    cols.push(
      {
        id: "product",
        header: () => <Label k="product" />,
        cell: ({ row }) =>
          editable ? (
            <div className="min-w-48">
              <LookupProduct
                value={row.original.product_id ?? ""}
                defaultLabel={row.original.product_name ?? undefined}
                onValueChange={(id, product) =>
                  onChange(row.original.key, {
                    product_id: id || null,
                    product_name: product?.name ?? null,
                    description:
                      row.original.description || (product?.name ?? ""),
                  })
                }
              />
            </div>
          ) : (
            <span className="min-w-32">{row.original.product_name ?? "—"}</span>
          ),
      },
      {
        id: "description",
        header: () => <Label k="description" />,
        cell: ({ row }) =>
          editable ? (
            <Input
              aria-label={`description ${row.index + 1}`}
              className="min-w-48"
              value={row.original.description}
              onChange={(event) =>
                onChange(row.original.key, { description: event.target.value })
              }
            />
          ) : (
            <span className="block min-w-48">
              {row.original.description || "—"}
            </span>
          ),
      },
      {
        id: "unit",
        header: () => <Label k="unit" />,
        cell: ({ row }) =>
          editable ? (
            <div className="min-w-28">
              <LookupUnit
                value={row.original.unit_id ?? ""}
                defaultLabel={row.original.unit_name ?? undefined}
                onValueChange={(id) =>
                  onChange(row.original.key, { unit_id: id || null })
                }
                onItemChange={(unit) =>
                  onChange(row.original.key, {
                    unit_name: unit.name ?? unit.code,
                  })
                }
              />
            </div>
          ) : (
            <span>{row.original.unit_name ?? "—"}</span>
          ),
      },
      {
        id: "quantity",
        header: () => <Label k="quantity" />,
        cell: ({ row }) => (
          <DecimalCell
            value={row.original.quantity}
            editable={editable}
            label={`quantity ${row.index + 1}`}
            onChange={(quantity) => onChange(row.original.key, { quantity })}
          />
        ),
      },
      {
        id: "unit_price",
        header: () => <Label k="unitPrice" />,
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <DecimalCell
              value={row.original.unit_price}
              editable={editable}
              label={`unit price ${row.index + 1}`}
              onChange={(unit_price) =>
                onChange(row.original.key, { unit_price })
              }
            />
            {/* Inc VAT — แก้ได้เท่ากับช่องราคา · deposit ไม่มี flag (BE ปฏิเสธ) */}
            {!deposit &&
              (editable ? (
                <label className="flex cursor-pointer items-center justify-end gap-1">
                  <Checkbox
                    checked={row.original.vat_is_included}
                    onCheckedChange={(checked) =>
                      onChange(row.original.key, {
                        vat_is_included: checked === true,
                      })
                    }
                    className="size-3.5"
                  />
                  <span className="text-muted-foreground text-micro-legal font-normal select-none">
                    {tc("incVat")}
                  </span>
                </label>
              ) : (
                row.original.vat_is_included && (
                  <span className="text-muted-foreground text-micro-legal block text-right font-normal">
                    {tc("incVat")}
                  </span>
                )
              ))}
          </div>
        ),
      },
      {
        id: "discount",
        header: () => <Label k="discount" />,
        cell: ({ row }) => (
          <DecimalCell
            value={row.original.discount_amount}
            editable={editable}
            label={`discount ${row.index + 1}`}
            onChange={(discount_amount) =>
              onChange(row.original.key, { discount_amount })
            }
          />
        ),
      },
      {
        id: "net",
        header: () => <Label k="net" />,
        cell: ({ row }) => <Amount value={lineAmounts(row.original).net} />,
      },
      {
        id: "account",
        header: () => <Label k="account" />,
        cell: ({ row }) =>
          editable ? (
            <div className="min-w-52">
              <LookupChartOfAccountById
                value={row.original.dr_chart_of_accounts_id}
                onValueChange={(id) =>
                  onChange(row.original.key, { dr_chart_of_accounts_id: id })
                }
                error={
                  showErrors && !row.original.dr_chart_of_accounts_id
                    ? required
                    : undefined
                }
              />
            </div>
          ) : (
            <span className="whitespace-nowrap">
              {row.original.dr_account_code ?? "—"}
            </span>
          ),
      },
      {
        id: "cost_center",
        header: () => <Label k="costCenter" />,
        cell: ({ row }) =>
          editable ? (
            <div className="min-w-44">
              <LookupCostCenter
                value={row.original.dr_cost_center_id}
                onValueChange={(id) =>
                  onChange(row.original.key, { dr_cost_center_id: id })
                }
                modal={false}
              />
            </div>
          ) : (
            <span className="whitespace-nowrap">
              {row.original.dr_cost_center_code ?? "—"}
            </span>
          ),
      },
      {
        id: "vat_profile",
        header: () => <Label k="vat" />,
        cell: ({ row }) => (
          <TaxCell
            kind="vat"
            line={row.original}
            editable={editable}
            onChange={(patch) => onChange(row.original.key, patch)}
          />
        ),
      },
      {
        id: "vat_amount",
        header: () => <Label k="vatAmount" />,
        cell: ({ row }) => <Amount value={lineAmounts(row.original).vat} />,
      },
      {
        id: "wht_profile",
        header: () => <Label k="wht" />,
        cell: ({ row }) => (
          <TaxCell
            kind="wht"
            line={row.original}
            editable={editable}
            onChange={(patch) => onChange(row.original.key, patch)}
          />
        ),
      },
      {
        id: "total",
        header: () => <Label k="total" />,
        cell: ({ row }) => (
          <Amount
            value={lineAmounts(row.original).total}
            className="font-semibold"
          />
        ),
      },
    );
    if (editable)
      cols.push({
        id: "actions",
        header: () => null,
        cell: ({ row, table }) => (
          <RowActions
            first={row.index === 0}
            last={row.index === table.getRowModel().rows.length - 1}
            only={table.getRowModel().rows.length === 1}
            onUp={() => onMove(row.original.key, -1)}
            onDown={() => onMove(row.original.key, 1)}
            onRemove={() => onRemove(row.original.key)}
          />
        ),
      });
    return cols;
  }, [editable, deposit, hasGrn, showErrors, required, tc, onChange, onMove, onRemove]);

  return <ApDetailGrid rows={lines} columns={columns} empty={t("empty")} />;
}
