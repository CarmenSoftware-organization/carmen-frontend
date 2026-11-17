import { useLookupResource } from "@/hooks/use-lookup-resource";
import type { LookupItem, TaxProfileLookup } from "@/types/lookup";
import type { ArDraftLine } from "./ar-invoice-draft-model";

/** Resolve missing response labels in one selected-ID batch per master, preserving document IDs and rate snapshots. */
export function useArInvoiceLineLabels(lines: readonly ArDraftLine[]) {
  const unique = (values: (string | null | undefined)[]) => [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
  const accountIds = unique(
    lines.flatMap((line) => [
      line.cr_chart_of_accounts_id,
      line.dr_chart_of_accounts_id,
      line.vat_chart_of_accounts_id,
      line.tax2_chart_of_accounts_id,
    ]),
  );
  const centerIds = unique(
    lines.flatMap((line) => [
      line.cr_cost_center_id,
      line.dr_cost_center_id,
      line.vat_cost_center_id,
      line.tax2_cost_center_id,
    ]),
  );
  const profileIds = unique(
    lines.flatMap((line) => [
      line.vat_tax_profile_id,
      line.tax2_tax_profile_id,
    ]),
  );
  const accounts = useLookupResource("chart_of_accounts", {
    search: "",
    enabled: false,
    selectedIds: accountIds,
  });
  const centers = useLookupResource("cost_center", {
    search: "",
    enabled: false,
    selectedIds: centerIds,
  });
  const profiles = useLookupResource<TaxProfileLookup>("tax_profile", {
    search: "",
    enabled: false,
    selectedIds: profileIds,
  });
  const byId = <T extends LookupItem>(items: readonly T[]) =>
    new Map(items.map((item) => [item.id, item]));
  const accountMap = byId(accounts.selectedItems),
    centerMap = byId(centers.selectedItems),
    profileMap = byId(profiles.selectedItems);
  return {
    accounts: accountMap,
    centers: centerMap,
    lines: lines.map((line) => ({
      ...line,
      cr_account_code:
        line.cr_account_code ||
        accountMap.get(line.cr_chart_of_accounts_id)?.code,
      dr_account_code:
        line.dr_account_code ||
        (line.dr_chart_of_accounts_id
          ? accountMap.get(line.dr_chart_of_accounts_id)?.code
          : undefined),
      cr_cost_center_code:
        line.cr_cost_center_code || centerMap.get(line.cr_cost_center_id)?.code,
      dr_cost_center_code:
        line.dr_cost_center_code ||
        (line.dr_cost_center_id
          ? centerMap.get(line.dr_cost_center_id)?.code
          : undefined),
      vat_account_code:
        line.vat_account_code ||
        (line.vat_chart_of_accounts_id
          ? accountMap.get(line.vat_chart_of_accounts_id)?.code
          : undefined),
      vat_cost_center_code:
        line.vat_cost_center_code ||
        (line.vat_cost_center_id
          ? centerMap.get(line.vat_cost_center_id)?.code
          : undefined),
      tax2_account_code:
        line.tax2_account_code ||
        (line.tax2_chart_of_accounts_id
          ? accountMap.get(line.tax2_chart_of_accounts_id)?.code
          : undefined),
      tax2_cost_center_code:
        line.tax2_cost_center_code ||
        (line.tax2_cost_center_id
          ? centerMap.get(line.tax2_cost_center_id)?.code
          : undefined),
      vat_profile_name:
        line.vat_profile_name ||
        (line.vat_tax_profile_id
          ? (profileMap.get(line.vat_tax_profile_id)?.name ?? undefined)
          : undefined),
      tax2_profile_name:
        line.tax2_profile_name ||
        (line.tax2_tax_profile_id
          ? (profileMap.get(line.tax2_tax_profile_id)?.name ?? undefined)
          : undefined),
    })),
  };
}
