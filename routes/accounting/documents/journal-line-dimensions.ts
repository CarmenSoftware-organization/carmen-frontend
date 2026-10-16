import type { DimensionMaster } from "@/types/accounting-master";
import type { ChartOfAccount } from "@/types/chart-of-accounts";
import type { CoaDimensionRule } from "@/lib/coa-dimension-rules";
import type { JournalLineDimensionInput } from "@/types/journal-voucher";

export function visibleLineDimensions(
  dimensions: DimensionMaster[],
  account: ChartOfAccount | undefined,
  rules: CoaDimensionRule[],
  selected: JournalLineDimensionInput[],
) {
  if (!account) return [];
  const accountRules = rules.filter(
    (rule) => rule.chart_of_accounts_id === account.id,
  );
  return dimensions.filter((dimension) => {
    // Keep saved values visible even when the master or account rules change.
    if (selected.some((item) => item.dimension_id === dimension.id))
      return true;
    if (!dimension.is_active) return false;
    const rule = accountRules.find(
      (item) => item.gl_dimension_id === dimension.id,
    );
    if (rule) return rule.requirement !== "prohibited";
    return (
      accountRules.length === 0 &&
      !!account.allowed_dimensions?.includes(dimension.id)
    );
  });
}
