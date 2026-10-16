import { useEffect } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { round2 } from "@/lib/currency-utils";
import type { RecipeFormValues } from "./recipe-form-schema";

export interface RecipeComputed {
  costPerPortion: number;
  grossMargin: number | null;
  grossMarginPct: number | null;
  actualFoodCostPct: number | null;
  laborCostPct: number | null;
  overheadPct: number | null;
  suggestedPrice: number | null;
}

export function useRecipeCostCalc(
  form: UseFormReturn<RecipeFormValues>,
): RecipeComputed {
  const [
    ingredientCost,
    laborCost,
    overheadCost,
    baseYield,
    sellingPrice,
    targetFoodCostPct,
  ] = useWatch({
    control: form.control,
    name: [
      "total_ingredient_cost",
      "labor_cost",
      "overhead_cost",
      "base_yield",
      "selling_price",
      "target_food_cost_percentage",
    ],
  });

  const ing = Number(ingredientCost) || 0;
  const lab = Number(laborCost) || 0;
  const ovh = Number(overheadCost) || 0;
  const yld = Number(baseYield) || 0;
  const sell = Number(sellingPrice) || 0;
  const targetPct = Number(targetFoodCostPct) || 0;

  // ต้นทุนทุกตัวที่กรอกเป็นของ "ทั้งชุด" (base_yield จาน) ส่วนราคาขายเป็น "ต่อจาน"
  // อัตราส่วนเทียบราคาขายจึงต้องหารด้วย yield ก่อนเสมอ — เดิมเอายอดทั้งชุดไปหาร
  // ราคาต่อจานตรง ๆ ทำให้สูตรที่ได้ 2 จานขึ้น food cost สูงเกินจริงสองเท่า
  const perPortion = (n: number) => (yld > 0 ? n / yld : 0);
  const pctOfPrice = (n: number) =>
    sell > 0 && yld > 0 ? round2((perPortion(n) / sell) * 100) : null;

  const totalCost = ing + lab + ovh;
  const costPerPortion = yld > 0 ? round2(totalCost / yld) : 0;
  const grossMargin = sell > 0 ? round2(sell - costPerPortion) : null;
  const grossMarginPct =
    sell > 0 && grossMargin != null ? round2((grossMargin / sell) * 100) : null;
  const actualFoodCostPct = pctOfPrice(ing);
  const laborCostPct = pctOfPrice(lab);
  const overheadPct = pctOfPrice(ovh);
  // ราคาที่ทำให้ food cost (วัตถุดิบต่อจาน ÷ ราคา) เท่ากับเป้าพอดี — ฐานเดียวกับ
  // actualFoodCostPct · เดิมใช้ costPerPortion ÷ (1 − เป้า) ซึ่งเป็นสูตรของเป้ากำไร
  // (เป้า 30% ได้ราคาที่กำไรแค่ 30% ไม่ใช่ food cost 30%) และปนค่าแรง/โสหุ้ยเข้ามา
  const suggestedPrice =
    targetPct > 0 && targetPct <= 100 && yld > 0 && ing > 0
      ? round2(perPortion(ing) / (targetPct / 100))
      : null;

  const computed = {
    costPerPortion,
    grossMargin,
    grossMarginPct,
    actualFoodCostPct,
    laborCostPct,
    overheadPct,
    suggestedPrice,
  };

  useEffect(() => {
    form.setValue("cost_per_portion", computed.costPerPortion);
    form.setValue("gross_margin", computed.grossMargin);
    form.setValue("gross_margin_percentage", computed.grossMarginPct);
    form.setValue("actual_food_cost_percentage", computed.actualFoodCostPct);
    form.setValue("labor_cost_percentage", computed.laborCostPct);
    form.setValue("overhead_percentage", computed.overheadPct);
    form.setValue("suggested_price", computed.suggestedPrice);
  }, [computed, form]);

  return computed;
}
