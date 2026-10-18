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
import { CuisineRegionLabel } from "./cuisine-region-label";

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
      size: 220,
      meta: { headerTitle: tfl("name") },
    },
    {
      accessorKey: "region",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("region")} />
      ),
      cell: ({ row }) => (
        <CuisineRegionLabel region={row.getValue("region") as string} />
      ),
      size: 150,
      meta: { headerTitle: tfl("region") },
    },
    {
      accessorKey: "description",
      header: () => tfl("description"),
      cell: ({ row }) => (
        <span
          className="text-muted-foreground block truncate"
          title={row.original.description ?? undefined}
        >
          {row.original.description || "—"}
        </span>
      ),
      enableSorting: false,
      size: 320,
      meta: { headerTitle: tfl("description") },
    },
    {
      // backend ยังไม่ส่ง recipe_count (ก่อน deploy) = "—" ไม่ใช่ 0 ซึ่งจะโกหกว่าไม่มีสูตร
      // sort ไม่ได้ — เป็นค่านับจาก relation ไม่ใช่คอลัมน์ในตาราง
      accessorKey: "recipe_count",
      header: () => t("recipes"),
      cell: ({ row }) =>
        row.original.recipe_count ?? (
          <span className="text-muted-foreground">—</span>
        ),
      enableSorting: false,
      size: 90,
      meta: {
        headerTitle: t("recipes"),
        headerClassName: "text-right",
        cellClassName: "text-right tabular-nums whitespace-nowrap",
      },
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
