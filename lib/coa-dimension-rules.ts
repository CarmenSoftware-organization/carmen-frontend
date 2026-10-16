import { createConfigApi } from "@/lib/config-crud";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { fetchAllPages } from "@/lib/fetch-all-pages";

export type DimensionRequirement = "mandatory" | "optional" | "prohibited";
export interface CoaDimensionRule {
  id: string;
  chart_of_accounts_id: string;
  gl_dimension_id: string;
  requirement: DimensionRequirement;
  doc_version: number;
}
export const coaRulesKey = (bu: string | undefined, id: string | undefined) => ["coa-dimension-rules", bu, id] as const;
const api = createConfigApi<CoaDimensionRule, { chart_of_accounts_id: string; gl_dimension_id: string; requirement: DimensionRequirement }>({
  endpoint: API_ENDPOINTS.GL_ACCOUNT_DIMENSION_RULES, label: "account dimension rules",
});
export async function readCoaRules(bu: string, id: string) {
  const rules = await fetchAllPages(async (page, perpage) => {
    const result = await api.getList(bu, { page, perpage, filter: `chart_of_accounts_id|string:${id}` });
    if (Array.isArray(result.data) && result.data.length === 0 && !result.paginate) {
      return { ...result, paginate: { total: 0, page, perpage, pages: 1 } };
    }
    if (!Array.isArray(result.data) || !result.paginate) throw new Error("Invalid account dimension rules response");
    return result;
  });
  return rules.filter((rule) => rule.chart_of_accounts_id === id);
}

