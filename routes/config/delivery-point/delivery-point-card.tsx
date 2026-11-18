import {
  ListCard,
  ListCardActiveRow,
  ListCardAuditRows,
} from "@/components/share/list-card";
import type { DeliveryPoint } from "@/types/delivery-point";

interface Props {
  readonly rowNo?: number;
  readonly item: DeliveryPoint;
  readonly onEdit: (item: DeliveryPoint) => void;
  readonly onDelete?: (item: DeliveryPoint) => void;
}

export default function DeliveryPointCard({ item, onEdit, onDelete, rowNo }: Props) {
  return (
    <ListCard
      rowNo={rowNo}
      title={item.name || "..."}
      onOpen={() => onEdit(item)}
      onDelete={onDelete ? () => onDelete(item) : undefined}
    >
      <ListCardActiveRow active={item.is_active} />
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
