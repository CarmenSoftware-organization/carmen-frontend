import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import {
  indexColumn,
  columnSkeletons,
} from "@/components/ui/data-grid/columns";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency } from "@/lib/currency-utils";
import type { WastageItem } from "@/types/wastage-reporting";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { ExpiryUrgency } from "./expiry-urgency";

interface UseWastageReportTableOptions {
  items: WastageItem[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onOpenGrn: (item: WastageItem) => void;
}

export function useWastageReportTable({
  items,
  totalRecords,
  params,
  tableConfig,
  onOpenGrn,
}: UseWastageReportTableOptions) {
  "use no memo";
  const tfl = useTranslations("field");
  const isMobile = useIsMobile() === true;

  const dataColumns: ColumnDef<WastageItem>[] = [
    {
      // วันหมดอายุ + เหลือกี่วัน + สถานะ รวมเป็นคอลัมน์เดียว (ดู ExpiryUrgency)
      // วางหน้าสุดเพราะ backend เรียงตามคอลัมน์นี้เสมอ — ไม่เปิด sort ให้กดเพราะ
      // endpoint ไม่รับ `sort` กดแล้วไม่มีอะไรเปลี่ยน
      id: "expiry",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("expiryDate")} />
      ),
      cell: ({ row }) => (
        <ExpiryUrgency
          daysToExpiry={row.original.days_to_expiry}
          expiredAt={row.original.expired_at}
        />
      ),
      enableSorting: false,
      meta: { skeleton: columnSkeletons.text },
      size: 140,
    },
    {
      id: "product",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("product")} />
      ),
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate" title={row.original.product_name}>
            {row.original.product_name}
          </p>
          {row.original.product_local_name && (
            <p
              className="text-muted-foreground truncate text-xs"
              title={row.original.product_local_name}
            >
              {row.original.product_local_name}
            </p>
          )}
        </div>
      ),
      enableSorting: false,
      meta: { skeleton: columnSkeletons.text },
      size: 200,
    },
    {
      id: "location",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("location")} />
      ),
      cell: ({ row }) => (
        <span className="truncate">
          <span className="text-muted-foreground mr-1.5">
            {row.original.location_code}
          </span>
          {row.original.location_name}
        </span>
      ),
      enableSorting: false,
      meta: { skeleton: columnSkeletons.text },
      size: 160,
    },
    {
      accessorKey: "lot_no",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("lotNo")} />
      ),
      enableSorting: false,
      meta: { skeleton: columnSkeletons.text },
      size: 150,
    },
    {
      accessorKey: "grn_no",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("grnNo")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onOpenGrn(row.original)}>
          {row.getValue("grn_no")}
        </CellAction>
      ),
      enableSorting: false,
      meta: { skeleton: columnSkeletons.text },
      size: 130,
    },
    {
      accessorKey: "remaining_qty",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("remainingQty")}
          className="justify-end"
        />
      ),
      cell: ({ row }) => (
        <span>
          {row.original.remaining_qty}
          <span className="text-muted-foreground ms-1 text-xs">
            {row.original.inventory_unit.name}
          </span>
        </span>
      ),
      enableSorting: false,
      size: 100,
      meta: {
        cellClassName: "text-right tabular-nums",
        skeleton: columnSkeletons.text,
      },
    },
    {
      accessorKey: "cost_per_unit",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("costPerUnit")}
          className="justify-end"
        />
      ),
      cell: ({ row }) => formatCurrency(row.getValue<number>("cost_per_unit")),
      enableSorting: false,
      size: 100,
      meta: {
        cellClassName: "text-right tabular-nums",
        skeleton: columnSkeletons.text,
      },
    },
    {
      accessorKey: "remaining_value",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("remainingValue")}
          className="justify-end"
        />
      ),
      // ยอดเงินหลักของแถว — หนักเท่า Total Amount ในตาราง GRN
      cell: ({ row }) => (
        <span className="font-medium">
          {formatCurrency(row.getValue<number>("remaining_value"))}
        </span>
      ),
      enableSorting: false,
      size: 110,
      meta: {
        cellClassName: "text-right tabular-nums",
        skeleton: columnSkeletons.text,
      },
    },
  ];

  // จอเล็ก 9 คอลัมน์บีบจนอ่านไม่ออก — เหลือเซลล์เดียวสามบรรทัด: สินค้า · มูลค่า /
  // ความเร่งด่วน · คงเหลือ / คลัง · ล็อต · GRN (แนวเดียวกับ stock-replenishment)
  const compactColumn: ColumnDef<WastageItem> = {
    id: "compact",
    header: tfl("product"),
    cell: ({ row }) => {
      const it = row.original;
      return (
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 truncate" title={it.product_name}>
              {it.product_name}
            </p>
            <span className="shrink-0 font-semibold tabular-nums">
              {formatCurrency(it.remaining_value)}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="min-w-0 flex-1">
              <ExpiryUrgency
                variant="inline"
                daysToExpiry={it.days_to_expiry}
                expiredAt={it.expired_at}
              />
            </div>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {it.remaining_qty} {it.inventory_unit.name}
            </span>
          </div>
          <div className="text-muted-foreground text-micro flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate">
              {it.location_name} · {it.lot_no}
            </span>
            <CellAction
              onClick={() => onOpenGrn(it)}
              className="ml-auto shrink-0"
            >
              {it.grn_no}
            </CellAction>
          </div>
        </div>
      );
    },
    enableSorting: false,
  };

  const allColumns: ColumnDef<WastageItem>[] = isMobile
    ? [compactColumn]
    : [indexColumn<WastageItem>(params), ...dataColumns];

  return useReactTable({
    data: items,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.grn_detail_item_id,
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / (Number(params.perpage) || 10)),
  });
}
