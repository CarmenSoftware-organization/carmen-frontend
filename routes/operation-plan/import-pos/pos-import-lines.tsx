import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { columnSkeletons } from "@/components/ui/data-grid/columns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EmptyComponent from "@/components/empty-component";
import { ErrorState } from "@/components/ui/error-state";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { setURLParams } from "@/hooks/use-url";
import type { PosImportLine } from "@/types/pos-sale";
import { usePosImport } from "../shared/use-pos-sale";

interface LineRow extends PosImportLine {
  store_name: string;
  outlet_name: string;
}

/**
 * บรรทัดยอดขายดิบของการนำเข้าหนึ่งรายการ — อ่านอย่างเดียว ค้นหา/แบ่งหน้าฝั่ง client
 * (ไม่มีสถานะ mapping — การผูกเมนูอยู่ที่ Sales Consumption)
 *
 * @param importId id ของการนำเข้าที่เลือก
 * @returns React element ของตารางบรรทัด
 */
export function PosImportLines({ importId }: { importId: string }) {
  "use no memo";
  const t = useTranslations("operationPlan.importPos.lines");
  const { data, isLoading, error, refetch } = usePosImport(importId);
  const formatAmount = useAmountFormatter();
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  const rows = useMemo<LineRow[]>(() => {
    if (!data) return [];
    const outlets = new Map(data.outlets.map((o) => [o.id, o]));
    const q = search.trim().toLowerCase();
    return data.lines
      .map((l) => {
        const o = outlets.get(l.outlet_id);
        return {
          ...l,
          store_name: data.store?.store_name ?? "",
          outlet_name: o ? `${o.code} ${o.name}` : "",
        };
      })
      .filter(
        (r) =>
          !q ||
          [r.item.code, r.item.desc1, r.item.desc2 ?? "", r.outlet_name].some(
            (v) => v.toLowerCase().includes(q),
          ),
      );
  }, [data, search]);

  const columns = useMemo<ColumnDef<LineRow>[]>(
    () => [
      {
        id: "store",
        header: t("columns.store"),
        cell: ({ row }) => row.original.store_name,
        enableSorting: false,
        meta: { skeleton: columnSkeletons.text },
      },
      {
        id: "outlet",
        header: t("columns.outlet"),
        cell: ({ row }) => row.original.outlet_name,
        enableSorting: false,
        meta: { skeleton: columnSkeletons.text },
      },
      {
        id: "item_code",
        header: t("columns.itemCode"),
        cell: ({ row }) => row.original.item.code,
        enableSorting: false,
        meta: { skeleton: columnSkeletons.textShort },
      },
      {
        id: "item",
        header: t("columns.item"),
        cell: ({ row }) => row.original.item.desc1,
        enableSorting: false,
        meta: { skeleton: columnSkeletons.text },
      },
      {
        id: "qty",
        header: t("columns.qty"),
        cell: ({ row }) => row.original.qty,
        enableSorting: false,
        meta: {
          headerClassName: "text-right",
          cellClassName: "text-right tabular-nums",
          skeleton: columnSkeletons.number,
        },
      },
      {
        id: "unit_price",
        header: t("columns.unitPrice"),
        cell: ({ row }) => formatAmount(row.original.unit_price),
        enableSorting: false,
        meta: {
          headerClassName: "text-right",
          cellClassName: "text-right tabular-nums",
          skeleton: columnSkeletons.number,
        },
      },
      {
        id: "total",
        header: t("columns.total"),
        cell: ({ row }) => formatAmount(row.original.total),
        enableSorting: false,
        meta: {
          headerClassName: "text-right",
          cellClassName: "text-right tabular-nums",
          skeleton: columnSkeletons.number,
        },
      },
    ],
    [t, formatAmount],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { pagination },
    onPaginationChange: setPagination,
    autoResetPageIndex: true,
  });

  if (error) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  return (
    <section aria-label={t("title")} className="space-y-3 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-medium">
          {t("title")}
          {data && (
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {data.file_name}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            className="h-8 w-full sm:w-64"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("close")}
            onClick={() => setURLParams({ import: "" })}
          >
            <X />
          </Button>
        </div>
      </div>
      <DataGrid
        table={table}
        recordCount={rows.length}
        isLoading={isLoading}
        tableLayout={{ headerSticky: true }}
        emptyMessage={<EmptyComponent />}
      >
        <DataGridContainer className="flex flex-col">
          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>
          <DataGridPagination sizes={[10, 20, 50, 100]} />
        </DataGridContainer>
      </DataGrid>
    </section>
  );
}
