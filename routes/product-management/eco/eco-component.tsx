import { lazy, Suspense } from "react";
import { useTranslations } from "use-intl";
import { useEcoLabel, useDeleteEcoLabel } from "../shared/use-eco-label";
import type { EcoLabel } from "@/types/eco-label";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useEcoLabelTable } from "./use-eco-table";
import { ECO_FILTER_FIELDS } from "./eco-filter-fields";
import EcoLabelCard from "./eco-card";

// แทน next/dynamic ด้วย React.lazy (code-split dialog chunk เหมือนเดิม)
const EcoLabelDialog = lazy(() =>
  import("./eco-dialog").then((mod) => ({ default: mod.EcoLabelDialog })),
);

export default function EcoComponent() {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  return (
    <ConfigListTemplate<EcoLabel>
      translationNamespace="productManagement.eco"
      entityNameField="name"
      useList={useEcoLabel}
      useDelete={useDeleteEcoLabel}
      useTable={useEcoLabelTable}
      pageKey={LIST_PAGE_KEYS.ECO}
      filterFields={ECO_FILTER_FIELDS}
      defaultSort="code:asc"
      exportColumns={[
        { header: tfl("code"), value: (r) => r.code, width: 16 },
        { header: tfl("name"), value: (r) => r.name, width: 28 },
        {
          header: tfl("description"),
          value: (r) => r.description ?? "",
          width: 40,
        },
        {
          header: tfl("status"),
          value: (r) => (r.is_active ? ts("active") : ts("inactive")),
          width: 10,
        },
      ]}
      renderDialog={({ open, onOpenChange, entity, readOnly }) => (
        <Suspense fallback={null}>
          <EcoLabelDialog
            open={open}
            onOpenChange={onOpenChange}
            ecoLabel={entity}
            readOnly={readOnly}
          />
        </Suspense>
      )}
      renderCard={({ item, onEdit, onDelete }) => (
        <EcoLabelCard item={item} onEdit={onEdit} onDelete={onDelete} />
      )}
    />
  );
}
