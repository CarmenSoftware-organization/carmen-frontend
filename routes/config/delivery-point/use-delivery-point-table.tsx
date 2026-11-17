import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigListTable } from "../shared/use-config-list-table";
import {
  auditColumns,
  columnSkeletons,
  statusColumn,
} from "@/components/ui/data-grid/columns";
import type { DeliveryPoint } from "@/types/delivery-point";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";

interface UseDeliveryPointTableOptions {
  containerWidth?: number;
  data: DeliveryPoint[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (deliveryPoint: DeliveryPoint) => void;
  onDelete: (deliveryPoint: DeliveryPoint) => void;
}

export function useDeliveryPointTable({
  data,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  containerWidth,
}: UseDeliveryPointTableOptions) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();
  const columns: ColumnDef<DeliveryPoint>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      cell: ({ row }) => (
        <CellAction
          className="block max-w-full truncate"
          title={row.original.name}
          onClick={() => onEdit(row.original)}
        >
          {row.getValue("name") || "..."}
        </CellAction>
      ),
      meta: { headerTitle: tfl("name"), skeleton: columnSkeletons.text },
    },
    statusColumn<DeliveryPoint>(tfl),
    ...auditColumns<DeliveryPoint>(tfl, dateTimeFormat),
  ];

  // tablet budget: select 55 + index 60 + actions 60 + name 320 + status 100 = 595 ≤ 662

  return useConfigListTable<DeliveryPoint>({
    containerWidth,
    layout: { grow: "is_active", widths: { name: 320 } },
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
    activity: { id: (r) => r.id, label: (r) => r.name },
  });
}
