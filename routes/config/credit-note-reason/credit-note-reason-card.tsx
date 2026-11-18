import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import type { CnReason } from "@/types/cn-reason";

interface Props {
  readonly rowNo?: number;
  readonly item: CnReason;
  readonly onEdit: (item: CnReason) => void;
  readonly onDelete?: (item: CnReason) => void;
}

export default function CreditNoteReasonCard({
  item,
  onEdit,
  onDelete,
  rowNo,
}: Props) {
  const tfl = useTranslations("field");

  return (
    <ListCard
      rowNo={rowNo}
      title={item.name || "..."}
      onOpen={() => onEdit(item)}
      onDelete={onDelete ? () => onDelete(item) : undefined}
    >
      <ListCardActiveRow active={item.is_active} />
      {item.description && (
        <ListCardRow label={tfl("description")}>{item.description}</ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
