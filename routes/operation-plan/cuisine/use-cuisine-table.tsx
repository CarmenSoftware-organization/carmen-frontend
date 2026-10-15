import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { auditColumns, statusColumn } from "@/components/ui/data-grid/columns";
import type { Cuisine } from "@/types/cuisine";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";
import { CUISINE_REGION_LABEL_KEY } from "@/constant/cuisine";

interface UseCuisineTableOptions {
  cuisines: Cuisine[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (cuisine: Cuisine) => void;
  onDelete: (cuisine: Cuisine) => void;
}

export function useCuisineTable({
  cuisines,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseCuisineTableOptions) {
  const tfl = useTranslations("field");
  const t = useTranslations("operationPlan.cuisine");
  const { dateTimeFormat } = useProfile();

  const columns: ColumnDef<Cuisine>[] = [
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
    {
      accessorKey: "region",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("region")} />
      ),
      cell: ({ row }) => {
        const region = row.getValue("region") as string;
        const labelKey = CUISINE_REGION_LABEL_KEY[region];
        return labelKey ? t(labelKey) : region;
      },
      size: 150,
      meta: { headerTitle: tfl("region") },
    },
    // Status ก่อน created/updated (hideStatus:true กัน useConfigTable inject ซ้ำ)
    statusColumn<Cuisine>(tfl),
    ...auditColumns<Cuisine>(tfl, dateTimeFormat),
  ];

  return useConfigTable<Cuisine>({
    data: cuisines,
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
