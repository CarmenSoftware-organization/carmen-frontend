import { useQuery } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type { RecipeStepImage } from "@/types/recipe";

/**
 * รูปของขั้นตอนหนึ่ง เรียงตามลำดับ — recipe detail ไม่ส่งรูปของขั้นมาด้วย จึงดึงแยกต่อขั้น
 *
 * key ขึ้นต้นด้วย `QUERY_KEYS.RECIPES` โดยตั้งใจ: ทุกจุดที่บันทึกสูตร invalidate key นี้อยู่แล้ว
 * รูปของขั้นจึงถูกดึงใหม่ตามไปด้วยโดยไม่ต้องจำ key เพิ่ม · URL เป็น presigned อายุ 1 ชั่วโมง —
 * staleTime ต่ำกว่านั้นเพื่อไม่ถือ URL ที่หมดอายุ
 */
export function useRecipeStepImages(
  recipeId: string | undefined,
  stepId: string | null | undefined,
) {
  const buCode = useBuCode();
  return useQuery<RecipeStepImage[], ApiError>({
    queryKey: [QUERY_KEYS.RECIPES, buCode, recipeId, "step-images", stepId],
    enabled: !!buCode && !!recipeId && !!stepId,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const res = await httpClient.get(
        API_ENDPOINTS.RECIPE_STEP_IMAGES(buCode!, recipeId!, stepId!),
      );
      if (!res.ok) throw await ApiError.from(res, "Failed to load step images");
      const json = (await res.json()) as {
        data?: { images?: RecipeStepImage[] };
      };
      return [...(json.data?.images ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order,
      );
    },
  });
}
