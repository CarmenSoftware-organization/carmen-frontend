import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import type { Shelf } from "@/types/shelf";

interface Props {
  readonly rowNo?: number;
  readonly item: Shelf;
  readonly onEdit: (item: Shelf) => void;
  readonly onDelete?: (item: Shelf) => void;
}

export default function ShelfCard({ item, onEdit, onDelete, rowNo }: Props) {
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
      {item.description && (
        <ListCardRow label={tfl("description")}>{item.description}</ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
