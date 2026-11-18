import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type { PaymentTypeMaster } from "@/types/accounting-master";
import { createApMasterCrud } from "../shared/ap-master-crud";

export type PaymentTypePayload = Pick<
  PaymentTypeMaster,
  | "description"
  | "is_active"
  | "available_ap"
  | "available_ar"
  | "chart_of_accounts_id"
  | "cost_center_id"
  | "bank_account_id"
  | "is_cheque"
  | "cheque_form_id"
> & {
  code?: string;
  dimensions: { gl_dimension_id: string; gl_dimension_value_id: string }[];
};
export const paymentTypeCrud = createApMasterCrud<
  PaymentTypeMaster,
  PaymentTypePayload
>(API_ENDPOINTS.PAYMENT_TYPES, QUERY_KEYS.PAYMENT_TYPES);
