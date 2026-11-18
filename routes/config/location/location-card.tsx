import { useTranslations } from "use-intl";
import { LocationTypeLabel } from "@/components/share/location-type-label";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import type { Location } from "@/types/location";

interface Props {
  readonly rowNo?: number;
  readonly item: Location;
  readonly onEdit: (item: Location) => void;
  readonly onDelete?: (item: Location) => void;
}

export default function LocationCard({ item, onEdit, onDelete, rowNo }: Props) {
  const tc = useTranslations("common");
  const tfl = useTranslations("field");

  return (
    <ListCard
      rowNo={rowNo}
      title={item.name || "..."}
      onOpen={() => onEdit(item)}
      onDelete={onDelete ? () => onDelete(item) : undefined}
    >
      <ListCardActiveRow active={item.is_active} />
      {item.code && <ListCardRow label={tfl("code")}>{item.code}</ListCardRow>}
      <ListCardRow label={tfl("type")}>
        <LocationTypeLabel type={item.location_type} />
      </ListCardRow>
      <ListCardRow label={tfl("physicalCount")}>
        {item.physical_count_type === "yes" ? tc("yes") : tc("no")}
      </ListCardRow>
      {item.delivery_point?.name && (
        <ListCardRow label={tfl("deliveryPoint")}>
          {item.delivery_point.name}
        </ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
