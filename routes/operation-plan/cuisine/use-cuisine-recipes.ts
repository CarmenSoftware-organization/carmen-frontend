import { createConfigCrud } from "@/hooks/use-config-crud";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type { CreateRecipeDto, Recipe } from "@/types/recipe";

// ใช้ queryKey ชุดเดียวกับ use-recipe ของหน้า recipe — สร้าง/แก้/ลบสูตรแล้ว cache ที่นี่ถูก
// invalidate ไปด้วย โดยไม่ต้อง import ข้าม feature
const recipeCrud = createConfigCrud<Recipe, CreateRecipeDto>({
  queryKey: QUERY_KEYS.RECIPES,
  endpoint: API_ENDPOINTS.RECIPES,
  label: "recipe",
});

export const CUISINE_RECIPES_PREVIEW = 8;

/** สูตรที่ผูกกับ cuisine นี้ — ดึงแค่หน้าแรก ส่วน `paginate.total` คือจำนวนทั้งหมด */
export function useCuisineRecipes(cuisineId: string | undefined) {
  return recipeCrud.useList(
    {
      filter: `cuisine_id|string:${cuisineId}`,
      perpage: CUISINE_RECIPES_PREVIEW,
      sort: "name:asc",
    },
    { enabled: !!cuisineId },
  );
}
