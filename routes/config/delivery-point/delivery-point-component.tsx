import { useTranslations } from "use-intl";
import {
  useDeliveryPoint,
  useDeleteDeliveryPoint,
} from "@/hooks/use-delivery-point";
import type { DeliveryPoint } from "@/types/delivery-point";
import { DeliveryPointDialog } from "@/components/share/delivery-point-dialog";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useDeliveryPointTable } from "./use-delivery-point-table";
import { DELIVERY_POINT_FILTER_FIELDS } from "./delivery-point-filter-fields";
import DeliveryPointCard from "./delivery-point-card";

export default function DeliveryPointComponent() {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  return (
    <ConfigListTemplate<DeliveryPoint>
      fixedColumnWidths
      translationNamespace="config.deliveryPoint"
      entityNameField="name"
      useList={useDeliveryPoint}
      useDelete={useDeleteDeliveryPoint}
      useTable={useDeliveryPointTable}
      permissionPrefix="configuration.delivery_point"
      pageKey={LIST_PAGE_KEYS.DELIVERY_POINT}
      filterFields={DELIVERY_POINT_FILTER_FIELDS}
      exportColumns={[
        { header: tfl("name"), value: (r) => r.name, width: 28 },
        {
          header: tfl("status"),
          value: (r) => (r.is_active ? ts("active") : ts("inactive")),
          width: 10,
        },
      ]}
      renderDialog={({ open, onOpenChange, entity, readOnly }) => (
        <DeliveryPointDialog
          open={open}
          onOpenChange={onOpenChange}
          deliveryPoint={entity}
          readOnly={readOnly}
        />
      )}
      renderCard={({ item, onEdit, onDelete }) => (
        <DeliveryPointCard item={item} onEdit={onEdit} onDelete={onDelete} />
      )}
    />
  );
}
