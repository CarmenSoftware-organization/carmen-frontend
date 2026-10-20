import { createConfigCrud } from "@/hooks/use-config-crud";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type { ItemGroupDto, CreateItemGroupDto } from "@/types/category";

const crud = createConfigCrud<ItemGroupDto, CreateItemGroupDto>({
  queryKey: QUERY_KEYS.PRODUCT_ITEM_GROUPS,
  endpoint: API_ENDPOINTS.PRODUCT_ITEM_GROUPS,
  label: "item-group",
  // backend cascade ลง product — ล้าง cache ของ product ด้วย
  extraInvalidateKeys: [QUERY_KEYS.PRODUCTS],
});

export const useItemGroup = crud.useList;
export const useItemGroupAll = crud.useListAll;

export const useItemGroupById = crud.useById;

export const useCreateItemGroup = crud.useCreate;

export const useUpdateItemGroup = crud.useUpdate;

export const useDeleteItemGroup = crud.useDelete;
