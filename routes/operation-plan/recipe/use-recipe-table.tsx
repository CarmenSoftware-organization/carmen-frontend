import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { auditColumns, statusColumn } from "@/components/ui/data-grid/columns";
import { useProfile } from "@/hooks/use-profile";
import type { Recipe } from "@/types/recipe";
import type { Cuisine } from "@/types/cuisine";
import type { RecipeCategory } from "@/types/recipe-category";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { RecipeDifficultyPips } from "./recipe-difficulty-pips";
import {
  RecipeFoodCostCell,
  RecipeStatusBadge,
  RecipeThumb,
} from "./recipe-list-cells";

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
  const t = useTranslations("operationPlan.recipe");
  const formatAmount = useAmountFormatter();
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
      // รูปย่อ + ชื่อ + สถานะวงจรชีวิต (Draft/Published/Archived) — ของเดิมตาราง
      // ไม่มีสถานะนี้เลย มีแค่ Active ซึ่งเป็นคนละเรื่องกัน
      cell: ({ row }) => (
        // data-slot: DataGridTable ครอบเซลล์ด้วย line-clamp ที่ทับ display:flex
        // ของลูกทุกตัวที่ไม่มี data-slot (แถวจะเรียงลงแนวตั้ง)
        <div
          data-slot="recipe-name-cell"
          className="flex min-w-0 items-center gap-2.5"
        >
          <RecipeThumb image={row.original.primary_image} className="size-7" />
          <span className="min-w-0 truncate">
            <CellAction onClick={() => onEdit(row.original)}>
              {row.original.name || "..."}
            </CellAction>
          </span>
          <RecipeStatusBadge
            status={row.original.status}
            className="shrink-0"
          />
        </div>
      ),
      size: 240,
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
      size: 130,
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
      size: 140,
      meta: { headerTitle: tfl("category") },
    },
    {
      accessorKey: "difficulty",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("difficulty")} />
      ),
      cell: ({ row }) => {
        const d = row.original.difficulty;
        if (!d) return <span className="text-muted-foreground">—</span>;
        return (
          <span
            data-slot="recipe-difficulty"
            className="inline-flex items-center gap-2"
          >
            <RecipeDifficultyPips difficulty={d} />
            {ts(d.toLowerCase() as "easy" | "medium" | "hard")}
          </span>
        );
      },
      size: 110,
      meta: { headerTitle: tfl("difficulty") },
    },
    {
      id: "total_time",
      accessorFn: (r) => (r.prep_time ?? 0) + (r.cook_time ?? 0),
      header: () => (
        <span className="block text-right">{tfl("totalTime")}</span>
      ),
      cell: ({ getValue }) => {
        const min = getValue<number>();
        if (!min) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="tabular-nums">
            {min} <span className="text-muted-foreground">{t("minShort")}</span>
          </span>
        );
      },
      enableSorting: false,
      size: 90,
      meta: {
        headerTitle: tfl("totalTime"),
        cellClassName: "text-right",
      },
    },
    {
      accessorKey: "base_yield",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={t("yield")}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const { base_yield, base_yield_unit } = row.original;
        if (!base_yield)
          return <span className="text-muted-foreground">—</span>;
        return (
          <span className="tabular-nums">
            {base_yield}{" "}
            <span className="text-muted-foreground">{base_yield_unit}</span>
          </span>
        );
      },
      size: 100,
      meta: { headerTitle: t("yield"), cellClassName: "text-right" },
    },
    {
      accessorKey: "cost_per_portion",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={t("costPerPortion")}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const v = row.original.cost_per_portion;
        if (!v) return <span className="text-muted-foreground">—</span>;
        return <span className="tabular-nums">{formatAmount(v)}</span>;
      },
      size: 130,
      meta: { headerTitle: t("costPerPortion"), cellClassName: "text-right" },
    },
    {
      accessorKey: "selling_price",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={t("sellingPrice")}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const v = row.original.selling_price;
        if (!v) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="font-medium tabular-nums">{formatAmount(v)}</span>
        );
      },
      size: 120,
      meta: { headerTitle: t("sellingPrice"), cellClassName: "text-right" },
    },
    {
      accessorKey: "actual_food_cost_percentage",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={t("foodCost")}
          className="justify-end"
        />
      ),
      cell: ({ row }) => (
        <RecipeFoodCostCell
          actual={row.original.actual_food_cost_percentage}
          target={row.original.target_food_cost_percentage}
        />
      ),
      size: 130,
      meta: { headerTitle: t("foodCost"), cellClassName: "text-right" },
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
      // yield เป็นข้อมูลครัว ไม่ใช่ข้อมูลที่กวาดตาหาในรายการ — เปิดได้จากปุ่มคอลัมน์
      columnVisibility: {
        created_at: false,
        updated_at: false,
        base_yield: false,
      },
    },
    activity: { id: (r) => r.id, label: (r) => r.code },
  });
}
