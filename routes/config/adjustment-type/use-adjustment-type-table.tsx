import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { Badge } from "@/components/ui/badge";
import {
  IA_TYPE_CONFIG,
  IA_TYPE_ICON,
  IA_TYPE_ICON_COLOR,
} from "@/constant/inventory-adjustment";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import {
  auditColumns,
  columnSkeletons,
  statusColumn,
} from "@/components/ui/data-grid/columns";
import { ADJUSTMENT_TYPE, type AdjustmentType } from "@/types/adjustment-type";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";

interface UseAdjustmentTypeTableOptions {
  data: AdjustmentType[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (adjustmentType: AdjustmentType) => void;
  onDelete: (adjustmentType: AdjustmentType) => void;
}

export function useAdjustmentTypeTable({
  data,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseAdjustmentTypeTableOptions) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();
  const columns: ColumnDef<AdjustmentType>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("code")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)}>
          {row.getValue("code")}
        </CellAction>
      ),
      size: 120,
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
      accessorKey: "type",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("type")}
          className="justify-center"
        />
      ),
      cell: ({ row }) => {
        const type = row.getValue<string>("type");
        const iaType =
          type === ADJUSTMENT_TYPE.STOCK_IN ? "stock-in" : "stock-out";
        const Icon = IA_TYPE_ICON[iaType];
        return (
          <Badge size="sm" className={IA_TYPE_CONFIG[iaType]?.className}>
            {Icon && (
              <Icon className={IA_TYPE_ICON_COLOR[iaType]} aria-hidden="true" />
            )}
            {type === ADJUSTMENT_TYPE.STOCK_IN
              ? tfl("stockIn")
              : tfl("stockOut")}
          </Badge>
        );
      },
      size: 120,
      meta: {
        headerTitle: tfl("type"),
        cellClassName: "text-center",
        skeleton: columnSkeletons.badge,
      },
    },
    statusColumn<AdjustmentType>(tfl),
    ...auditColumns<AdjustmentType>(tfl, dateTimeFormat),
  ];

  return useConfigTable<AdjustmentType>({
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
