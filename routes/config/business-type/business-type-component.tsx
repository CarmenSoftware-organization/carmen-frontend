import { lazy, Suspense } from "react";
import { useTranslations } from "use-intl";
import {
  useBusinessType,
  useDeleteBusinessType,
} from "@/hooks/use-business-type";
import type { BusinessType } from "@/types/business-type";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useBusinessTypeTable } from "./use-business-type-table";
import { BUSINESS_TYPE_FILTER_FIELDS } from "./business-type-filter-fields";
import BusinessTypeCard from "./business-type-card";

// แทน next/dynamic ด้วย React.lazy (code-split dialog chunk เหมือนเดิม)
const BusinessTypeDialog = lazy(() =>
  import("./business-type-dialog").then((mod) => ({
    default: mod.BusinessTypeDialog,
  })),
);

export default function BusinessTypeComponent() {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  return (
    <ConfigListTemplate<BusinessType>
      fixedColumnWidths
      translationNamespace="config.businessType"
      entityNameField="name"
      useList={useBusinessType}
      useDelete={useDeleteBusinessType}
      useTable={useBusinessTypeTable}
      permissionPrefix="configuration.business_type"
      pageKey={LIST_PAGE_KEYS.BUSINESS_TYPE}
      filterFields={BUSINESS_TYPE_FILTER_FIELDS}
      defaultSort="name:asc"
      exportColumns={[
        { header: tfl("name"), value: (r) => r.name, width: 28 },
        {
          header: tfl("status"),
          value: (r) => (r.is_active ? ts("active") : ts("inactive")),
          width: 10,
        },
      ]}
      renderDialog={({ open, onOpenChange, entity, readOnly }) => (
        <Suspense fallback={null}>
          <BusinessTypeDialog
            open={open}
            onOpenChange={onOpenChange}
            businessType={entity}
            readOnly={readOnly}
          />
        </Suspense>
      )}
      renderCard={({ item, onEdit, onDelete, rowNo }) => (
        <BusinessTypeCard rowNo={rowNo} item={item} onEdit={onEdit} onDelete={onDelete} />
      )}
    />
  );
}
