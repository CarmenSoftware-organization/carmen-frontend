import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { auditColumns, statusColumn } from "@/components/ui/data-grid/columns";
import type { Equipment } from "@/types/equipment";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";

interface UseEquipmentTableOptions {
  equipments: Equipment[];
  categories: Map<string, string>;
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (equipment: Equipment) => void;
  onDelete: (equipment: Equipment) => void;
}

export function useEquipmentTable({
  equipments,
  categories,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseEquipmentTableOptions) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();

  const columns: ColumnDef<Equipment>[] = [
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
      meta: { headerTitle: tfl("code") },
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      meta: { headerTitle: tfl("name") },
    },
    {
      accessorKey: "category_id",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("category")} />
      ),
      cell: ({ row }) => {
        const categoryId = row.getValue("category_id") as string | null;
        return categoryId ? (categories.get(categoryId) ?? "—") : "—";
      },
      size: 160,
      meta: { headerTitle: tfl("category") },
    },
    {
      accessorKey: "brand",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("brand")} />
      ),
      size: 140,
      meta: { headerTitle: tfl("brand") },
    },
    {
      accessorKey: "model",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("model")} />
      ),
      size: 140,
      meta: { headerTitle: tfl("model") },
    },
    {
      accessorKey: "station",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("station")} />
      ),
      size: 140,
      meta: { headerTitle: tfl("station") },
    },
    {
      accessorKey: "capacity",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("capacity")} />
      ),
      size: 120,
      meta: { headerTitle: tfl("capacity") },
    },
    // Status ก่อน created/updated (hideStatus:true กัน useConfigTable inject ซ้ำ)
    statusColumn<Equipment>(tfl),
    ...auditColumns<Equipment>(tfl, dateTimeFormat),
  ];

  return useConfigTable<Equipment>({
    data: equipments,
    columns,
    totalRecords,
    params,
    tableConfig,
    onDelete,
    hideStatus: true,
    initialState: {
      columnVisibility: { created_at: false, updated_at: false },
    },
  });
}
