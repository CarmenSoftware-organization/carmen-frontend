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
  /** ราคาขายทั้งสูตร ÷ ต้นทุนเต็มทั้งสูตร */
  markup: number | null;
  /** ตั้งราคาต่ำกว่าราคาขั้นต่ำ — ใช้เตือนเท่านั้น ไม่บล็อกการบันทึก */
  belowMinPrice: boolean;
}

export interface RecipeCostCalc extends RecipeComputed {
  /** กำไรทั้งสูตรถ้าขายที่ราคานี้ (หักต้นทุนเต็มรวมแรง/โสหุ้ย) */
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
  const totalCost =
    (Number(ingredientCost) || 0) +
    (Number(laborCost) || 0) +
    (Number(overheadCost) || 0);

  const profitAt = useCallback(
    (price: number | null) =>
      price == null ? null : round2(price - totalCost),
    [totalCost],
  );

  useEffect(() => {
    // ฟิลด์เหล่านี้คำนวณล้วน ๆ — เขียนเป็น defaultValue ด้วย (resetField) ไม่ใช่ setValue
    // ไม่งั้นค่าที่คำนวณใหม่ต่างจากที่ DB เก็บไว้แค่เศษปัด ก็ทำให้ฟอร์ม dirty
    // ทั้งที่ผู้ใช้แก้แล้วเปลี่ยนกลับเป็นค่าเดิม · เช็กก่อน reset กัน re-render วน
    const sync = (
      name:
        | "cost_per_portion"
        | "gross_margin"
        | "gross_margin_percentage"
        | "actual_food_cost_percentage"
        | "labor_cost_percentage"
        | "overhead_percentage"
        | "suggested_price",
      value: number | null,
    ) => {
      if (!Object.is(form.getValues(name), value)) {
        form.resetField(name, { defaultValue: value });
      }
    };
    sync("cost_per_portion", computed.costPerPortion);
    sync("gross_margin", computed.grossMargin);
    sync("gross_margin_percentage", computed.grossMarginPct);
    sync("actual_food_cost_percentage", computed.actualFoodCostPct);
    sync("labor_cost_percentage", computed.laborCostPct);
    sync("overhead_percentage", computed.overheadPct);
    sync("suggested_price", computed.suggestedPrice);
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

  // ทุกตัวเลขคิด "ทั้งสูตร": ต้นทุนที่กรอกเป็นของทั้งสูตร (base_yield portion) และราคาขาย
  // ก็เป็นราคาของทั้งสูตร (ผู้ใช้กำหนด 2026-11-23 — เดิมราคาขายเป็นต่อ portion แล้วหาร
  // ต้นทุนด้วยจำนวน portion ก่อนเทียบ) · จำนวน portion ใช้แค่หาต้นทุนต่อ portion
  const pctOfPrice = (n: number) =>
    sell > 0 ? round2((n / sell) * 100) : null;

  const totalCost = ing + lab + ovh;
  const costPerPortion = yld > 0 ? round2(totalCost / yld) : 0;
  const grossMargin = sell > 0 ? round2(sell - totalCost) : null;
  const grossMarginPct =
    sell > 0 && grossMargin != null ? round2((grossMargin / sell) * 100) : null;
  const actualFoodCostPct = pctOfPrice(ing);
  const laborCostPct = pctOfPrice(lab);
  const overheadPct = pctOfPrice(ovh);
  // ราคา (ทั้งสูตร) ที่ทำให้ food cost (วัตถุดิบ ÷ ราคา) เท่ากับเป้าพอดี — ฐานเดียวกับ
  // actualFoodCostPct ไม่ปนค่าแรง/โสหุ้ย
  const priceAtFoodCost = (pct: number) =>
    pct > 0 && pct <= 100 && ing > 0 ? round2(ing / (pct / 100)) : null;
  const suggestedPrice = priceAtFoodCost(targetPct);
  // เพดานต่ำกว่าเป้าคือค่าที่ schema ปัดตก — ไม่โชว์ราคาขั้นต่ำที่สูงกว่าราคาที่เป้า
  const minPrice =
    targetPct > 0 && maxPct < targetPct ? null : priceAtFoodCost(maxPct);
  const markup = sell > 0 && totalCost > 0 ? round2(sell / totalCost) : null;
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
