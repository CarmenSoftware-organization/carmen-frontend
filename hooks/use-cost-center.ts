import { createConfigCrud } from "@/hooks/use-config-crud";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type { CostCenter, CreateCostCenterDto } from "@/types/cost-center";

const crud = createConfigCrud<CostCenter, CreateCostCenterDto>({
  queryKey: QUERY_KEYS.COST_CENTERS,
  endpoint: API_ENDPOINTS.GL_COST_CENTERS,
  label: "costCenter",
  updateMethod: "PATCH",
});

export const useCostCenter = crud.useList;
export const useCostCenterAll = crud.useListAll;
export const useCostCenterById = crud.useById;
export const useCreateCostCenter = crud.useCreate;
export const useUpdateCostCenter = crud.useUpdate;
export const useDeleteCostCenter = crud.useDelete;
