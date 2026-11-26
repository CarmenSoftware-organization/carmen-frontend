import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import {
  type ColumnDef,
  type ExpandedState,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronRight, Package } from "lucide-react";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { LineDimensionStrip } from "@/components/dimension/line-dimension-strip";
import { useGlDimensions } from "@/hooks/use-gl-dimensions";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { formatCurrency, round2 } from "@/lib/currency-utils";
import type { DimensionMaster } from "@/types/accounting-master";
import type { GroupPrPo, GroupPrProduct } from "@/types/purchase-order";

const noop = () => {};

/**
 * ชิป dimension แบบดูอย่างเดียวของบรรทัดที่กำลังจะสร้าง — สินค้าเดียวกันถูกแยกบรรทัดตามชุด dimension
 * ถ้าไม่แสดง ผู้ใช้จะเห็นสินค้าซ้ำหลายบรรทัดโดยไม่รู้ว่าต่างกันตรงไหน
 */
function ProductDimensions({
  product,
  master,
  rowLabel,
}: {
  product: GroupPrProduct;
  master: DimensionMaster[];
  rowLabel: string;
}) {
  const value = product.dimensions ?? [];
  const dimensions = master.filter((d) =>
    value.some((ref) => ref.dimension_id === d.id),
  );
  if (dimensions.length === 0) return null;
  return (
    <div className="mt-1">
      <LineDimensionStrip
        dimensions={dimensions}
        value={value}
        onChange={noop}
        readOnly
        rowLabel={rowLabel}
      />
    </div>
  );
}

function ExpandedProducts({
  products,
  currencyCode,
}: {
  products: GroupPrProduct[];
  currencyCode: string;
}) {
  const tfl = useTranslations("field");
  const hasDimensions = products.some((p) => (p.dimensions?.length ?? 0) > 0);
  const master = useGlDimensions(hasDimensions).data ?? [];

  return (
    <div className="max-w-2xl py-2 pl-16">
      <table className="w-full table-fixed text-xs">
        <thead>
          <tr className="bg-muted/40 text-muted-foreground border-b text-left text-xs font-semibold">
            <th scope="col" className="px-2 py-1 font-semibold">
              {tfl("product")}
            </th>
            <th scope="col" className="w-16 px-2 py-1 text-right font-semibold">
              {tfl("quantity")}
            </th>
            <th scope="col" className="w-28 px-2 py-1 text-right font-semibold">
              {tfl("price")} ({currencyCode})
            </th>
            <th scope="col" className="w-28 px-2 py-1 text-right font-semibold">
              {tfl("total")} ({currencyCode})
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, index) => (
            // สินค้าเดียวกันอาจมีหลายบรรทัด (แยกตาม location / dimension) — product_id อย่างเดียวซ้ำได้
            <tr
              key={`${p.product_id}-${index}`}
              className="border-b last:border-0"
            >
              <td className="px-2 py-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Package
                    className="text-muted-foreground size-3 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="truncate">{p.product_name}</span>
                </div>
                <ProductDimensions
                  product={p}
                  master={master}
                  rowLabel={String(index + 1)}
                />
              </td>
              <td className="px-2 py-1 text-right tabular-nums">{p.qty}</td>
              <td className="text-muted-foreground px-2 py-1 text-right tabular-nums">
                {formatCurrency(p.price_per_unit)}
              </td>
              <td className="text-foreground px-2 py-1 text-right font-medium tabular-nums">
                {formatCurrency(p.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StepReviewGroup({
  data,
  workflowName,
}: {
  readonly data: GroupPrPo[];
  readonly workflowName?: string;
}) {
  "use no memo";
  const t = useTranslations("procurement.purchaseOrder");
  const tfl = useTranslations("field");
  const { dateFormat, defaultCurrencyCode } = useProfile();
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const grandTotal = useMemo(
    () =>
      round2(
        data.reduce((sum, po) => {
          const docTotal = (po.products ?? []).reduce(
            (acc, p) => acc + (Number(p.total) || 0),
            0,
          );
          return sum + docTotal * (Number(po.exchange_rate) || 1);
        }, 0),
      ),
    [data],
  );

  const columns = useMemo<ColumnDef<GroupPrPo>[]>(
    () => [
      {
        id: "expander",
        size: 40,
        header: () => null,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={row.getToggleExpandedHandler()}
            aria-label={row.getIsExpanded() ? "Collapse" : "Expand"}
            className="flex items-center justify-center"
          >
            <ChevronRight
              className={`text-muted-foreground size-4 transition-transform ${row.getIsExpanded() ? "rotate-90" : ""}`}
            />
          </button>
        ),
        meta: {
          expandedContent: (po: GroupPrPo) => (
            <ExpandedProducts
              products={po.products}
              currencyCode={po.currency_code}
            />
          ),
        },
      },
      {
        id: "index",
        header: "#",
        size: 40,
        enableSorting: false,
        meta: {
          headerClassName: "text-center",
          cellClassName: "text-center text-muted-foreground tabular-nums",
        },
        cell: ({ row }) => row.index + 1,
      },
      { accessorKey: "pr", header: t("prRef") },
      { accessorKey: "vendor_name", header: tfl("vendor") },
      {
        accessorKey: "delivery_date",
        header: tfl("deliveryDate"),
        cell: ({ row }) =>
          formatDate(row.getValue("delivery_date"), dateFormat),
        meta: { cellClassName: "text-center", headerClassName: "text-center" },
      },
      {
        accessorKey: "total_price",
        header: tfl("total"),
        cell: ({ row }) => {
          const amount = row.getValue<number>("total_price");
          const currency = row.original.currency_code;
          if (amount == null) return <span></span>;
          return (
            <span className="font-medium tabular-nums">
              {formatCurrency(amount)}
              {currency && (
                <span className="text-muted-foreground ms-1 text-xs font-normal">
                  {currency}
                </span>
              )}
            </span>
          );
        },
        meta: { cellClassName: "text-right", headerClassName: "text-right" },
      },
    ],
    [t, tfl, dateFormat],
  );

  const table = useReactTable({
    data,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  });

  return (
    <div className="space-y-2">
      {workflowName && (
        <p className="text-muted-foreground text-xs">
          {t("workflowLabel")}:{" "}
          <span className="text-foreground font-medium">{workflowName}</span>
        </p>
      )}
      <DataGrid
        table={table}
        recordCount={data.length}
        tableLayout={{ headerSticky: true, rowBorder: true }}
      >
        <DataGridContainer scroll className="max-h-112">
          <DataGridTable />
        </DataGridContainer>
        {data.length > 0 && (
          <div className="border-border/60 flex items-center justify-end gap-2 border-t px-3 py-2 text-xs">
            <span className="text-muted-foreground">{tfl("grandTotal")}</span>
            <span className="font-semibold tabular-nums">
              {formatCurrency(grandTotal)}
            </span>
            <span className="text-muted-foreground">{defaultCurrencyCode}</span>
          </div>
        )}
      </DataGrid>
    </div>
  );
}
