import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import type { Recipe } from "@/types/recipe";
import type { Cuisine } from "@/types/cuisine";
import type { RecipeCategory } from "@/types/recipe-category";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { RecipeDifficultyPips } from "./recipe-difficulty-pips";
import {
  RecipeFoodCostCell,
  RecipeStatusBadge,
  RecipeThumb,
} from "./recipe-list-cells";

interface RecipeCardProps {
  readonly item: Recipe;
  readonly cuisines: Cuisine[];
  readonly categories: RecipeCategory[];
  readonly onEdit: (item: Recipe) => void;
  readonly onDelete: (item: Recipe) => void;
}

/**
 * การ์ดสูตรอาหาร 1 รายการ สำหรับหน้ารายการโหมด grid/mobile
 *
 * ใช้ `ListCard` ตัวเดียวกับการ์ดโมดูลอื่น — ไฟล์นี้เหลือแค่ว่าข้อมูลอะไรอยู่
 * แถวไหน ครบเท่าคอลัมน์ของตารางสูตรอาหาร
 *
 * ระดับความยากเป็นจุดสามดวงสีกลาง ไม่ใช่ badge สี — ของเดิม map EASY/MEDIUM/HARD
 * เป็น success/warning/destructive ซึ่งเป็นการยืม token ความหมาย "ดี/เตือน/ผิด"
 * มาใช้กับข้อมูลที่ไม่ได้ดีหรือแย่ (สูตรยากไม่ใช่ error) และทำให้การ์ดมีสองสี
 * ขึ้นไปต่อใบ ผิดกฎ single accent ของ DESIGN.md
 *
 * @param props.item - ข้อมูลสูตรอาหาร
 * @param props.cuisines - รายการ cuisine (resolve ชื่อจาก id)
 * @param props.categories - รายการหมวด (resolve ชื่อจาก id)
 * @param props.onEdit - callback เมื่อคลิกการ์ด
 * @param props.onDelete - callback เมื่อกดปุ่มลบ
 */
export default function RecipeCard({
  item,
  cuisines,
  categories,
  onEdit,
  onDelete,
}: RecipeCardProps) {
  const t = useTranslations("operationPlan.recipe");
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const formatAmount = useAmountFormatter();

  const cuisineName = cuisines.find((c) => c.id === item.cuisine_id)?.name;
  const categoryName = categories.find((c) => c.id === item.category_id)?.name;
  const totalTime = (item.prep_time ?? 0) + (item.cook_time ?? 0);
  const name = item.name || "...";

  return (
    <ListCard
      title={
        <span className="flex min-w-0 items-center gap-2.5" title={name}>
          <RecipeThumb image={item.primary_image} />
          <span className="truncate">{name}</span>
        </span>
      }
      badge={<RecipeStatusBadge status={item.status} />}
      onOpen={() => onEdit(item)}
      onDelete={() => onDelete(item)}
    >
      <ListCardActiveRow active={item.is_active} />
      {item.code && <ListCardRow label={tfl("code")}>{item.code}</ListCardRow>}
      {cuisineName && (
        <ListCardRow label={tfl("cuisine")}>{cuisineName}</ListCardRow>
      )}
      {categoryName && (
        <ListCardRow label={tfl("category")}>{categoryName}</ListCardRow>
      )}
      {item.difficulty && (
        <ListCardRow label={tfl("difficulty")}>
          <span className="inline-flex items-center gap-2">
            <RecipeDifficultyPips difficulty={item.difficulty} />
            {ts(item.difficulty.toLowerCase() as "easy" | "medium" | "hard")}
          </span>
        </ListCardRow>
      )}
      {totalTime > 0 && (
        <ListCardRow label={tfl("totalTime")}>
          <span className="tabular-nums">
            {totalTime}{" "}
            <span className="text-muted-foreground font-normal">
              {t("minShort")}
            </span>
          </span>
        </ListCardRow>
      )}
      {item.cost_per_portion > 0 && (
        <ListCardRow label={t("costPerPortion")}>
          <span className="tabular-nums">
            {formatAmount(item.cost_per_portion)}
          </span>
        </ListCardRow>
      )}
      {!!item.selling_price && (
        <ListCardRow label={t("sellingPrice")}>
          <span className="tabular-nums">
            {formatAmount(item.selling_price)}
          </span>
        </ListCardRow>
      )}
      {item.actual_food_cost_percentage != null && (
        <ListCardRow label={t("foodCost")}>
          <RecipeFoodCostCell
            actual={item.actual_food_cost_percentage}
            target={item.target_food_cost_percentage}
          />
        </ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
