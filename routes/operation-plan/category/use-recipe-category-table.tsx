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
import {
  formatMarginRange,
  formatPct,
  readRecipeCategoryDefaults,
} from "./recipe-category-defaults";

function Unset() {
  return <span className="text-muted-foreground">—</span>;
}

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
      // parent แสดงเป็น breadcrumb หน้าชื่อ แทนคอลัมน์แยกที่ว่างเกือบทุกแถว
      // (แถวเดียวบรรทัดเดียว — ความสูงแถวไม่กระโดดตามว่ามี parent หรือไม่)
      cell: ({ row }) => (
        <span
          data-slot="recipe-category-name-cell"
          className="flex min-w-0 items-center gap-1.5"
        >
          {row.original.parent?.name && (
            <>
              <span className="text-muted-foreground truncate">
                {row.original.parent.name}
              </span>
              <span className="text-muted-foreground" aria-hidden="true">
                ›
              </span>
            </>
          )}
          <CellAction onClick={() => onEdit(row.original)}>
            {row.original.name || "..."}
          </CellAction>
        </span>
      ),
      meta: { headerTitle: tfl("name") },
    },
    {
      id: "food_cost",
      header: () => t("foodCostCol"),
      enableSorting: false,
      cell: ({ row }) => {
        const { foodCost } = readRecipeCategoryDefaults(row.original);
        return foodCost == null ? <Unset /> : formatPct(foodCost);
      },
      size: 90,
      meta: {
        headerTitle: t("foodCostCol"),
        headerClassName: "text-right",
        cellClassName: "text-right tabular-nums whitespace-nowrap",
      },
    },
    {
      id: "margin",
      header: () => t("marginCol"),
      enableSorting: false,
      cell: ({ row }) =>
        formatMarginRange(readRecipeCategoryDefaults(row.original)) ?? (
          <Unset />
        ),
      size: 110,
      meta: {
        headerTitle: t("marginCol"),
        headerClassName: "text-right",
        cellClassName: "text-right tabular-nums whitespace-nowrap",
      },
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
