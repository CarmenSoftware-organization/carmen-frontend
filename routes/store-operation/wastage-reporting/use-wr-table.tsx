import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import {
  indexColumn,
  columnSkeletons,
} from "@/components/ui/data-grid/columns";
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
  /** ความกว้างของกล่องตาราง (px) — `undefined` = ยังไม่ได้วัด ใช้ตารางเต็ม */
  containerWidth?: number;
}

/**
 * ขั้นของตารางตามความกว้างกล่อง (ไม่ใช่ของจอ — sidebar พับ/กางได้) · หน้าใช้ `compact`
 * ตัดสิน rowClamp ด้วย จึง export ให้ใช้เกณฑ์เดียวกัน
 *
 * สินค้ารับที่เหลือ (`meta.grow`) คอลัมน์อื่นกว้างคงที่ — เดิมแบ่งสัดส่วน ที่ tablet หัว
 * Remaining Qty / Cost/Unit ล้นเซลล์ ส่วนบน Full HD คอลัมน์ห่างกันเกินจำเป็น
 * ไม่มีคอลัมน์ select ผลรวม `size` จึงเท่ากับความกว้างขั้นต่ำจริง:
 *   ครบ                60+140+200+160+120+130+130+100+140 = 1180
 *   ไม่มีเลขลำดับ                                         = 1120
 *   ไม่มีต้นทุนต่อหน่วย                                     = 1020
 *   ไม่มีล็อต                                             = 900
 *   ไม่มีคลัง                                             = 740
 *   ต่ำกว่านั้น       เซลล์เดียวสามบรรทัด (compact)
 * จุดเปลี่ยนขั้นตั้งสูงกว่าผลรวม 35px · ของที่ซ่อนยังเห็น: ต้นทุนต่อหน่วย = มูลค่า ÷ คงเหลือ
 * (และอยู่ใน GRN) · คลัง/ล็อตลงบรรทัดรองใต้สินค้า
 */
export function wrTableTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return {
    compact: w < 750,
    showIndex: w >= 1215,
    showCost: w >= 1155,
    showLot: w >= 1055,
    showLocation: w >= 935,
  };
}

export function useWastageReportTable({
  items,
  totalRecords,
  params,
  tableConfig,
  onOpenGrn,
  containerWidth,
}: UseWastageReportTableOptions) {
  "use no memo";
  const tfl = useTranslations("field");
  const { compact, showIndex, showCost, showLot, showLocation } =
    wrTableTier(containerWidth);

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
      // กล่องแคบ: คลัง/ล็อตที่ถูกซ่อนต่อท้ายชื่อท้องถิ่นในบรรทัดเดียวกัน — ไม่เพิ่มบรรทัดที่สาม
      // เพราะ rowClamp ตัดเซลล์ไว้สองบรรทัด
      cell: ({ row }) => {
        const it = row.original;
        const secondary = [
          it.product_local_name,
          showLocation
            ? undefined
            : [it.location_code, it.location_name].filter(Boolean).join(" "),
          showLot ? undefined : it.lot_no,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <div className="min-w-0">
            <p className="truncate" title={it.product_name}>
              {it.product_name}
            </p>
            {secondary && (
              <p
                className="text-muted-foreground truncate text-xs"
                title={secondary}
              >
                {secondary}
              </p>
            )}
          </div>
        );
      },
      enableSorting: false,
      meta: { skeleton: columnSkeletons.text, grow: true },
      size: 200,
    },
    {
      id: "location",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("location")} />
      ),
      cell: ({ row }) => (
        <span className="block truncate">
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
      size: 120,
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
      size: 130,
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
      size: 140,
      meta: {
        cellClassName: "text-right tabular-nums",
        skeleton: columnSkeletons.text,
      },
    },
  ];

  // กล่องแคบ 9 คอลัมน์บีบจนอ่านไม่ออก — เหลือเซลล์เดียวสามบรรทัด: สินค้า · มูลค่า /
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

  // ซ่อนผ่านรายการคอลัมน์ ไม่ใช่ CSS — ความกว้างขั้นต่ำของตารางที่มีคอลัมน์ยืดคิดจากทุกคอลัมน์
  // ที่ TanStack ถือว่ามองเห็น
  const hidden = new Set([
    ...(showCost ? [] : ["cost_per_unit"]),
    ...(showLot ? [] : ["lot_no"]),
    ...(showLocation ? [] : ["location"]),
  ]);
  const visibleDataColumns = dataColumns.filter((c) => {
    const key =
      c.id ?? ("accessorKey" in c ? String(c.accessorKey) : undefined);
    return !key || !hidden.has(key);
  });

  const allColumns: ColumnDef<WastageItem>[] = compact
    ? [compactColumn]
    : [
        ...(showIndex ? [indexColumn<WastageItem>(params)] : []),
        ...visibleDataColumns,
      ];

  return useReactTable({
    data: items,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.grn_detail_item_id,
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / (Number(params.perpage) || 10)),
  });
}
