import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type { WhtFormMaster } from "@/types/accounting-master";
import { createApMasterMockCrud } from "../shared/ap-master-crud";

export type WhtFormPayload = Pick<
  WhtFormMaster,
  | "description"
  | "is_active"
  | "chart_of_accounts_id"
  | "cost_center_id"
  | "dimensions"
> & { code?: string };
export const whtFormCrud = createApMasterMockCrud<WhtFormMaster, WhtFormPayload>(
  API_ENDPOINTS.WHT_FORMS,
  QUERY_KEYS.WHT_FORMS,
);
