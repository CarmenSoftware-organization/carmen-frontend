import { httpClient } from "@/lib/http-client";
import { createConfigApi } from "@/lib/config-crud";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { ApiError } from "@/lib/api-error";

import { readCoaRules, type DimensionRequirement, type CoaDimensionRule } from "@/lib/coa-dimension-rules";
export { readCoaRules, coaRulesKey, type DimensionRequirement, type CoaDimensionRule } from "@/lib/coa-dimension-rules";
const api = createConfigApi<CoaDimensionRule, { chart_of_accounts_id: string; gl_dimension_id: string; requirement: DimensionRequirement }>({
  endpoint: API_ENDPOINTS.GL_ACCOUNT_DIMENSION_RULES, label: "account dimension rules",
});

async function checkSaved(response: Response) {
  if (!response.ok) throw await ApiError.from(response, "Unable to save dimension rule");
  if (response.status === 204) return;
  const body = await response.json();
  if (body?.success === false) throw new Error(body.message || "Unable to save dimension rule");
}

export async function saveCoaRules(bu: string, accountId: string, desired: Record<string, DimensionRequirement>) {
  // Re-read on retry: some operations may already have succeeded before an API error.
  const current = await readCoaRules(bu, accountId);
  for (const rule of current) {
    const requirement = desired[rule.gl_dimension_id];
    let response: Response | undefined;
    if (!requirement) response = await api.remove(bu, rule.id);
    else if (requirement !== rule.requirement) {
      response = await httpClient.put(`${API_ENDPOINTS.GL_ACCOUNT_DIMENSION_RULES(bu)}/${rule.id}`, { requirement, doc_version: rule.doc_version });
    }
    if (response) await checkSaved(response);
  }
  for (const [gl_dimension_id, requirement] of Object.entries(desired)) {
    if (current.some((rule) => rule.gl_dimension_id === gl_dimension_id)) continue;
    const response = await api.create(bu, { chart_of_accounts_id: accountId, gl_dimension_id, requirement });
    await checkSaved(response);
  }
}
