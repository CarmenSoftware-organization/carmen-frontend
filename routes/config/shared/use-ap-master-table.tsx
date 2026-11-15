import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { CellAction } from "@/components/ui/cell-action";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import {
  auditColumns,
  columnSkeletons,
} from "@/components/ui/data-grid/columns";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { useProfile } from "@/hooks/use-profile";
import type { ConfigTableHookOptions } from "@/components/templates/types";
import type { ApMasterBase } from "@/types/accounting-master";
import type { FilterFieldDef } from "@/types/list-filter";

export const AP_MASTER_FILTER_FIELDS: FilterFieldDef[] = [
  {
    key: "filter",
    control: "status",
    labelKey: "common.status",
    options: [
      { labelKey: "status.active", value: "is_active|bool:true" },
      { labelKey: "status.inactive", value: "is_active|bool:false" },
    ],
  },
];

export function useApMasterTable<T extends ApMasterBase>(
  options: ConfigTableHookOptions<T>,
  extraColumns: ColumnDef<T>[] = [],
) {
  const tf = useTranslations("field");
  const { dateTimeFormat } = useProfile();
  const width = options.containerWidth ?? 1000;
  const extraWidth = extraColumns.reduce(
    (sum, column) => sum + (column.size ?? 150),
    0,
  );
  const columns: ColumnDef<T>[] = [
    {
      accessorKey: "code",
      size: 120,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tf("code")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => options.onEdit(row.original)}>
          {row.original.code}
        </CellAction>
      ),
      meta: { headerTitle: tf("code"), skeleton: columnSkeletons.textShort },
    },
    {
      accessorKey: "description",
      size: Math.max(180, width - 55 - 120 - 100 - 55 - extraWidth),
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tf("description")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => options.onEdit(row.original)}>
          {row.original.description}
        </CellAction>
      ),
      meta: { headerTitle: tf("description"), skeleton: columnSkeletons.text },
    },
    ...extraColumns,
    ...auditColumns<T>(tf, dateTimeFormat),
  ];
  return useConfigTable({
    ...options,
    columns,
    hideIndex: true,
    initialState: {
      columnVisibility: { created_at: false, updated_at: false },
    },
  });
}
