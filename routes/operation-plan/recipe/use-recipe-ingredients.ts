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
}

interface ReplaceVars extends PreviewVars {
  /** true = ทุกบรรทัดใช้ต้นทุนปัจจุบัน · false = บรรทัดที่สินค้า+หน่วยเดิมคงต้นทุนที่บันทึกไว้ */
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
 * ต้นทุนปัจจุบันของวัตถุดิบ (ต้นทุนเฉลี่ยคลัง → fallback) — server คำนวณ ไม่เขียน DB
 * ใช้ทั้งตอนเลือกสินค้า/หน่วยใหม่ในฟอร์ม และปุ่ม "คำนวณใหม่"
 */
export function usePreviewIngredientCosts() {
  const buCode = useBuCode();

  return useMutation<IngredientCostResult, ApiError, PreviewVars>({
    mutationFn: async ({ recipeId, items }) => {
      if (!buCode)
        throw new ApiError("MISSING_REQUIRED_FIELD", "Missing buCode");
      const res = await httpClient.post(
        `${API_ENDPOINTS.RECIPE_INGREDIENTS(buCode, recipeId)}/preview`,
        { items },
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
        { items, recalculate },
      );
      return readResult(res, "Failed to save ingredients");
    },
    // ทั้งสำเร็จและล้มต้องดึงใหม่ — แถวเดิมถูก soft-delete แล้วสร้างใหม่ (id เปลี่ยน)
    // return promise ไว้ให้ mutation ยัง pending จน refetch จบ (ปุ่ม Save ปิดอยู่)
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.RECIPES] }),
  });
}
