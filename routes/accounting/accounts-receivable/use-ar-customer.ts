import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { createConfigCrud } from "@/hooks/use-config-crud";
import { CACHE_DYNAMIC } from "@/lib/cache-config";

interface CustomerAddress {
  id: string;
  address_type: string;
  address_line1?: string | null;
  is_active?: boolean | null;
}

export interface ArCustomer {
  id: string;
  code: string;
  name: string;
  is_active?: boolean | null;
  registered_name?: string | null;
  tax_no?: string | null;
  branch_no?: string | null;
  credit_term_id?: string | null;
  credit_term_name?: string | null;
  credit_term_days?: number | null;
  credit_limit?: number | string | null;
  ar_chart_of_accounts_id?: string | null;
  default_currency_code?: string | null;
  customer_address?: CustomerAddress[];
}

export interface ArCustomerInput {
  code: string;
  name: string;
  is_active: boolean;
  registered_name: string | null;
  tax_no: string | null;
  branch_no: string | null;
  credit_term_id?: string | null;
  credit_limit: string;
  ar_chart_of_accounts_id?: string | null;
  customer_address?: {
    add?: { address_type: "billing_address"; address_line1: string }[];
    update?: { customer_address_id: string; address_line1: string | null }[];
  };
}

const crud = createConfigCrud<ArCustomer, ArCustomerInput>({
  queryKey: QUERY_KEYS.CUSTOMERS,
  endpoint: API_ENDPOINTS.CUSTOMERS,
  label: "AR customer",
  cacheProfile: CACHE_DYNAMIC,
  mutationMeta: { preferServerMessage: true },
});

export const useArCustomers = crud.useList;
export const useArCustomer = crud.useById;
export const useCreateArCustomer = crud.useCreate;
export const useUpdateArCustomer = crud.useUpdate;
export const useDeleteArCustomer = crud.useDelete;
