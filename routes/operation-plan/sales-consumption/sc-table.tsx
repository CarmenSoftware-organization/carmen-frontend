import { useMemo } from "react";
import { Link } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { columnSkeletons } from "@/components/ui/data-grid/columns";
import { StatusDotBadge, type DotTone } from "@/components/ui/status-dot-badge";
import EmptyComponent from "@/components/empty-component";
import { ErrorState } from "@/components/ui/error-state";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { ScListItem, ScStatus } from "@/types/sales-consumption";
import { useSalesConsumptions } from "./use-sales-consumption";

const STATUS_TONE: Record<ScStatus, DotTone> = {
  pending: "warning",
  posted: "success",
  voided: "neutral",
};

const RIGHT = {
  headerClassName: "text-right",
  cellClassName: "text-right tabular-nums",
  skeleton: columnSkeletons.number,
};

/**
 * ตาราง Sales Consumption รายวัน — server-side pagination ล่าสุดก่อน
 *
 * @returns React element ของตาราง
 */
export function ScTable() {
  "use no memo";
  const t = useTranslations("operationPlan.salesConsumption.list.table");
  const tStatus = useTranslations("operationPlan.salesConsumption.list.status");
  const { dateFormat } = useProfile();
  const formatAmount = useAmountFormatter();
  const { params, tableConfig } = useDataGridState({ defaultPerpage: 20 });
  const { data, isLoading, error, refetch } = useSalesConsumptions({
    page: params.page,
    perpage: params.perpage,
  });

  const items = useMemo(() => data?.data ?? [], [data]);
  const totalRecords = data?.paginate?.total ?? 0;

  const columns = useMemo<ColumnDef<ScListItem>[]>(
    () => [
      {
        id: "sc_no",
        header: t("columns.docNo"),
        cell: ({ row }) => (
          <Link
            to={`/operation-plan/sales-consumption/${row.original.id}`}
            className="text-primary hover:underline"
          >
            {row.original.sc_no}
          </Link>
        ),
        enableSorting: false,
        meta: { skeleton: columnSkeletons.textShort },
      },
      {
        id: "sale_date",
        header: t("columns.saleDate"),
        // sale_date เป็นวันล้วน (YYYY-MM-DD) — ใส่เวลาท้องถิ่นกันวันเลื่อนตามโซนเวลา
        cell: ({ row }) =>
          formatDate(
            `${row.original.sale_date.slice(0, 10)}T00:00:00`,
            dateFormat,
          ),
        enableSorting: false,
        meta: { skeleton: columnSkeletons.text },
      },
      {
        id: "import_count",
        header: t("columns.imports"),
        cell: ({ row }) => row.original.import_count,
        enableSorting: false,
        meta: RIGHT,
      },
      {
        id: "locations",
        header: t("columns.locations"),
        cell: ({ row }) => row.original.location_codes.join(", ") || "–",
        enableSorting: false,
        meta: { skeleton: columnSkeletons.text },
      },
      {
        id: "status",
        header: t("columns.status"),
        cell: ({ row }) => (
          <StatusDotBadge tone={STATUS_TONE[row.original.status]}>
            {tStatus(row.original.status)}
          </StatusDotBadge>
        ),
        enableSorting: false,
        meta: { skeleton: columnSkeletons.badge },
      },
      {
        id: "line_count",
        header: t("columns.lines"),
        cell: ({ row }) => row.original.line_count,
        enableSorting: false,
        meta: RIGHT,
      },
      {
        id: "unresolved_count",
        header: t("columns.needMapping"),
        cell: ({ row }) =>
          row.original.unresolved_count > 0 ? (
            <span className="text-warning-ink">
              {row.original.unresolved_count}
            </span>
          ) : (
            0
          ),
        enableSorting: false,
        meta: RIGHT,
      },
      {
        id: "total_cost",
        header: t("columns.totalCost"),
        cell: ({ row }) =>
          row.original.total_cost == null
            ? "–"
            : formatAmount(row.original.total_cost),
        enableSorting: false,
        meta: RIGHT,
      },
      {
        id: "stock_outs",
        header: t("columns.stockOut"),
        cell: ({ row }) =>
          row.original.stock_outs
            .map((s) => s.so_no ?? "")
            .filter(Boolean)
            .join(", ") || "–",
        enableSorting: false,
        meta: { skeleton: columnSkeletons.text },
      },
    ],
    [t, tStatus, dateFormat, formatAmount],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / Number(params.perpage)),
  });

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <DataGrid
      table={table}
      recordCount={totalRecords}
      isLoading={isLoading}
      tableLayout={{ headerSticky: true }}
      emptyMessage={<EmptyComponent />}
    >
      <DataGridContainer className="flex flex-col">
        <DataGridScrollArea>
          <DataGridTable />
        </DataGridScrollArea>
        <DataGridPagination sizes={[20, 50, 100]} />
      </DataGridContainer>
    </DataGrid>
  );
}
