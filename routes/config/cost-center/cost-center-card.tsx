import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import type { CostCenter } from "@/types/cost-center";

interface Props {
  readonly item: CostCenter;
  readonly onEdit: (item: CostCenter) => void;
  readonly onDelete?: (item: CostCenter) => void;
}

export default function CostCenterCard({ item, onEdit, onDelete }: Props) {
  const tfl = useTranslations("field");

  return (
    <ListCard
      title={`${item.code} · ${item.name}`}
      onOpen={() => onEdit(item)}
      onDelete={onDelete ? () => onDelete(item) : undefined}
    >
      <ListCardActiveRow active={item.is_active ?? true} />
      {item.cost_center_group_code && (
        <ListCardRow label={tfl("costCenterGroup")}>
          {item.cost_center_group_code} · {item.cost_center_group_name}
        </ListCardRow>
      )}
      {item.description && (
        <ListCardRow label={tfl("description")}>{item.description}</ListCardRow>
      )}
      {item.note && <ListCardRow label={tfl("note")}>{item.note}</ListCardRow>}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
