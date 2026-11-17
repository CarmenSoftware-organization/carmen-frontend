import type {
  AccountLinksInput,
  ChartOfAccountDetail,
} from "@/types/chart-of-accounts";
import type { CoaFormValues } from "./coa-form-schema";
import type { DimensionPreview } from "./coa-dimension-preview-state";

export function buildCoaAccountLinks(
  account: ChartOfAccountDetail | undefined,
  values: CoaFormValues,
  configs: Record<string, DimensionPreview>,
): AccountLinksInput {
  const currentCenters = new Set(
    account?.cost_centers.map((item) => item.cost_center_id),
  );
  const selectedCenters = new Set(values.allowed_cost_center_ids ?? []);
  const add = [...selectedCenters]
    .filter((id) => !currentCenters.has(id))
    .map((cost_center_id) => ({ cost_center_id }));
  const remove = [...currentCenters]
    .filter((id) => !selectedCenters.has(id))
    .map((cost_center_id) => ({ cost_center_id }));
  const currentDimensions = new Map(
    account?.dimensions.map((item) => [item.gl_dimension_id, item]),
  );
  // Prohibited rules are not shown as selected dimensions; preserve their posting restrictions.
  const desired = values.req_dim
    ? values.dimension_rules
    : Object.fromEntries(
        Object.entries(values.dimension_rules).filter(
          ([, requirement]) => requirement === "prohibited",
        ),
      );
  const dimensions: NonNullable<AccountLinksInput["dimensions"]> = {
    add: [],
    update: [],
    remove: [],
  };
  for (const [gl_dimension_id, requirement] of Object.entries(desired)) {
    const current = currentDimensions.get(gl_dimension_id);
    const draft = configs[gl_dimension_id];
    const input = {
      gl_dimension_id,
      requirement,
      ...(draft
        ? {
            config: {
              default_value_id: draft.defaultValueId,
              allowed_value_ids: draft.allowedValueIds,
            },
          }
        : {}),
    };
    if (!current) dimensions.add.push(input);
    else if (current.requirement !== requirement || draft)
      dimensions.update.push(input);
  }
  for (const gl_dimension_id of currentDimensions.keys()) {
    if (!(gl_dimension_id in desired))
      dimensions.remove.push({ gl_dimension_id });
  }
  return {
    ...(add.length || remove.length ? { cost_centers: { add, remove } } : {}),
    ...(dimensions.add.length ||
    dimensions.update.length ||
    dimensions.remove.length
      ? { dimensions }
      : {}),
  };
}
