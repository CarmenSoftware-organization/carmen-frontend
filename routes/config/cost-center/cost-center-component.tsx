import { useTranslations } from "use-intl";
import { useCostCenter, useDeleteCostCenter } from "@/hooks/use-cost-center";
import type { CostCenter } from "@/types/cost-center";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { CostCenterDialog } from "./cost-center-dialog";
import { useCostCenterTable } from "./use-cost-center-table";
import { COST_CENTER_FILTER_FIELDS } from "./cost-center-filter-fields";
import CostCenterCard from "./cost-center-card";
import { CostCenterImportCarmenGlButton } from "./cost-center-import-carmen-gl-button";

export default function CostCenterComponent() {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  return (
    <ConfigListTemplate<CostCenter>
      translationNamespace="config.costCenter"
      entityNameField="name"
      useList={useCostCenter}
      useDelete={useDeleteCostCenter}
      useTable={useCostCenterTable}
      pageKey={LIST_PAGE_KEYS.COST_CENTER}
      filterFields={COST_CENTER_FILTER_FIELDS}
      defaultSort="code:asc"
      extraActions={<CostCenterImportCarmenGlButton />}
      exportColumns={[
        { header: tfl("code"), value: (r) => r.code, width: 14 },
        { header: tfl("name"), value: (r) => r.name, width: 28 },
        {
          header: tfl("costCenterGroup"),
          value: (r) =>
            r.cost_center_group_code
              ? `${r.cost_center_group_code} · ${r.cost_center_group_name ?? ""}`
              : "",
          width: 28,
        },
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
        <CostCenterDialog
          open={open}
          onOpenChange={onOpenChange}
          costCenter={entity}
          readOnly={readOnly}
        />
      )}
      renderCard={({ item, onEdit, onDelete }) => (
        <CostCenterCard item={item} onEdit={onEdit} onDelete={onDelete} />
      )}
    />
  );
}
