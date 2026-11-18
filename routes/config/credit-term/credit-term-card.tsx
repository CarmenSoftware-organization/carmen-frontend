import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import type { CreditTerm } from "@/types/credit-term";

interface Props {
  readonly rowNo?: number;
  readonly item: CreditTerm;
  readonly onEdit: (item: CreditTerm) => void;
  readonly onDelete?: (item: CreditTerm) => void;
}

export default function CreditTermCard({ item, onEdit, onDelete, rowNo }: Props) {
  const tfl = useTranslations("field");

  return (
    <ListCard
      rowNo={rowNo}
      title={item.name || "..."}
      onOpen={() => onEdit(item)}
      onDelete={onDelete ? () => onDelete(item) : undefined}
    >
      <ListCardActiveRow active={item.is_active} />
      {item.value != null && (
        <ListCardRow label={tfl("creditTerm")}>
          <span className="tabular-nums">
            {item.value}{" "}
            <span className="text-muted-foreground font-normal">
              {tfl("creditTermDays")}
            </span>
          </span>
        </ListCardRow>
      )}
      {item.description && (
        <ListCardRow label={tfl("description")}>{item.description}</ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
