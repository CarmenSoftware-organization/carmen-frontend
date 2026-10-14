import { createConfigCrud } from "@/hooks/use-config-crud";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type {
  CostCenterGroup,
  CreateCostCenterGroupDto,
} from "@/types/cost-center-group";

// cost center list ฝัง group code/name มาด้วย — แก้ group แล้วต้อง invalidate ทั้งคู่
const crud = createConfigCrud<CostCenterGroup, CreateCostCenterGroupDto>({
  queryKey: QUERY_KEYS.COST_CENTER_GROUPS,
  endpoint: API_ENDPOINTS.GL_COST_CENTER_GROUPS,
  label: "costCenterGroup",
  updateMethod: "PATCH",
  extraInvalidateKeys: [QUERY_KEYS.COST_CENTERS],
});

export const useCostCenterGroup = crud.useList;
export const useCostCenterGroupById = crud.useById;
export const useCreateCostCenterGroup = crud.useCreate;
export const useUpdateCostCenterGroup = crud.useUpdate;
export const useDeleteCostCenterGroup = crud.useDelete;
