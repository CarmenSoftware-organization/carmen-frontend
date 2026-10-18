import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import type { RecipeCategory } from "@/types/recipe-category";
import {
  formatMarginRange,
  formatPct,
  readRecipeCategoryDefaults,
} from "./recipe-category-defaults";

interface RecipeCategoryCardProps {
  readonly item: RecipeCategory;
  readonly parentName?: string;
  readonly onEdit: (item: RecipeCategory) => void;
  readonly onDelete: (item: RecipeCategory) => void;
}

export default function RecipeCategoryCard({
  item,
  parentName,
  onEdit,
  onDelete,
}: RecipeCategoryCardProps) {
  const tfl = useTranslations("field");
  const t = useTranslations("operationPlan.recipeCategory");
  const defaults = readRecipeCategoryDefaults(item);
  const margin = formatMarginRange(defaults);

  return (
    <ListCard
      title={item.name || "..."}
      onOpen={() => onEdit(item)}
      onDelete={() => onDelete(item)}
    >
      <ListCardActiveRow active={item.is_active} />
      {item.code && <ListCardRow label={tfl("code")}>{item.code}</ListCardRow>}
      {parentName && (
        <ListCardRow label={tfl("parentCategory")}>{parentName}</ListCardRow>
      )}
      {defaults.foodCost != null && (
        <ListCardRow label={t("foodCostCol")}>
          <span className="tabular-nums">{formatPct(defaults.foodCost)}</span>
        </ListCardRow>
      )}
      {margin && (
        <ListCardRow label={t("marginCol")}>
          <span className="tabular-nums">{margin}</span>
        </ListCardRow>
      )}
      {item.description && (
        <ListCardRow label={tfl("description")}>{item.description}</ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
