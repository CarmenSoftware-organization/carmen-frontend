import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type { WhtFormMaster } from "@/types/accounting-master";
import { createApMasterCrud } from "../shared/ap-master-crud";

export type WhtFormPayload = Pick<
  WhtFormMaster,
  "description" | "is_active" | "chart_of_accounts_id" | "cost_center_id"
> & {
  code?: string;
  dimensions: { gl_dimension_id: string; gl_dimension_value_id: string }[];
};
export const whtFormCrud = createApMasterCrud<WhtFormMaster, WhtFormPayload>(
  API_ENDPOINTS.WHT_FORMS,
  QUERY_KEYS.WHT_FORMS,
);
