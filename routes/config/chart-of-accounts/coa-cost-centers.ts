import { useQuery } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { createConfigApi } from "@/lib/config-crud";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { httpClient } from "@/lib/http-client";
import { ApiError } from "@/lib/api-error";
import type { CostCenter } from "@/types/cost-center";
import type { ChartOfAccount } from "@/types/chart-of-accounts";

export type CoaCostCenter = CostCenter & {
  accounts: { chart_of_accounts_id: string }[];
};

const api = createConfigApi<CoaCostCenter, never>({
  endpoint: API_ENDPOINTS.GL_COST_CENTERS,
  label: "Cost Centers",
});
const accountApi = createConfigApi<ChartOfAccount, never>({
  endpoint: API_ENDPOINTS.CHART_OF_ACCOUNTS,
  label: "account",
});

export const coaCostCentersKey = (bu: string | undefined) =>
  [QUERY_KEYS.COST_CENTERS, bu, "coa-accounts"] as const;

export async function readCoaCostCenters(bu: string): Promise<CoaCostCenter[]> {
  const rows = await fetchAllPages(async (page, perpage) => {
    const result = await api.getList(bu, { page, perpage });
    if (!Array.isArray(result.data))
      throw new Error("Invalid Cost Center list response");
    return result;
  });
  const result: CoaCostCenter[] = [];
  // shortcut: the API exposes mappings per Cost Center; replace these detail reads with an account-scoped endpoint for large masters.
  for (const row of rows) {
    const detail = await api.getById(bu, row.id);
    if (
      !Array.isArray(detail.accounts) ||
      detail.accounts.some(
        (item) => typeof item.chart_of_accounts_id !== "string",
      )
    ) {
      throw new Error(`Invalid Cost Center mappings response: ${row.code}`);
    }
    result.push(detail);
  }
  return result;
}

export function useCoaCostCenters() {
  const bu = useBuCode();
  return useQuery({
    queryKey: coaCostCentersKey(bu),
    queryFn: () => readCoaCostCenters(bu!),
    enabled: !!bu,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export async function saveCoaCostCenters(
  bu: string,
  accountId: string,
  codes: string[],
  required: boolean,
) {
  const current = await readCoaCostCenters(bu);
  const wanted = new Set(codes);
  const known = new Set(current.map((item) => item.code));
  if (codes.some((code) => !known.has(code))) {
    throw new Error(
      "A selected Cost Center no longer exists. Reload and review the selection.",
    );
  }
  for (const costCenter of current) {
    const ids = costCenter.accounts.map((item) => item.chart_of_accounts_id);
    const selected = wanted.has(costCenter.code);
    if (ids.includes(accountId) === selected) continue;
    const response = await httpClient.put(
      `${API_ENDPOINTS.GL_COST_CENTERS(bu)}/${costCenter.id}/accounts`,
      {
        chart_of_accounts_ids: selected
          ? [...ids, accountId]
          : ids.filter((id) => id !== accountId),
      },
    );
    if (!response.ok)
      throw await ApiError.from(
        response,
        `Unable to save Cost Center ${costCenter.code}`,
      );
    const body = await response.json();
    if (body?.success === false)
      throw new Error(
        body.message || `Unable to save Cost Center ${costCenter.code}`,
      );
  }
  const saved = await readCoaCostCenters(bu);
  const actual = new Set(
    saved
      .filter((item) =>
        item.accounts.some(
          (account) => account.chart_of_accounts_id === accountId,
        ),
      )
      .map((item) => item.code),
  );
  if (actual.size !== wanted.size || codes.some((code) => !actual.has(code))) {
    throw new Error("Cost Center selections were not fully saved. Retry Save.");
  }
  const account = await accountApi.getById(bu, accountId);
  if (account.is_require_cost_center !== required) {
    throw new Error("Require Cost Center was not saved. Retry Save.");
  }
  return saved;
}
