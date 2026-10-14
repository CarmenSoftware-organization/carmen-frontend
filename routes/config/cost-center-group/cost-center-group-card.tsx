import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import type { CostCenterGroup } from "@/types/cost-center-group";

interface Props {
  readonly item: CostCenterGroup;
  readonly onEdit: (item: CostCenterGroup) => void;
  readonly onDelete?: (item: CostCenterGroup) => void;
}

export default function CostCenterGroupCard({ item, onEdit, onDelete }: Props) {
  const tfl = useTranslations("field");

  return (
    <ListCard
      title={`${item.code} · ${item.name}`}
      onOpen={() => onEdit(item)}
      onDelete={onDelete ? () => onDelete(item) : undefined}
    >
      <ListCardActiveRow active={item.is_active} />
      {item.description && (
        <ListCardRow label={tfl("description")}>{item.description}</ListCardRow>
      )}
      {item.note && <ListCardRow label={tfl("note")}>{item.note}</ListCardRow>}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
