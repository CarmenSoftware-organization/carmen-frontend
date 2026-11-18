import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import type { TaxProfile } from "@/types/tax-profile";

interface Props {
  readonly rowNo?: number;
  readonly item: TaxProfile;
  readonly onEdit: (item: TaxProfile) => void;
  readonly onDelete?: (item: TaxProfile) => void;
}

export default function TaxProfileCard({ item, onEdit, onDelete, rowNo }: Props) {
  const tfl = useTranslations("field");

  return (
    <ListCard
      rowNo={rowNo}
      title={item.name || "..."}
      onOpen={() => onEdit(item)}
      onDelete={onDelete ? () => onDelete(item) : undefined}
    >
      <ListCardActiveRow active={item.is_active} />
      {item.tax_rate != null && (
        <ListCardRow label={tfl("taxRate")}>
          <span className="tabular-nums">{item.tax_rate}</span>
        </ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
