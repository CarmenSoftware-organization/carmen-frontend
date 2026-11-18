import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import { ADJUSTMENT_TYPE } from "@/types/adjustment-type";
import type { AdjustmentType } from "@/types/adjustment-type";

interface Props {
  readonly rowNo?: number;
  readonly item: AdjustmentType;
  readonly onEdit: (item: AdjustmentType) => void;
  readonly onDelete?: (item: AdjustmentType) => void;
}

export default function AdjustmentTypeCard({ item, onEdit, onDelete, rowNo }: Props) {
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
        {item.type === ADJUSTMENT_TYPE.STOCK_IN
          ? tfl("stockIn")
          : tfl("stockOut")}
      </ListCardRow>
      {item.description && (
        <ListCardRow label={tfl("description")}>{item.description}</ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
