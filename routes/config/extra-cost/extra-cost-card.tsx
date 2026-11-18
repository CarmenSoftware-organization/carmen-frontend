import {
  ListCard,
  ListCardActiveRow,
  ListCardAuditRows,
} from "@/components/share/list-card";
import type { ExtraCost } from "@/types/extra-cost";

interface Props {
  readonly rowNo?: number;
  readonly item: ExtraCost;
  readonly onEdit: (item: ExtraCost) => void;
  readonly onDelete?: (item: ExtraCost) => void;
}

export default function ExtraCostCard({ item, onEdit, onDelete, rowNo }: Props) {
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
