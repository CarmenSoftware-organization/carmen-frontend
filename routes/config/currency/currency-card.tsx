import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import type { Currency } from "@/types/currency";

interface Props {
  readonly rowNo?: number;
  readonly item: Currency;
  readonly onEdit: (item: Currency) => void;
  readonly onDelete?: (item: Currency) => void;
}

export default function CurrencyCard({ item, onEdit, onDelete, rowNo }: Props) {
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
      {item.symbol && (
        <ListCardRow label={tfl("symbol")}>{item.symbol}</ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
