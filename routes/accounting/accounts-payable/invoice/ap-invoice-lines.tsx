"use no memo";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Trash2, X, Pencil, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGlDimensions,
  useGlDimensionValues,
} from "@/hooks/use-gl-dimensions";
import type { ApInvoiceLine } from "@/types/accounts-payable";
import { useTranslations } from "use-intl";
import { LookupChartOfAccountById } from "@/components/lookup/lookup-chart-of-account-by-id";
import { LookupCostCenter } from "@/components/lookup/lookup-cost-center";
import { LookupProduct } from "@/components/lookup/lookup-product";
import { LookupTaxProfile } from "@/components/lookup/lookup-tax-profile";
import { LookupUnit } from "@/components/lookup/lookup-unit";
import { Button } from "@/components/ui/button";
import { IncVatToggle, PriceWithIncVat } from "@/components/share/inc-vat";
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
  isTaxIncluded = false,
}: {
  readonly value: string;
  readonly editable: boolean;
  readonly label: string;
  readonly onChange: (value: string) => void;
  /** โหมดอ่าน: ป้าย Inc VAT หน้าตัวเลข (แถวเดียวกัน ทศนิยมตรงกับแถวอื่น) */
  readonly isTaxIncluded?: boolean;
}) {
  const format = useAmountFormatter();
  if (!editable)
    return (
      <span className="flex justify-end">
        <PriceWithIncVat isTaxIncluded={isTaxIncluded}>
          {format(Number(value || 0))}
        </PriceWithIncVat>
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
  onChange,
  onMove,
  onRemove,
  savedLines,
}: {
  readonly lines: InvoiceFormLine[];
  readonly deposit: boolean;
  readonly editable: boolean;
  readonly showErrors: boolean;
  readonly onChange: (key: string, patch: Patch) => void;
  readonly onMove: (key: string, direction: -1 | 1) => void;
  readonly onRemove: (key: string) => void;
  readonly savedLines?: ApInvoiceLine[];
}) {
  const t = useTranslations("accounting.accountsPayable.invoice.detail.lines");
  const ui = useTranslations("accounting.accountsPayable.ui");
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const detail = lines.find((line) => line.key === detailKey);
  const hasGrn = lines.some((line) => line.grn_no);

  // columns ต้อง memoize และไม่พึ่งค่าที่เปลี่ยนทุก render (formatter/t) ไม่งั้น cell remount แล้ว input เสีย focus
  const columns = useMemo<ColumnDef<InvoiceFormLine>[]>(() => {
    const cols: ColumnDef<InvoiceFormLine>[] = [];
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
              isTaxIncluded={!deposit && row.original.vat_is_included}
              onChange={(unit_price) =>
                onChange(row.original.key, { unit_price })
              }
            />
            {/* Inc VAT — แก้ได้เท่ากับช่องราคา · deposit ไม่มี flag (BE ปฏิเสธ) */}
            {!deposit && editable && (
              <IncVatToggle
                checked={row.original.vat_is_included}
                onCheckedChange={(vat_is_included) =>
                  onChange(row.original.key, { vat_is_included })
                }
              />
            )}
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
    return cols;
  }, [editable, deposit, hasGrn, onChange]);

  const compact = columns.filter((column) =>
    [
      "grn",
      "description",
      "unit",
      "quantity",
      "unit_price",
      "discount",
      "net",
      "total",
    ].includes(column.id ?? ""),
  );
  const savedById = new Map((savedLines ?? []).map((line) => [line.id, line]));
  const totalIndexBeforeTax = compact.findIndex(
    (column) => column.id === "total",
  );
  compact[totalIndexBeforeTax] = {
    ...compact[totalIndexBeforeTax],
    id: "total",
    header: () => `${ui("total")} / ${ui("unpaid")}`,
  };
  const totalColumn = compact[totalIndexBeforeTax];
  if (totalColumn)
    totalColumn.cell = ({ row }) => (
      <div className="space-y-1">
        <Amount
          value={lineAmounts(row.original).total}
          className="font-semibold"
        />
        <Amount
          value={
            !editable
              ? (savedById.get(row.original.key)?.unpaid_amount ??
                lineAmounts(row.original).total)
              : lineAmounts(row.original).total
          }
          className="text-micro text-muted-foreground"
        />
      </div>
    );
  const totalIndex = compact.findIndex((column) => column.id === "total");
  compact.splice(totalIndex, 0, {
    id: "tax",
    header: () => ui("taxSummary"),
    cell: ({ row }) => (
      <div className="text-right text-xs tabular-nums">
        <Amount
          value={lineAmounts(row.original).vat}
          className="text-success-ink"
        />
        <span className="text-micro text-muted-foreground">
          {t("wht")} {lineAmounts(row.original).wht}
        </span>
      </div>
    ),
  });
  compact.splice(4, 0, {
    id: "subtotal",
    header: () => ui("subtotal"),
    cell: ({ row }) => <Amount value={lineAmounts(row.original).subtotal} />,
  });
  compact.push({
    id: "detail",
    header: () => null,
    cell: ({ row }) => (
      <div className="flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`${ui(editable ? "editItem" : "viewItem")} ${row.index + 1}`}
          onClick={() => setDetailKey(row.original.key)}
        >
          {editable ? (
            <Pencil className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </Button>
        {editable && (
          <RowActions
            first={row.index === 0}
            last={row.index === lines.length - 1}
            only={lines.length === 1}
            onUp={() => onMove(row.original.key, -1)}
            onDown={() => onMove(row.original.key, 1)}
            onRemove={() => onRemove(row.original.key)}
          />
        )}
      </div>
    ),
  });
  return (
    <>
      <ApDetailGrid
        rows={lines}
        columns={compact.map((column) => ({
          ...column,
          meta: { ...column.meta, cellClassName: "align-top" },
        }))}
        empty={t("empty")}
      />
      {detail && (
        <InvoiceLineDialog
          line={detail}
          editable={editable}
          deposit={deposit}
          onChange={(patch) => onChange(detail.key, patch)}
          onClose={() => setDetailKey(null)}
        />
      )}
    </>
  );
}

function InvoiceLineDialog({
  line,
  editable,
  deposit,
  onChange,
  onClose,
}: {
  readonly line: InvoiceFormLine;
  readonly editable: boolean;
  readonly deposit: boolean;
  readonly onChange: (patch: Patch) => void;
  readonly onClose: () => void;
}) {
  const ui = useTranslations("accounting.accountsPayable.ui");
  const t = useTranslations("accounting.accountsPayable.invoice.detail.lines");
  const [dimensionsOpen, setDimensionsOpen] = useState(false);
  const amounts = lineAmounts(line);
  const carry = (patch: Partial<NonNullable<InvoiceFormLine["carry"]>>) =>
    onChange({ carry: { ...line.carry, ...patch } });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{ui("itemDetail")}</DialogTitle>
        </DialogHeader>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setDimensionsOpen(!dimensionsOpen)}
        >
          {ui("dimensions")} · {line.carry?.dimensions?.length ?? 0}
        </Button>
        {dimensionsOpen && (
          <InvoiceDimensions
            line={line}
            editable={editable}
            onChange={onChange}
          />
        )}
        <fieldset disabled={!editable} className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{ui("expense")}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>{t("product")}</FieldLabel>
                <LookupProduct
                  value={line.product_id ?? ""}
                  defaultLabel={line.product_name ?? undefined}
                  onValueChange={(id, product) =>
                    onChange({
                      product_id: id || null,
                      product_name: product?.name ?? null,
                      description: line.description || product?.name || "",
                    })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ap-item-description">
                  {t("description")}
                </FieldLabel>
                <Input
                  id="ap-item-description"
                  value={line.description}
                  onChange={(event) =>
                    onChange({ description: event.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel>{ui("account")}</FieldLabel>
                <LookupChartOfAccountById
                  value={line.dr_chart_of_accounts_id}
                  onValueChange={(id) =>
                    onChange({ dr_chart_of_accounts_id: id })
                  }
                />
              </Field>
              <Field>
                <FieldLabel>{ui("costCenter")}</FieldLabel>
                <LookupCostCenter
                  modal
                  value={line.dr_cost_center_id}
                  onValueChange={(id) => onChange({ dr_cost_center_id: id })}
                />
              </Field>
              <Field>
                <FieldLabel>{ui("netAmount")}</FieldLabel>
                <Amount value={amounts.net} />
              </Field>
            </div>
          </section>
          <section className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold">{ui("inputTax")}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>{t("vatProfile")}</FieldLabel>
                <TaxCell
                  kind="vat"
                  line={line}
                  editable={editable}
                  onChange={onChange}
                />
              </Field>
              <Field>
                <FieldLabel>{t("vatAmount")}</FieldLabel>
                <Amount value={amounts.vat} />
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={line.vat_is_override}
                    onCheckedChange={(checked) =>
                      onChange({
                        vat_is_override: checked === true,
                        vat_amount: amounts.vat,
                      })
                    }
                  />
                  {ui("vatOverride")}
                </label>
                {line.vat_is_override && (
                  <DecimalCell
                    label={t("vatAmount")}
                    value={line.vat_amount}
                    editable={editable}
                    onChange={(vat_amount) => onChange({ vat_amount })}
                  />
                )}
              </Field>
              <Field>
                <FieldLabel>{ui("taxAccount")}</FieldLabel>
                <LookupChartOfAccountById
                  value={line.carry?.vat_chart_of_accounts_id ?? null}
                  onValueChange={(id) =>
                    carry({ vat_chart_of_accounts_id: id })
                  }
                />
              </Field>
              <Field>
                <FieldLabel>{ui("taxCostCenter")}</FieldLabel>
                <LookupCostCenter
                  modal
                  value={line.carry?.vat_cost_center_id ?? null}
                  onValueChange={(id) => carry({ vat_cost_center_id: id })}
                />
              </Field>
              <Field>
                <FieldLabel>{t("whtProfile")}</FieldLabel>
                <TaxCell
                  kind="wht"
                  line={line}
                  editable={editable}
                  onChange={onChange}
                />
              </Field>
              {!deposit && (
                <Field>
                  <FieldLabel>{t("unitPrice")}</FieldLabel>
                  <IncVatToggle
                    checked={line.vat_is_included}
                    onCheckedChange={(vat_is_included) =>
                      onChange({ vat_is_included })
                    }
                  />
                </Field>
              )}
            </div>
          </section>
          <section className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold">{ui("accountPayable")}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>{ui("apAccount")}</FieldLabel>
                <LookupChartOfAccountById
                  value={line.carry?.cr_chart_of_accounts_id ?? null}
                  onValueChange={(id) => carry({ cr_chart_of_accounts_id: id })}
                />
              </Field>
              <Field>
                <FieldLabel>{ui("apCostCenter")}</FieldLabel>
                <LookupCostCenter
                  modal
                  value={line.carry?.cr_cost_center_id ?? null}
                  onValueChange={(id) => carry({ cr_cost_center_id: id })}
                />
              </Field>
              <Field>
                <FieldLabel>{ui("total")}</FieldLabel>
                <Amount value={amounts.total} />
              </Field>
            </div>
          </section>
        </fieldset>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {ui("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceDimensions({
  line,
  editable,
  onChange,
}: {
  readonly line: InvoiceFormLine;
  readonly editable: boolean;
  readonly onChange: (patch: Patch) => void;
}) {
  const ui = useTranslations("accounting.accountsPayable.ui");
  const dimensions = useGlDimensions();
  const values = useGlDimensionValues();
  const selected = line.carry?.dimensions ?? [];
  if (dimensions.isError || values.isError)
    return (
      <div role="alert" className="text-destructive text-xs">
        {ui("dimensionLoadError")}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            void dimensions.refetch();
            void values.refetch();
          }}
        >
          {ui("retry")}
        </Button>
      </div>
    );
  return (
    <div className="grid gap-3 border-b pb-4 sm:grid-cols-2">
      {(dimensions.data ?? [])
        .filter(
          (dimension) =>
            dimension.is_active ||
            selected.some((item) => item.gl_dimension_id === dimension.id),
        )
        .map((dimension) => {
          const value = selected.find(
            (item) => item.gl_dimension_id === dimension.id,
          )?.gl_dimension_value_id;
          return (
            <Field key={dimension.id}>
              <FieldLabel>{dimension.name}</FieldLabel>
              <Select
                value={value ?? "__none__"}
                disabled={!editable || dimensions.isLoading || values.isLoading}
                onValueChange={(id) => {
                  const next = selected.filter(
                    (item) => item.gl_dimension_id !== dimension.id,
                  );
                  if (id !== "__none__")
                    next.push({
                      gl_dimension_id: dimension.id,
                      gl_dimension_value_id: id,
                    });
                  onChange({ carry: { ...line.carry, dimensions: next } });
                }}
              >
                <SelectTrigger size="sm" aria-label={dimension.name}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{ui("noDimension")}</SelectItem>
                  {(values.data ?? [])
                    .filter(
                      (item) =>
                        item.dimension_id === dimension.id &&
                        (item.is_active || item.id === value),
                    )
                    .map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.code} · {item.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
          );
        })}
    </div>
  );
}
