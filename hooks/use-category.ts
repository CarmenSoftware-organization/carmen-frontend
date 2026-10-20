import { createConfigCrud } from "@/hooks/use-config-crud";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type { CategoryDto, CreateCategoryDto } from "@/types/category";

const crud = createConfigCrud<CategoryDto, CreateCategoryDto>({
  queryKey: QUERY_KEYS.PRODUCT_CATEGORIES,
  endpoint: API_ENDPOINTS.PRODUCT_CATEGORIES,
  label: "category",
  // backend cascade deviation/รหัสบัญชีลงชั้นล่างทุกชั้น (ถึง product) — ล้าง cache ของลูกด้วย
  // ไม่งั้นต้นไม้โชว์ค่าเก่าจนหมด staleTime
  extraInvalidateKeys: [
    QUERY_KEYS.PRODUCT_SUB_CATEGORIES,
    QUERY_KEYS.PRODUCT_ITEM_GROUPS,
    QUERY_KEYS.PRODUCTS,
  ],
});

export const useCategory = crud.useList;
export const useCategoryAll = crud.useListAll;

export const useCategoryById = crud.useById;

export const useCreateCategory = crud.useCreate;

export const useUpdateCategory = crud.useUpdate;

export const useDeleteCategory = crud.useDelete;
