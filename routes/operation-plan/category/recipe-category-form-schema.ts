import { z } from "zod";
import type { RecipeCategory } from "@/types/recipe-category";

export const recipeCategorySchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string(),
  parent_id: z.string().nullable(),
  level: z.coerce.number().min(1, "Level must be at least 1"),
  // ── Default Cost Settings (fixed) ──
  cost_labor_percentage: z.coerce.number().min(0),
  cost_overhead_percentage: z.coerce.number().min(0),
  cost_target_food_cost_percentage: z.coerce.number().min(0),
  // ── Default Profit Margins (fixed) ──
  margin_minimum: z.coerce.number().min(0),
  margin_target: z.coerce.number().min(0),
});

export type RecipeCategoryFormValues = z.infer<typeof recipeCategorySchema>;

export const EMPTY_FORM: RecipeCategoryFormValues = {
  code: "",
  name: "",
  description: "",
  parent_id: null,
  level: 1,
  cost_labor_percentage: 0,
  cost_overhead_percentage: 0,
  cost_target_food_cost_percentage: 0,
  margin_minimum: 0,
  margin_target: 0,
};

export function getDefaultValues(
  category?: RecipeCategory,
): RecipeCategoryFormValues {
  if (!category) return EMPTY_FORM;

  const costSettings = category.default_cost_settings as
    Record<string, number> | null | undefined;
  const margins = category.default_margins as
    Record<string, number> | null | undefined;

  return {
    code: category.code,
    name: category.name,
    description: category.description ?? "",
    parent_id: category.parent?.id ?? null,
    level: category.level,
    cost_labor_percentage: costSettings?.labor_cost_percentage ?? 0,
    cost_overhead_percentage: costSettings?.overhead_percentage ?? 0,
    cost_target_food_cost_percentage:
      costSettings?.target_food_cost_percentage ?? 0,
    margin_minimum: margins?.minimum_profit_margin ?? 0,
    margin_target: margins?.target_profit_margin ?? 0,
  };
}

export function mapToPayload(values: RecipeCategoryFormValues) {
  return {
    code: values.code,
    name: values.name,
    description: values.description || null,
    note: null,
    is_active: true,
    parent_id: values.parent_id || null,
    level: values.level,
    default_cost_settings: {
      labor_cost_percentage: values.cost_labor_percentage,
      overhead_percentage: values.cost_overhead_percentage,
      target_food_cost_percentage: values.cost_target_food_cost_percentage,
    },
    default_margins: {
      minimum_profit_margin: values.margin_minimum,
      target_profit_margin: values.margin_target,
    },
    info: null,
    dimension: null,
  };
}
