import {
  ListCard,
  ListCardActiveRow,
  ListCardAuditRows,
} from "@/components/share/list-card";
import type { BusinessType } from "@/types/business-type";

interface Props {
  readonly rowNo?: number;
  readonly item: BusinessType;
  readonly onEdit: (item: BusinessType) => void;
  readonly onDelete?: (item: BusinessType) => void;
}

export default function BusinessTypeCard({ item, onEdit, onDelete, rowNo }: Props) {
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
