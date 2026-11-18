import { lazy, Suspense } from "react";
import { useTranslations } from "use-intl";
import { useTaxProfile, useDeleteTaxProfile } from "@/hooks/use-tax-profile";
import type { TaxProfile } from "@/types/tax-profile";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useTaxProfileTable } from "./use-tax-profile-table";
import { TAX_PROFILE_FILTER_FIELDS } from "./tax-profile-filter-fields";
import TaxProfileCard from "./tax-profile-card";

// แทน next/dynamic ด้วย React.lazy (code-split dialog chunk เหมือนเดิม)
const TaxProfileDialog = lazy(() =>
  import("./tax-profile-dialog").then((mod) => ({
    default: mod.TaxProfileDialog,
  })),
);

export default function TaxProfileComponent() {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  return (
    <ConfigListTemplate<TaxProfile>
      fixedColumnWidths
      translationNamespace="config.taxProfile"
      entityNameField="name"
      useList={useTaxProfile}
      useDelete={useDeleteTaxProfile}
      useTable={useTaxProfileTable}
      permissionPrefix="configuration.tax_profile"
      pageKey={LIST_PAGE_KEYS.TAX_PROFILE}
      filterFields={TAX_PROFILE_FILTER_FIELDS}
      defaultSort="tax_rate:asc"
      exportColumns={[
        { header: tfl("name"), value: (r) => r.name, width: 28 },
        {
          header: tfl("taxRate"),
          value: (r) => r.tax_rate ?? 0,
          width: 12,
        },
        {
          header: tfl("status"),
          value: (r) => (r.is_active ? ts("active") : ts("inactive")),
          width: 10,
        },
      ]}
      renderDialog={({ open, onOpenChange, entity, readOnly }) => (
        <Suspense fallback={null}>
          <TaxProfileDialog
            open={open}
            onOpenChange={onOpenChange}
            taxProfile={entity}
            readOnly={readOnly}
          />
        </Suspense>
      )}
      renderCard={({ item, onEdit, onDelete, rowNo }) => (
        <TaxProfileCard rowNo={rowNo} item={item} onEdit={onEdit} onDelete={onDelete} />
      )}
    />
  );
}
