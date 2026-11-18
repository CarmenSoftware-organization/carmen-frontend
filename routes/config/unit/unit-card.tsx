import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import type { Unit } from "@/types/unit";

interface Props {
  readonly rowNo?: number;
  readonly item: Unit;
  readonly onEdit: (item: Unit) => void;
  readonly onDelete?: (item: Unit) => void;
}

export default function UnitCard({ item, onEdit, onDelete, rowNo }: Props) {
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
      <ListCardRow label={tfl("decimalPlaces")}>
        {item.decimal_place ?? 0}
      </ListCardRow>
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
