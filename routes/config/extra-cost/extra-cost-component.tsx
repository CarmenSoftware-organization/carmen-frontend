import { lazy, Suspense } from "react";
import { useTranslations } from "use-intl";
import { useExtraCost, useDeleteExtraCost } from "@/hooks/use-extra-cost";
import type { ExtraCost } from "@/types/extra-cost";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useExtraCostTable } from "./use-extra-cost-table";
import { EXTRA_COST_FILTER_FIELDS } from "./extra-cost-filter-fields";
import ExtraCostCard from "./extra-cost-card";

// แทน next/dynamic ด้วย React.lazy (code-split dialog chunk เหมือนเดิม)
const ExtraCostDialog = lazy(() =>
  import("./extra-cost-dialog").then((mod) => ({
    default: mod.ExtraCostDialog,
  })),
);

export default function ExtraCostComponent() {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  return (
    <ConfigListTemplate<ExtraCost>
      fixedColumnWidths
      translationNamespace="config.extraCost"
      entityNameField="name"
      useList={useExtraCost}
      useDelete={useDeleteExtraCost}
      useTable={useExtraCostTable}
      pageKey={LIST_PAGE_KEYS.EXTRA_COST}
      filterFields={EXTRA_COST_FILTER_FIELDS}
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
          <ExtraCostDialog
            open={open}
            onOpenChange={onOpenChange}
            extraCost={entity}
            readOnly={readOnly}
          />
        </Suspense>
      )}
      renderCard={({ item, onEdit, onDelete, rowNo }) => (
        <ExtraCostCard rowNo={rowNo} item={item} onEdit={onEdit} onDelete={onDelete} />
      )}
    />
  );
}
