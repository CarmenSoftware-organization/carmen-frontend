import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import {
  auditColumns,
  columnSkeletons,
  statusColumn,
} from "@/components/ui/data-grid/columns";
import type { Unit } from "@/types/unit";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";

interface UseUnitTableOptions {
  data: Unit[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (unit: Unit) => void;
  onDelete: (unit: Unit) => void;
}

export function useUnitTable({
  data,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseUnitTableOptions) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();
  const columns: ColumnDef<Unit>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)}>
          {row.getValue("name") || "..."}
        </CellAction>
      ),
      meta: { headerTitle: tfl("name"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "description",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("description")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.description || "-"}
        </span>
      ),
      meta: {
        headerTitle: tfl("description"),
        skeleton: columnSkeletons.text,
      },
    },
    {
      accessorKey: "decimal_place",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("decimalPlaces")}
          className="justify-end"
        />
      ),
      cell: ({ row }) => row.original.decimal_place ?? 0,
      size: 110,
      meta: {
        headerTitle: tfl("decimalPlaces"),
        cellClassName: "text-right tabular-nums",
        skeleton: columnSkeletons.textShort,
      },
    },
    statusColumn<Unit>(tfl),
    ...auditColumns<Unit>(tfl, dateTimeFormat),
  ];

  return useConfigTable<Unit>({
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
