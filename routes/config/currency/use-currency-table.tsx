import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import {
  auditColumns,
  columnSkeletons,
  statusColumn,
} from "@/components/ui/data-grid/columns";
import { useProfile } from "@/hooks/use-profile";
import { formatExchangeRate } from "@/lib/currency-utils";
import type { Currency } from "@/types/currency";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { CellAction } from "@/components/ui/cell-action";

interface UseCurrencyTableOptions {
  data: Currency[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (currency: Currency) => void;
  onDelete: (currency: Currency) => void;
}

export function useCurrencyTable({
  data,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseCurrencyTableOptions) {
  const { defaultCurrencyCode, dateTimeFormat } = useProfile();
  const tfl = useTranslations("field");

  const columns: ColumnDef<Currency>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("code")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)}>
          {row.original.code}
        </CellAction>
      ),
      size: 80,
      meta: { headerTitle: tfl("code"), skeleton: columnSkeletons.textShort },
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      meta: { headerTitle: tfl("name"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "symbol",
      header: tfl("symbol"),
      size: 40,
      meta: {
        headerTitle: tfl("symbol"),
        cellClassName: "text-center",
        headerClassName: "text-center",
        skeleton: columnSkeletons.textShort,
      },
    },
    {
      accessorKey: "exchange_rate",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("exchangeRate")}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const rate = row.getValue<number>("exchange_rate");
        if (!rate) return <div className="text-right">-</div>;
        return (
          <div className="text-right">
            <span className="font-medium">{formatExchangeRate(rate)}</span>
            {defaultCurrencyCode && (
              <span className="text-muted-foreground ms-1 text-xs font-normal">
                {defaultCurrencyCode}
              </span>
            )}
          </div>
        );
      },
      size: 120,
      meta: {
        headerTitle: tfl("exchangeRate"),
        cellClassName: "text-right",
        skeleton: columnSkeletons.textShort,
      },
    },
    statusColumn<Currency>(tfl),
    ...auditColumns<Currency>(tfl, dateTimeFormat),
  ];

  return useConfigTable<Currency>({
    data,
    columns,
    totalRecords,
    params,
    tableConfig,
    onDelete,
    hideStatus: true,
    initialState: {
      columnVisibility: { created_at: false, updated_at: false },
    },
    activity: { id: (r) => r.id, label: (r) => r.code },
  });
}
