import type { RecipeCategory } from "@/types/recipe-category";

export interface RecipeCategoryDefaults {
  readonly foodCost: number | null;
  readonly marginMin: number | null;
  readonly marginTarget: number | null;
}

// 0 ในฟอร์มคือค่าเริ่มต้นของช่องว่าง (EMPTY_FORM) ไม่ใช่ "ตั้งเป็น 0%" — นับเป็นไม่ได้ตั้ง
function pct(source: Record<string, unknown> | null, key: string) {
  const v = Number(source?.[key]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** อ่านค่าตั้งต้นต้นทุน/กำไรของหมวด — คีย์เดียวกับ getDefaultValues ในฟอร์ม */
export function readRecipeCategoryDefaults(
  category: RecipeCategory,
): RecipeCategoryDefaults {
  return {
    foodCost: pct(
      category.default_cost_settings,
      "target_food_cost_percentage",
    ),
    marginMin: pct(category.default_margins, "minimum_profit_margin"),
    marginTarget: pct(category.default_margins, "target_profit_margin"),
  };
}

const PCT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function formatPct(value: number) {
  return `${PCT.format(value)}%`;
}

/** "15 → 25%" · ตั้งแค่ฝั่งเดียวก็แสดงฝั่งนั้น · ไม่ตั้งเลย = null */
export function formatMarginRange({
  marginMin,
  marginTarget,
}: RecipeCategoryDefaults) {
  if (marginMin != null && marginTarget != null)
    return `${PCT.format(marginMin)} → ${formatPct(marginTarget)}`;
  if (marginTarget != null) return formatPct(marginTarget);
  if (marginMin != null) return `≥ ${formatPct(marginMin)}`;
  return null;
}
