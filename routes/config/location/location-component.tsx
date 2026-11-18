import { useTranslations } from "use-intl";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import { useLocation, useDeleteLocation } from "@/hooks/use-location";
import type { Location } from "@/types/location";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useLocationTable } from "./use-location-table";
import { LOCATION_FILTER_FIELDS } from "./location-filter-fields";
import LocationCard from "./location-card";

export default function LocationComponent() {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");

  return (
    <ConfigListTemplate<Location>
      fixedColumnWidths
      translationNamespace="config.location"
      entityNameField="name"
      useList={useLocation}
      useDelete={useDeleteLocation}
      useTable={useLocationTable}
      permissionPrefix="configuration.location"
      pageKey={LIST_PAGE_KEYS.LOCATION}
      filterFields={LOCATION_FILTER_FIELDS}
      addPath="/config/location/new"
      getEditPath={(loc) => `/config/location/${loc.id}`}
      exportColumns={[
        { header: tfl("code"), value: (r) => r.code, width: 14 },
        { header: tfl("name"), value: (r) => r.name, width: 28 },
        {
          header: tfl("locationType"),
          value: (r) => r.location_type,
          width: 14,
        },
        {
          header: tfl("physicalCount"),
          value: (r) => r.physical_count_type,
          width: 12,
        },
        {
          header: tfl("deliveryPoint"),
          value: (r) => r.delivery_point_name ?? "",
          width: 22,
        },
        {
          header: tfl("description"),
          value: (r) => r.description ?? "",
          width: 32,
        },
        {
          header: tfl("status"),
          value: (r) => (r.is_active ? ts("active") : ts("inactive")),
          width: 10,
        },
      ]}
      renderCard={({ item, onEdit, onDelete, rowNo }) => (
        <LocationCard rowNo={rowNo} item={item} onEdit={onEdit} onDelete={onDelete} />
      )}
    />
  );
}
