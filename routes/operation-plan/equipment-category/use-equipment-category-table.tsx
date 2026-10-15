import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { auditColumns, statusColumn } from "@/components/ui/data-grid/columns";
import type { EquipmentCategory } from "@/types/equipment-category";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";

interface UseEquipmentCategoryTableOptions {
  equipmentCategories: EquipmentCategory[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (ec: EquipmentCategory) => void;
  onDelete: (ec: EquipmentCategory) => void;
}

export function useEquipmentCategoryTable({
  equipmentCategories,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseEquipmentCategoryTableOptions) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();

  const columns: ColumnDef<EquipmentCategory>[] = [
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
      meta: { headerTitle: tfl("name") },
    },
    // Status ก่อน created/updated (hideStatus:true กัน useConfigTable inject ซ้ำ)
    statusColumn<EquipmentCategory>(tfl),
    ...auditColumns<EquipmentCategory>(tfl, dateTimeFormat),
  ];

  return useConfigTable<EquipmentCategory>({
    data: equipmentCategories,
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
