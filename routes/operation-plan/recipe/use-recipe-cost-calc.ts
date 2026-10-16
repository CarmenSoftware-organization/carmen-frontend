import { useCallback, useEffect } from "react";
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
  /** ราคาต่ำสุดที่ food cost ยังไม่เกินเพดาน — ฐานเดียวกับ suggestedPrice */
  minPrice: number | null;
  /** ราคาขาย ÷ ต้นทุนเต็มต่อจาน */
  markup: number | null;
  /** ตั้งราคาต่ำกว่าราคาขั้นต่ำ — ใช้เตือนเท่านั้น ไม่บล็อกการบันทึก */
  belowMinPrice: boolean;
}

export interface RecipeCostCalc extends RecipeComputed {
  /** กำไรต่อจานถ้าขายที่ราคานี้ (หักต้นทุนเต็มรวมแรง/โสหุ้ย) */
  profitAt: (price: number | null) => number | null;
}

export function useRecipeCostCalc(
  form: UseFormReturn<RecipeFormValues>,
): RecipeCostCalc {
  const [
    ingredientCost,
    laborCost,
    overheadCost,
    baseYield,
    sellingPrice,
    targetFoodCostPct,
    maxFoodCostPct,
  ] = useWatch({
    control: form.control,
    name: [
      "total_ingredient_cost",
      "labor_cost",
      "overhead_cost",
      "base_yield",
      "selling_price",
      "target_food_cost_percentage",
      "max_food_cost_percentage",
    ],
  });

  const { minPrice, markup, belowMinPrice, ...computed } = computeRecipeCost({
    ingredientCost,
    laborCost,
    overheadCost,
    baseYield,
    sellingPrice,
    targetFoodCostPct,
    maxFoodCostPct,
  });
  const { costPerPortion } = computed;

  const profitAt = useCallback(
    (price: number | null) =>
      price == null ? null : round2(price - costPerPortion),
    [costPerPortion],
  );

  useEffect(() => {
    form.setValue("cost_per_portion", computed.costPerPortion);
    form.setValue("gross_margin", computed.grossMargin);
    form.setValue("gross_margin_percentage", computed.grossMarginPct);
    form.setValue("actual_food_cost_percentage", computed.actualFoodCostPct);
    form.setValue("labor_cost_percentage", computed.laborCostPct);
    form.setValue("overhead_percentage", computed.overheadPct);
    form.setValue("suggested_price", computed.suggestedPrice);
  }, [computed, form]);

  return { ...computed, minPrice, markup, belowMinPrice, profitAt };
}

type CostInput = number | string | null | undefined;

/**
 * สมการต้นทุน/ราคาของสูตรแบบ pure — hook ใช้กับค่าในฟอร์ม ส่วนการบันทึกใช้ซ้ำกับ
 * total_ingredient_cost ที่ server คืนมาหลังบันทึกวัตถุดิบ (ตัวเลขหัวสูตรตรงกับบรรทัดเสมอ)
 */
export function computeRecipeCost(input: {
  ingredientCost: CostInput;
  laborCost: CostInput;
  overheadCost: CostInput;
  baseYield: CostInput;
  sellingPrice: CostInput;
  targetFoodCostPct: CostInput;
  maxFoodCostPct: CostInput;
}): RecipeComputed {
  const ing = Number(input.ingredientCost) || 0;
  const lab = Number(input.laborCost) || 0;
  const ovh = Number(input.overheadCost) || 0;
  const yld = Number(input.baseYield) || 0;
  const sell = Number(input.sellingPrice) || 0;
  const targetPct = Number(input.targetFoodCostPct) || 0;
  const maxPct = Number(input.maxFoodCostPct) || 0;

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
  const priceAtFoodCost = (pct: number) =>
    pct > 0 && pct <= 100 && yld > 0 && ing > 0
      ? round2(perPortion(ing) / (pct / 100))
      : null;
  const suggestedPrice = priceAtFoodCost(targetPct);
  // เพดานต่ำกว่าเป้าคือค่าที่ schema ปัดตก — ไม่โชว์ราคาขั้นต่ำที่สูงกว่าราคาที่เป้า
  const minPrice =
    targetPct > 0 && maxPct < targetPct ? null : priceAtFoodCost(maxPct);
  const markup =
    sell > 0 && costPerPortion > 0 ? round2(sell / costPerPortion) : null;
  const belowMinPrice = minPrice != null && sell > 0 && sell < minPrice;

  return {
    costPerPortion,
    grossMargin,
    grossMarginPct,
    actualFoodCostPct,
    laborCostPct,
    overheadPct,
    suggestedPrice,
    minPrice,
    markup,
    belowMinPrice,
  };
}
