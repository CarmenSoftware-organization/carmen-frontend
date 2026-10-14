import { useTranslations } from "use-intl";
import {
  useCostCenterGroup,
  useDeleteCostCenterGroup,
} from "@/routes/config/shared/use-cost-center-group";
import type { CostCenterGroup } from "@/types/cost-center-group";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { CostCenterGroupDialog } from "./cost-center-group-dialog";
import { useCostCenterGroupTable } from "./use-cost-center-group-table";
import { COST_CENTER_GROUP_FILTER_FIELDS } from "./cost-center-group-filter-fields";
import CostCenterGroupCard from "./cost-center-group-card";

export default function CostCenterGroupComponent() {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  return (
    <ConfigListTemplate<CostCenterGroup>
      translationNamespace="config.costCenterGroup"
      entityNameField="name"
      useList={useCostCenterGroup}
      useDelete={useDeleteCostCenterGroup}
      useTable={useCostCenterGroupTable}
      pageKey={LIST_PAGE_KEYS.COST_CENTER_GROUP}
      filterFields={COST_CENTER_GROUP_FILTER_FIELDS}
      defaultSort="code:asc"
      exportColumns={[
        { header: tfl("code"), value: (r) => r.code, width: 14 },
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
        <CostCenterGroupDialog
          open={open}
          onOpenChange={onOpenChange}
          costCenterGroup={entity}
          readOnly={readOnly}
        />
      )}
      renderCard={({ item, onEdit, onDelete }) => (
        <CostCenterGroupCard item={item} onEdit={onEdit} onDelete={onDelete} />
      )}
    />
  );
}
