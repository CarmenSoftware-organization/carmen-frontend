import type { UseFormReturn } from "react-hook-form";
import type { ColumnDef } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PriceList } from "@/types/price-list";
import type { PriceListFormValues } from "./pl-form-schema";
import {
  LeadCell,
  MoqCell,
  PreferredCell,
  PriceCell,
  ProductCell,
  TaxAmountCell,
  TaxRateCell,
  TotalCell,
  TaxCell,
  UnitCell,
  type DetailField,
} from "./pl-item-cells";

interface BuildColumnsOptions {
  readonly form: UseFormReturn<PriceListFormValues>;
  readonly detailRefs?: PriceList["pricelist_detail"];
  readonly isView: boolean;
  readonly isDisabled: boolean;
  readonly onRequestRemove: (idx: number) => void;
  readonly tfl: (key: string) => string;
  readonly removeLabel: string;
  readonly confirmDuplicate: (action: () => void, productName?: string) => void;
}

export function buildPlItemColumns({
  form,
  detailRefs,
  isView,
  isDisabled,
  onRequestRemove,
  tfl,
  removeLabel,
  confirmDuplicate,
}: BuildColumnsOptions): ColumnDef<DetailField>[] {
  const cols: ColumnDef<DetailField>[] = [
    {
      id: "index",
      size: 60,
      header: () => "#",
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {row.index + 1}
        </span>
      ),
      meta: { headerClassName: "text-center", cellClassName: "text-center" },
    },
    {
      id: "product",
      header: () => tfl("product"),
      size: 300,
      cell: ({ row }) => (
        <ProductCell
          form={form}
          index={row.index}
          isView={isView}
          isDisabled={isDisabled}
          detailRef={detailRefs?.[row.index]}
          confirmDuplicate={confirmDuplicate}
        />
      ),
    },
    {
      id: "unit",
      header: () => tfl("unit"),
      cell: ({ row }) => (
        <UnitCell
          form={form}
          index={row.index}
          isView={isView}
          isDisabled={isDisabled}
          detailRef={detailRefs?.[row.index]}
        />
      ),
      meta: { headerClassName: "text-center", cellClassName: "text-center" },
    },
    {
      id: "moq",
      size: 128,
      header: () => tfl("moq"),
      cell: ({ row }) => (
        <MoqCell
          form={form}
          index={row.index}
          isView={isView}
          isDisabled={isDisabled}
          detailRef={detailRefs?.[row.index]}
        />
      ),
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
    },
    {
      id: "price",
      size: 128,
      header: () => tfl("price"),
      cell: ({ row }) => (
        <PriceCell
          form={form}
          index={row.index}
          isView={isView}
          isDisabled={isDisabled}
          detailRef={detailRefs?.[row.index]}
        />
      ),
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
    },
    {
      id: "tax_profile",
      header: () => tfl("taxProfile"),
      cell: ({ row }) => (
        <TaxCell
          form={form}
          index={row.index}
          isView={isView}
          isDisabled={isDisabled}
          detailRef={detailRefs?.[row.index]}
        />
      ),
    },
    {
      id: "tax_rate",
      size: 96,
      header: () => tfl("taxRate"),
      cell: ({ row }) => (
        <TaxRateCell
          form={form}
          index={row.index}
          isView={isView}
          isDisabled={isDisabled}
          detailRef={detailRefs?.[row.index]}
        />
      ),
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
    },
    {
      id: "tax_amount",
      size: 96,
      header: () => tfl("tax"),
      cell: ({ row }) => (
        <TaxAmountCell
          form={form}
          index={row.index}
          isView={isView}
          isDisabled={isDisabled}
          detailRef={detailRefs?.[row.index]}
        />
      ),
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
    },
    {
      id: "lead",
      size: 96,
      header: () => tfl("leadTime"),
      cell: ({ row }) => (
        <LeadCell
          form={form}
          index={row.index}
          isView={isView}
          isDisabled={isDisabled}
          detailRef={detailRefs?.[row.index]}
        />
      ),
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
    },
    {
      id: "total",
      size: 120,
      header: () => tfl("total"),
      cell: ({ row }) => (
        <TotalCell
          form={form}
          index={row.index}
          isView={isView}
          isDisabled={isDisabled}
          detailRef={detailRefs?.[row.index]}
        />
      ),
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
    },
    {
      id: "preferred",
      size: 96,
      header: () => tfl("preferred"),
      cell: ({ row }) => (
        <PreferredCell
          form={form}
          index={row.index}
          isView={isView}
          isDisabled={isDisabled}
          detailRef={detailRefs?.[row.index]}
        />
      ),
      meta: { headerClassName: "text-center", cellClassName: "text-center" },
    },
  ];

  if (!isView) {
    cols.push({
      id: "actions",
      size: 60,
      header: () => null,
      cell: ({ row }) =>
        isDisabled ? null : (
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label={removeLabel}
            onClick={() => onRequestRemove(row.index)}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
          >
            <Trash2 />
          </Button>
        ),
      meta: { headerClassName: "text-center", cellClassName: "text-center" },
    });
  }

  return cols;
}
