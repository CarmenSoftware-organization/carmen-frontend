import { useTranslations } from "use-intl";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import {
  useAdjustmentType,
  useDeleteAdjustmentType,
} from "@/hooks/use-adjustment-type";
import { ADJUSTMENT_TYPE, type AdjustmentType } from "@/types/adjustment-type";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useAdjustmentTypeTable } from "./use-adjustment-type-table";
// import { ADJUSTMENT_TYPE_FILTER_FIELDS } from "./adjustment-type-filter-fields";
import { AdjustmentTypeDialog } from "./adjustment-type-dialog";
import AdjustmentTypeCard from "./adjustment-type-card";
import { FilterFieldDef } from "@/types/list-filter";

const ADJUSTMENT_TYPE_FILTER_FIELDS: FilterFieldDef[] = [
  {
    key: "filter",
    control: "status",
    labelKey: "common.status",
    options: [
      { labelKey: "status.active", value: "is_active|bool:true" },
      { labelKey: "status.inactive", value: "is_active|bool:false" },
    ],
  },
  {
    key: "adj_type",
    control: "multi-select",
    labelKey: "field.type",
    options: [
      {
        labelKey: "field.stockIn",
        value: `type|string:${ADJUSTMENT_TYPE.STOCK_IN}`,
      },
      {
        labelKey: "field.stockOut",
        value: `type|string:${ADJUSTMENT_TYPE.STOCK_OUT}`,
      },
    ],
  },
];

export default function AdjustmentTypeComponent() {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");

  return (
    <ConfigListTemplate<AdjustmentType>
      fixedColumnWidths
      translationNamespace="config.adjustmentType"
      entityNameField="name"
      useList={useAdjustmentType}
      useDelete={useDeleteAdjustmentType}
      useTable={useAdjustmentTypeTable}
      permissionPrefix="configuration.adjustment_type"
      pageKey={LIST_PAGE_KEYS.ADJUSTMENT_TYPE}
      filterFields={ADJUSTMENT_TYPE_FILTER_FIELDS}
      defaultSort="code:asc,name:asc"
      exportColumns={[
        { header: tfl("code"), value: (r) => r.code, width: 14 },
        { header: tfl("name"), value: (r) => r.name, width: 28 },
        { header: tfl("type"), value: (r) => r.type, width: 14 },
        {
          header: tfl("description"),
          value: (r) => r.description ?? "",
          width: 32,
        },
        {
          header: tfl("note"),
          value: (r) => r.note ?? "",
          width: 32,
        },
        {
          header: tfl("status"),
          value: (r) => (r.is_active ? ts("active") : ts("inactive")),
          width: 10,
        },
      ]}
      renderDialog={({ open, onOpenChange, entity, readOnly }) => (
        <AdjustmentTypeDialog
          open={open}
          onOpenChange={onOpenChange}
          adjustmentType={entity}
          readOnly={readOnly}
        />
      )}
      renderCard={({ item, onEdit, onDelete }) => (
        <AdjustmentTypeCard item={item} onEdit={onEdit} onDelete={onDelete} />
      )}
    />
  );
}
