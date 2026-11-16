import { useConfigTableLayout } from "../shared/use-config-list-table";
import { useMemo } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import {
  actionColumn,
  auditColumns,
  columnSkeletons,
  indexColumn,
} from "@/components/ui/data-grid/columns";
import { useDeleteGate } from "@/hooks/use-delete-gate";
import { CellAction } from "@/components/ui/cell-action";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { formatExchangeRate } from "@/lib/currency-utils";
import type { ExchangeRateItem } from "@/types/exchange-rate";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";

interface UseExchangeRateTableOptions {
  containerWidth?: number;
  items: ExchangeRateItem[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (item: ExchangeRateItem) => void;
  onDelete: (item: ExchangeRateItem) => void;
}

export function useExchangeRateTable({
  items,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  containerWidth,
}: UseExchangeRateTableOptions) {
  const { dateTimeFormat, defaultCurrencyCode } = useProfile();
  const tfl = useTranslations("field");
  const deleteGate = useDeleteGate();

  const columns: ColumnDef<ExchangeRateItem>[] = useMemo(
    () => [
      indexColumn<ExchangeRateItem>(params),
      {
        accessorKey: "at_date",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tfl("date")} />
        ),
        cell: ({ row }) =>
          formatDate(row.getValue<string>("at_date"), dateTimeFormat),
        meta: { headerTitle: tfl("date"), skeleton: columnSkeletons.text },
      },
      {
        id: "currency_code",
        accessorFn: (row) => row.currency?.code ?? "",
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={tfl("code")}
            className="justify-center"
          />
        ),
        cell: ({ row }) => (
          <CellAction onClick={() => onEdit(row.original)}>
            {row.getValue<string>("currency_code")}
          </CellAction>
        ),
        meta: {
          headerTitle: tfl("code"),
          skeleton: columnSkeletons.textShort,
          cellClassName: "text-center",
        },
      },
      {
        accessorKey: "exchange_rate",
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={
              defaultCurrencyCode
                ? `${tfl("exchangeRate")} (${defaultCurrencyCode})`
                : tfl("exchangeRate")
            }
            className="justify-end"
          />
        ),
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {formatExchangeRate(Number(row.getValue("exchange_rate")))}
          </span>
        ),
        meta: {
          headerTitle: tfl("exchangeRate"),
          headerClassName: "text-right",
          skeleton: columnSkeletons.textShort,
        },
      },

      ...auditColumns<ExchangeRateItem>(tfl, dateTimeFormat),
      actionColumn<ExchangeRateItem>(onDelete, deleteGate),
    ],
    [
      params,
      dateTimeFormat,
      defaultCurrencyCode,
      onEdit,
      onDelete,
      tfl,
      deleteGate,
    ],
  );

  // 60 index + 180 date + 120 code + 180 rate + 60 actions = 600px.
  const responsive = useConfigTableLayout(
    columns,
    {
      grow: "exchange_rate",
      widths: { at_date: 180, currency_code: 120, exchange_rate: 180 },
    },
    containerWidth,
    { created_at: false, updated_at: false },
  );
  return useReactTable({
    data: items,
    ...responsive,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    initialState: {
      columnVisibility: { created_at: false, updated_at: false },
    },
    ...tableConfig,
    state: { ...tableConfig.state, ...responsive.state },
    pageCount: Math.ceil(totalRecords / Number(params.perpage ?? 10)),
  });
}
