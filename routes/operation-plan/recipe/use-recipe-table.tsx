import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { Badge } from "@/components/ui/badge";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { auditColumns, statusColumn } from "@/components/ui/data-grid/columns";
import { useProfile } from "@/hooks/use-profile";
import type { Recipe } from "@/types/recipe";
import type { Cuisine } from "@/types/cuisine";
import type { RecipeCategory } from "@/types/recipe-category";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { RECIPE_DIFFICULTY } from "@/constant/recipe";
import type { BadgeProps } from "@/components/ui/badge";

interface UseRecipeTableOptions {
  recipes: Recipe[];
  cuisines: Cuisine[];
  categories: RecipeCategory[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe) => void;
}

export function useRecipeTable({
  recipes,
  cuisines,
  categories,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseRecipeTableOptions) {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const { dateTimeFormat } = useProfile();
  const cuisineMap = new Map(cuisines.map((c) => [c.id, c.name]));
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const columns: ColumnDef<Recipe>[] = [
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
      size: 200,
      meta: { headerTitle: tfl("name") },
    },
    {
      accessorKey: "cuisine_id",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("cuisine")} />
      ),
      cell: ({ row }) => {
        const name = cuisineMap.get(row.original.cuisine_id);
        return name ?? <span className="text-muted-foreground">—</span>;
      },
      size: 150,
      meta: { headerTitle: tfl("cuisine") },
    },
    {
      accessorKey: "category_id",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("category")} />
      ),
      cell: ({ row }) => {
        const name = categoryMap.get(row.original.category_id);
        return name ?? <span className="text-muted-foreground">—</span>;
      },
      size: 150,
      meta: { headerTitle: tfl("category") },
    },
    {
      accessorKey: "difficulty",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("difficulty")}
          className="justify-center"
        />
      ),
      cell: ({ row }) => {
        const d = row.getValue<string>("difficulty");
        let variant: BadgeProps["variant"] = "success-light";
        if (d === RECIPE_DIFFICULTY.HARD) variant = "destructive-light";
        else if (d === RECIPE_DIFFICULTY.MEDIUM) variant = "warning-light";
        return (
          <Badge size="lg" variant={variant}>
            {ts(d.toLowerCase() as "easy" | "medium" | "hard")}
          </Badge>
        );
      },
      size: 100,
      meta: {
        headerTitle: tfl("difficulty"),
        cellClassName: "text-center",
      },
    },
    // Status ก่อน created/updated (hideStatus:true กัน useConfigTable inject ซ้ำ)
    statusColumn<Recipe>(tfl),
    ...auditColumns<Recipe>(tfl, dateTimeFormat),
  ];

  return useConfigTable<Recipe>({
    data: recipes,
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
