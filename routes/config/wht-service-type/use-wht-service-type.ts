import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type { WhtServiceTypeMaster } from "@/types/accounting-master";
import { createApMasterMockCrud } from "../shared/ap-master-crud";

export type WhtServiceTypePayload = Pick<
  WhtServiceTypeMaster,
  "description" | "is_active"
> & { code?: string; rate_percent: number };
export const whtServiceTypeCrud = createApMasterMockCrud<
  WhtServiceTypeMaster,
  WhtServiceTypePayload
>(API_ENDPOINTS.WHT_SERVICE_TYPES, QUERY_KEYS.WHT_SERVICE_TYPES);
