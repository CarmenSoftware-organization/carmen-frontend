import { useState } from "react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { auditColumns, statusColumn } from "@/components/ui/data-grid/columns";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { liveFoodCostPct } from "./use-recipe-cost-calc";

interface UseRecipeTableOptions {
  recipes: Recipe[];
  cuisines: Cuisine[];
  categories: RecipeCategory[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe) => void;
  /** เมนู Edit ในแถว — ไม่ส่ง (ไม่มีสิทธิ์แก้) = ไม่มีเมนู */
  onEditRecipe?: (recipe: Recipe) => void;
  /** ความกว้างกล่องตาราง (px) — `undefined` = ยังไม่ได้วัด ใช้ชุดคอลัมน์จอกว้าง */
  containerWidth?: number;
}

/**
 * ขั้นของคอลัมน์ตามความกว้างของกล่องตาราง (ไม่ใช่ของจอ — sidebar พับ/กางได้)
 *
 * "ชื่อ" รับที่เหลือ (`meta.grow`) ที่เหลือกว้างคงที่ ตารางจึงกว้างขั้นต่ำเท่าผลรวม `size`
 * (นับคอลัมน์ select 55 ที่ไม่ได้เรนเดอร์ + # 48 + ปุ่มแถว 60 · ไม่นับ audit/yield ที่ซ่อนเป็น default):
 *   ครบ  163+135+200+115+130+140+120+90+130+120+130+100 = 1573
 *   ไม่มีสถานะ Active (Inactive ลงบรรทัดรองใต้ชื่อ)     = 1473
 *   ไม่มีเวลารวม (ลงใต้ความยาก)                       = 1383
 *   ไม่มีหมวด (ลงใต้ครัว)                             = 1243
 *   ไม่มีความยาก (จุดความยาก + เวลา ลงใต้รหัส)          = 1123
 *   ไม่มีครัว (ครัว · หมวด ลงใต้ชื่อ)                  =  993  (กล่องที่ 1366 เมนูกาง = 1085)
 *   ไม่มีต้นทุน/ส่วน (ลงใต้ราคาขาย)                    =  863
 *   ไม่มีสถานะสูตร (ชิป Draft/Published ลงข้างชื่อ)     =  748
 *   แคบสุด: food cost ไม่มีแถบ 80 · ชื่อขั้นต่ำ 160    =  658  (1024 เมนูกาง = 742 · จอ 768 = 662)
 * จุดเปลี่ยนสูงกว่าผลรวมของขั้นนั้น 5px
 */
function columnTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return {
    showStatus: w >= 1578,
    showTime: w >= 1478,
    showCategory: w >= 1388,
    showDifficulty: w >= 1248,
    showCuisine: w >= 1128,
    showCost: w >= 998,
    showLifecycle: w >= 868,
    roomy: w >= 753,
  };
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
  onEditRecipe,
  containerWidth,
}: UseRecipeTableOptions) {
  "use no memo";
  const {
    showStatus,
    showTime,
    showCategory,
    showDifficulty,
    showCuisine,
    showCost,
    showLifecycle,
    roomy,
  } = columnTier(containerWidth);
  // คอลัมน์ที่ผู้ใช้เปิด/ปิดเองจากเมนู Toggle Columns — ขั้นตามความกว้างกล่องทับเฉพาะคอลัมน์ที่บังคับซ่อน
  // yield เป็นข้อมูลครัว ไม่ใช่ข้อมูลที่กวาดตาหาในรายการ — เปิดได้จากปุ่มคอลัมน์
  const [userVisibility, setUserVisibility] = useState<VisibilityState>({
    created_at: false,
    updated_at: false,
    base_yield: false,
  });
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const t = useTranslations("operationPlan.recipe");
  const formatAmount = useAmountFormatter();
  const { dateTimeFormat } = useProfile();
  const cuisineMap = new Map(cuisines.map((c) => [c.id, c.name]));
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const totalMinutes = (r: Recipe) => (r.prep_time ?? 0) + (r.cook_time ?? 0);
  const timeText = (min: number) => (
    <span className="tabular-nums">
      {min} <span className="text-muted-foreground">{t("minShort")}</span>
    </span>
  );
  const muted = "text-muted-foreground block truncate text-xs";

  const columns: ColumnDef<Recipe>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("code")} />
      ),
      // คอลัมน์ความยาก/เวลาถูกซ่อนในกล่องแคบ — จุดความยาก + เวลารวมลงบรรทัดรองใต้รหัส
      cell: ({ row }) => {
        const r = row.original;
        const min = totalMinutes(r);
        const code = (
          <CellAction onClick={() => onEdit(r)} className="whitespace-nowrap">
            {r.code}
          </CellAction>
        );
        if (showDifficulty || (!r.difficulty && !min)) return code;
        return (
          <div data-slot="cell-stack" className="flex flex-col items-start">
            {code}
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs whitespace-nowrap">
              {r.difficulty && (
                <span
                  title={ts(
                    r.difficulty.toLowerCase() as "easy" | "medium" | "hard",
                  )}
                >
                  <RecipeDifficultyPips difficulty={r.difficulty} />
                </span>
              )}
              {min > 0 && timeText(min)}
            </span>
          </div>
        );
      },
      // รหัสยาวสุด ~105px (KPHAD-KAI-001) + padding 24 — 120 ตัดเหลือ "KPHAD-KAI-00"
      size: 135,
      meta: { headerTitle: tfl("code") },
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      // รูปย่อ + ชื่อ + สถานะวงจรชีวิต (Draft/Published/Archived) — ของเดิมตาราง
      // ไม่มีสถานะนี้เลย มีแค่ Active ซึ่งเป็นคนละเรื่องกัน
      cell: ({ row }) => {
        const r = row.original;
        // ครัว/หมวด/สถานะ Active ที่ถูกซ่อนในกล่องแคบ — ลงบรรทัดรองใต้ชื่อบรรทัดเดียว
        const secondary = [
          !showCuisine && cuisineMap.get(r.cuisine_id),
          !showCuisine && categoryMap.get(r.category_id),
        ].filter(Boolean);
        const inactive = !showStatus && !r.is_active;
        return (
          // data-slot: DataGridTable ครอบเซลล์ด้วย line-clamp ที่ทับ display:flex
          // ของลูกทุกตัวที่ไม่มี data-slot (แถวจะเรียงลงแนวตั้ง)
          <div
            data-slot="recipe-name-cell"
            className="flex min-w-0 items-center gap-2.5"
          >
            <RecipeThumb image={r.primary_image} className="size-7" />
            <div data-slot="cell-stack" className="flex min-w-0 flex-col">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="min-w-0 truncate">
                  <CellAction onClick={() => onEdit(r)}>
                    {r.name || "..."}
                  </CellAction>
                </span>
                {/* คอลัมน์สถานะสูตรถูกซ่อนในกล่องแคบ — ชิปกลับมาอยู่ข้างชื่อ */}
                {!showLifecycle && (
                  <RecipeStatusBadge
                    status={r.status}
                    size="sm"
                    className="shrink-0"
                  />
                )}
              </div>
              {(secondary.length > 0 || inactive) && (
                <span className="flex min-w-0 items-center gap-2">
                  {secondary.length > 0 && (
                    <span className={muted} title={secondary.join(" · ")}>
                      {secondary.join(" · ")}
                    </span>
                  )}
                  {inactive && <StatusBadge active={false} />}
                </span>
              )}
            </div>
          </div>
        );
      },
      // ชื่อยาวได้ — รับที่เหลือ · size = ขั้นต่ำ (รูป + ชื่อ · ชิปสถานะสูตรเมื่อคอลัมน์ของมันถูกซ่อน)
      size: roomy ? 200 : 160,
      meta: { headerTitle: tfl("name"), grow: true },
    },
    {
      // สถานะวงจรชีวิตของสูตร (Draft/Published/Archived) — คนละเรื่องกับ Active ท้ายตาราง
      // หัวคอลัมน์ใช้ "Lifecycle" ไม่ซ้ำกับ "Status" ของ Active
      accessorKey: "status",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("lifecycle")} />
      ),
      cell: ({ row }) => (
        <RecipeStatusBadge status={row.original.status} size="sm" />
      ),
      // พอให้ "Published" ไม่ถูกตัด
      size: 115,
      meta: { headerTitle: t("lifecycle") },
    },
    {
      accessorKey: "cuisine_id",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("cuisine")} />
      ),
      cell: ({ row }) => {
        const name = cuisineMap.get(row.original.cuisine_id);
        const category = categoryMap.get(row.original.category_id);
        const main = name ? (
          <span className="block truncate" title={name}>
            {name}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
        // คอลัมน์หมวดถูกซ่อน — ลงบรรทัดรองใต้ครัว
        if (showCategory || !category) return main;
        return (
          <div data-slot="cell-stack" className="flex min-w-0 flex-col">
            {main}
            <span className={muted} title={category}>
              {category}
            </span>
          </div>
        );
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
        if (!name) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="block truncate" title={name}>
            {name}
          </span>
        );
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
        const min = totalMinutes(row.original);
        const level = d ? (
          <span
            data-slot="recipe-difficulty"
            className="inline-flex items-center gap-2 whitespace-nowrap"
          >
            <RecipeDifficultyPips difficulty={d} />
            {ts(d.toLowerCase() as "easy" | "medium" | "hard")}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
        // คอลัมน์เวลารวมถูกซ่อน — ลงบรรทัดรองใต้ความยาก
        if (showTime || !min) return level;
        return (
          <div data-slot="cell-stack" className="flex flex-col items-start">
            {level}
            <span className="text-xs whitespace-nowrap">{timeText(min)}</span>
          </div>
        );
      },
      size: 120,
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
        return <span className="whitespace-nowrap">{timeText(min)}</span>;
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
        return (
          <span className="whitespace-nowrap tabular-nums">
            {formatAmount(v)}
          </span>
        );
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
        const cost = row.original.cost_per_portion;
        const price = v ? (
          <span className="font-medium whitespace-nowrap tabular-nums">
            {formatAmount(v)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
        // คอลัมน์ต้นทุน/ส่วนถูกซ่อน — ลงบรรทัดรองใต้ราคาขาย
        if (showCost || !cost) return price;
        return (
          <div data-slot="cell-stack" className="flex flex-col items-end">
            {price}
            <span
              className="text-muted-foreground text-xs whitespace-nowrap tabular-nums"
              title={t("costPerPortion")}
            >
              {formatAmount(cost)}
            </span>
          </div>
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
          actual={liveFoodCostPct(row.original)}
          target={row.original.target_food_cost_percentage}
          showBar={roomy}
        />
      ),
      size: roomy ? 130 : 80,
      meta: { headerTitle: t("foodCost"), cellClassName: "text-right" },
    },
    // Status ก่อน created/updated (hideStatus:true กัน useConfigTable inject ซ้ำ)
    statusColumn<Recipe>(tfl),
    ...auditColumns<Recipe>(tfl, dateTimeFormat),
  ];

  // ส่งเป็นตัวแปร (ไม่ใช่ literal) — type ของ tableConfig ประกาศ state แค่ pagination/sorting
  const responsiveTableConfig = {
    ...tableConfig,
    state: {
      ...tableConfig.state,
      columnVisibility: {
        ...userVisibility,
        ...(!showStatus && { is_active: false }),
        ...(!showTime && { total_time: false }),
        ...(!showCategory && { category_id: false }),
        ...(!showDifficulty && { difficulty: false }),
        ...(!showCuisine && { cuisine_id: false }),
        ...(!showCost && { cost_per_portion: false }),
        ...(!showLifecycle && { status: false }),
      },
    },
    onColumnVisibilityChange: setUserVisibility,
  };

  return useConfigTable<Recipe>({
    data: recipes,
    columns,
    totalRecords,
    params,
    tableConfig: responsiveTableConfig,
    onDelete,
    hideStatus: true,
    activity: { id: (r) => r.id, label: (r) => r.code },
    edit: onEditRecipe ? { onClick: onEditRecipe } : undefined,
  });
}
