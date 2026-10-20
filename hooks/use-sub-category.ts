import { createConfigCrud } from "@/hooks/use-config-crud";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type { SubCategoryDto, CreateSubCategoryDto } from "@/types/category";

const crud = createConfigCrud<SubCategoryDto, CreateSubCategoryDto>({
  queryKey: QUERY_KEYS.PRODUCT_SUB_CATEGORIES,
  endpoint: API_ENDPOINTS.PRODUCT_SUB_CATEGORIES,
  label: "sub-category",
  // backend cascade ลง item group + product — ล้าง cache ของลูกด้วย
  extraInvalidateKeys: [QUERY_KEYS.PRODUCT_ITEM_GROUPS, QUERY_KEYS.PRODUCTS],
});

export const useSubCategory = crud.useList;
export const useSubCategoryAll = crud.useListAll;

export const useSubCategoryById = crud.useById;

export const useCreateSubCategory = crud.useCreate;

export const useUpdateSubCategory = crud.useUpdate;

export const useDeleteSubCategory = crud.useDelete;
