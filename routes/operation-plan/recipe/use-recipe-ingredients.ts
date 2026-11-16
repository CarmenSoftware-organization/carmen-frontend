import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type { IngredientCostResult, IngredientInput } from "@/types/recipe";

interface PreviewVars {
  recipeId: string;
  items: IngredientInput[];
  /** "pricelist" = บรรทัดสินค้าใช้ราคาจากใบราคาที่เปิดอยู่ (ไม่มี = 0) · ไม่ส่ง = ต้นทุนคลัง */
  priceSource?: "pricelist";
}

interface ReplaceVars {
  recipeId: string;
  items: IngredientInput[];
  /**
   * true = กดปุ่ม "Update price" แล้ว: ทุกบรรทัดสินค้าถูกทับด้วยราคาจากใบราคาที่เปิดอยู่ (ไม่มี = 0)
   * · false = บรรทัดที่สินค้า+หน่วยเดิมคงต้นทุนที่บันทึกไว้
   * (ฟอร์มไม่มีทางคิดราคาใหม่จากต้นทุนคลังแล้ว — ปุ่ม Recalculate เดิมถูกแทนด้วย Update price 2026-11-16)
   */
  recalculate: boolean;
}

async function readResult(
  res: Response,
  fallback: string,
): Promise<IngredientCostResult> {
  if (!res.ok) throw await ApiError.from(res, fallback);
  const json = (await res.json()) as { data?: Partial<IngredientCostResult> };
  return {
    items: json.data?.items ?? [],
    total_ingredient_cost: Number(json.data?.total_ingredient_cost) || 0,
  };
}

/**
 * ต้นทุนปัจจุบันของวัตถุดิบ — server คำนวณ ไม่เขียน DB
 * ไม่ส่ง priceSource = ต้นทุนเฉลี่ยคลัง → fallback (ตอนเลือกสินค้า/หน่วยใหม่ในฟอร์ม)
 * · "pricelist" = ราคาจากใบราคาที่เปิดอยู่ (ปุ่ม "Update price" และบรรทัดที่เพิ่มหลังกดปุ่มนั้น)
 */
export function usePreviewIngredientCosts() {
  const buCode = useBuCode();

  return useMutation<IngredientCostResult, ApiError, PreviewVars>({
    mutationFn: async ({ recipeId, items, priceSource }) => {
      if (!buCode)
        throw new ApiError("MISSING_REQUIRED_FIELD", "Missing buCode");
      const res = await httpClient.post(
        `${API_ENDPOINTS.RECIPE_INGREDIENTS(buCode, recipeId)}/preview`,
        { items, ...(priceSource ? { price_source: priceSource } : {}) },
      );
      return readResult(res, "Failed to preview ingredient costs");
    },
  });
}

/**
 * แทนวัตถุดิบทั้งชุดของสูตร — server คำนวณต้นทุนและอัปเดต total_ingredient_cost บนหัวสูตรเอง
 * คืนบรรทัดที่บันทึกแล้วพร้อมผลรวม ให้ฟอร์มเอาผลรวมไปใส่ payload ของหัวสูตร
 */
export function useReplaceIngredients() {
  const buCode = useBuCode();
  const queryClient = useQueryClient();

  return useMutation<IngredientCostResult, ApiError, ReplaceVars>({
    mutationFn: async ({ recipeId, items, recalculate }) => {
      if (!buCode)
        throw new ApiError("MISSING_REQUIRED_FIELD", "Missing buCode");
      const res = await httpClient.put(
        API_ENDPOINTS.RECIPE_INGREDIENTS(buCode, recipeId),
        {
          items,
          recalculate,
          // คิดใหม่ทั้งชุดมีทางเดียวคือ Update price = ราคาจากใบราคา
          ...(recalculate ? { price_source: "pricelist" } : {}),
        },
      );
      return readResult(res, "Failed to save ingredients");
    },
    // ทั้งสำเร็จและล้มต้องดึงใหม่ — แถวเดิมถูก soft-delete แล้วสร้างใหม่ (id เปลี่ยน)
    // return promise ไว้ให้ mutation ยัง pending จน refetch จบ (ปุ่ม Save ปิดอยู่)
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.RECIPES] }),
  });
}
