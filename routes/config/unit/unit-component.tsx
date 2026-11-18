import { useTranslations } from "use-intl";
import { useUnit, useDeleteUnit } from "@/hooks/use-unit";
import type { Unit } from "@/types/unit";
import { UnitDialog } from "@/components/share/unit-dialog";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useUnitTable } from "./use-unit-table";
import { UNIT_FILTER_FIELDS } from "./unit-filter-fields";
import UnitCard from "./unit-card";

export default function UnitComponent() {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  return (
    <ConfigListTemplate<Unit>
      fixedColumnWidths
      translationNamespace="config.unit"
      entityNameField="name"
      useList={useUnit}
      useDelete={useDeleteUnit}
      useTable={useUnitTable}
      pageKey={LIST_PAGE_KEYS.UNIT}
      filterFields={UNIT_FILTER_FIELDS}
      exportColumns={[
        { header: tfl("name"), value: (r) => r.name, width: 24 },
        {
          header: tfl("description"),
          value: (r) => r.description ?? "",
          width: 40,
        },
        {
          header: tfl("decimalPlaces"),
          value: (r) => r.decimal_place ?? 0,
          width: 14,
        },
        {
          header: tfl("status"),
          value: (r) => (r.is_active ? ts("active") : ts("inactive")),
          width: 10,
        },
      ]}
      renderDialog={({ open, onOpenChange, entity, readOnly }) => (
        <UnitDialog
          open={open}
          onOpenChange={onOpenChange}
          unit={entity}
          readOnly={readOnly}
        />
      )}
      renderCard={({ item, onEdit, onDelete, rowNo }) => (
        <UnitCard rowNo={rowNo} item={item} onEdit={onEdit} onDelete={onDelete} />
      )}
    />
  );
}
