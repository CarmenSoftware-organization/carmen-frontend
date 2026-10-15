import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { auditColumns, statusColumn } from "@/components/ui/data-grid/columns";
import type { RecipeCategory } from "@/types/recipe-category";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";

interface UseRecipeCategoryTableOptions {
  categories: RecipeCategory[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (category: RecipeCategory) => void;
  onDelete: (category: RecipeCategory) => void;
}

export function useRecipeCategoryTable({
  categories,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseRecipeCategoryTableOptions) {
  const tfl = useTranslations("field");
  const t = useTranslations("operationPlan.recipeCategory");
  const { dateTimeFormat } = useProfile();

  const columns: ColumnDef<RecipeCategory>[] = [
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
      size: 60,
      meta: { headerTitle: tfl("code") },
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)}>
          {row.original.name || "..."}
        </CellAction>
      ),
      meta: { headerTitle: tfl("name") },
    },
    {
      id: "parent_id",
      accessorFn: (row) => row.parent?.id ?? "",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("parent")} />
      ),
      meta: { headerTitle: t("parent") },
      cell: ({ row }) =>
        row.original.parent?.name || (
          <span className="text-muted-foreground">—</span>
        ),
    },
    // Status ก่อน created/updated (hideStatus:true กัน useConfigTable inject ซ้ำ)
    statusColumn<RecipeCategory>(tfl),
    ...auditColumns<RecipeCategory>(tfl, dateTimeFormat),
  ];

  return useConfigTable<RecipeCategory>({
    data: categories,
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
