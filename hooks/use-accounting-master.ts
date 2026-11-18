import { createConfigCrud } from "@/hooks/use-config-crud";
import { QUERY_KEYS } from "@/constant/query-keys";
import type {
  PaymentTypeMaster,
  WhtFormMaster,
  WhtServiceTypeMaster,
} from "@/types/accounting-master";
import { useQuery } from "@tanstack/react-query";
import { httpClient } from "@/lib/http-client";
import { ApiError } from "@/lib/api-error";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { useBuCode } from "@/hooks/use-bu-code";
import type {
  BankAccountMaster,
  TitleMaster,
  GlPeriodMaster,
} from "@/types/accounting-master";

export const DEFAULT_TITLES: TitleMaster[] = [
  {
    id: "title-mr",
    code: "MR",
    description: "Mr.",
    is_active: true,
    is_system: true,
    reference_count: 18,
  },
  {
    id: "title-mrs",
    code: "MRS",
    description: "Mrs.",
    is_active: true,
    is_system: true,
    reference_count: 9,
  },
  {
    id: "title-ms",
    code: "MS",
    description: "Ms.",
    is_active: true,
    is_system: true,
    reference_count: 5,
  },
  {
    id: "title-dr",
    code: "DR",
    description: "Dr.",
    is_active: true,
    is_system: false,
    reference_count: 2,
  },
  {
    id: "title-khun",
    code: "KHUN",
    description: "Khun",
    is_active: true,
    is_system: false,
    reference_count: 12,
  },
];

export function useBankAccounts() {
  const buCode = useBuCode();
  return useQuery({
    queryKey: ["accounting-master", "bank-accounts", buCode],
    queryFn: async (): Promise<BankAccountMaster[]> => {
      const res = await httpClient.get(API_ENDPOINTS.GL_BANK_ACCOUNTS(buCode!));
      if (!res.ok)
        throw await ApiError.from(res, "Failed to load bank accounts");
      const json = await res.json();
      const items = Array.isArray(json) ? json : (json?.data ?? []);
      return items.map((item: Record<string, unknown>) => ({
        id: String(item.id),
        code: String(item.code ?? ""),
        bank_name: String(item.bank_name ?? ""),
        account_number: String(item.account_no ?? ""),
        account_name: String(item.name ?? ""),
        branch_name: (item.bank_branch as string | null) ?? null,
        gl_account_id: (item.chart_of_accounts_id as string | null) ?? null,
        currency_code: String(item.currency_code ?? ""),
        currency_id: String(item.currency_id ?? ""),
        is_active: Boolean(item.is_active),
        doc_version: Number(item.doc_version ?? 0),
      }));
    },
    enabled: !!buCode,
  });
}

export function useTitles() {
  const buCode = useBuCode();
  return useQuery({
    queryKey: ["accounting-master", "titles", buCode],
    queryFn: async (): Promise<TitleMaster[]> => {
      if (!buCode) return DEFAULT_TITLES;
      try {
        const res = await httpClient.get(
          `/api/proxy/api/config/${buCode}/titles`,
        );
        if (!res.ok) return DEFAULT_TITLES;
        const json = await res.json();
        const items = Array.isArray(json) ? json : (json?.data ?? []);
        return items.length > 0 ? items : DEFAULT_TITLES;
      } catch {
        return DEFAULT_TITLES;
      }
    },
    initialData: DEFAULT_TITLES,
  });
}

export function useGlPeriods() {
  const buCode = useBuCode();
  return useQuery({
    queryKey: ["accounting-master", "gl-periods", buCode],
    queryFn: async (): Promise<GlPeriodMaster[]> => {
      const res = await httpClient.get(API_ENDPOINTS.GL_PERIODS(buCode!));
      if (!res.ok) throw await ApiError.from(res, "Failed to load GL periods");
      const json = await res.json();
      const items = Array.isArray(json) ? json : (json?.data ?? []);
      return items.map((item: Record<string, unknown>) => ({
        id: String(item.id),
        fiscal_year: Number(item.fiscal_year),
        period_number: Number(item.period_no),
        start_date: String(item.start_at).slice(0, 10),
        end_date: String(item.end_at).slice(0, 10),
        status: item.status as GlPeriodMaster["status"],
        doc_version: Number(item.doc_version ?? 0),
      }));
    },
    enabled: !!buCode,
  });
}

const paymentTypeCrud = createConfigCrud<PaymentTypeMaster, never>({
  endpoint: API_ENDPOINTS.PAYMENT_TYPES,
  queryKey: QUERY_KEYS.PAYMENT_TYPES,
  label: "payment types",
});
const whtFormCrud = createConfigCrud<WhtFormMaster, never>({
  endpoint: API_ENDPOINTS.WHT_FORMS,
  queryKey: QUERY_KEYS.WHT_FORMS,
  label: "WHT forms",
});
const whtServiceCrud = createConfigCrud<WhtServiceTypeMaster, never>({
  endpoint: API_ENDPOINTS.WHT_SERVICE_TYPES,
  queryKey: QUERY_KEYS.WHT_SERVICE_TYPES,
  label: "WHT service types",
});
export const usePaymentTypes = paymentTypeCrud.useList;
export const usePaymentTypeById = paymentTypeCrud.useById;
export const useWhtForms = whtFormCrud.useList;
export const useWhtServiceTypes = whtServiceCrud.useList;

export const useWhtServiceTypeById = whtServiceCrud.useById;
