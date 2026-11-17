import { createConfigCrud } from "@/hooks/use-config-crud";
import { LOOKUP_QUERY_ROOT } from "@/hooks/use-lookup-resource";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type { TaxProfile, CreateTaxProfileDto } from "@/types/tax-profile";

const crud = createConfigCrud<TaxProfile, CreateTaxProfileDto>({
  queryKey: QUERY_KEYS.TAX_PROFILES,
  endpoint: API_ENDPOINTS.TAX_PROFILES,
  label: "tax profile",
  updateMethod: "PATCH",
  // lookup อ่านฟิลด์เพิ่มของ resource นี้ — แก้แล้วต้องไม่ค้างใน cache ของ Lookup API
  extraInvalidateKeys: [LOOKUP_QUERY_ROOT],
});

export const useTaxProfile = crud.useList;
export const useTaxProfileById = crud.useById;

export const useCreateTaxProfile = crud.useCreate;

export const useUpdateTaxProfile = crud.useUpdate;

export const useDeleteTaxProfile = crud.useDelete;
