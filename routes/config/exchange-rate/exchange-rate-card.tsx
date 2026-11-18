import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
} from "@/components/share/list-card";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { formatCurrency } from "@/lib/currency-utils";
import type { ExchangeRateItem } from "@/types/exchange-rate";

interface Props {
  /** เลขลำดับแถว (`rowNumber()`) → `ListCard rowNo` */
  readonly rowNo?: number;
  readonly item: ExchangeRateItem;
  readonly baseCurrency?: string;
  readonly onEdit: (item: ExchangeRateItem) => void;
  readonly onDelete?: (item: ExchangeRateItem) => void;
}

export default function ExchangeRateCard({
  item,
  baseCurrency,
  onEdit,
  onDelete,
  rowNo,
}: Props) {
  const tfl = useTranslations("field");
  const { dateFormat } = useProfile();

  return (
    <ListCard
      rowNo={rowNo}
      title={item.currency?.code}
      onOpen={() => onEdit(item)}
      onDelete={onDelete ? () => onDelete(item) : undefined}
    >
      <ListCardRow label={tfl("exchangeRate")}>
        <span className="tabular-nums">
          1 {item.currency?.code} = {formatCurrency(item.exchange_rate, 4)}{" "}
          <span className="text-muted-foreground font-normal">
            {baseCurrency}
          </span>
        </span>
      </ListCardRow>
      {item.at_date && (
        <ListCardRow label={tfl("date")}>
          <span className="tabular-nums">
            {formatDate(item.at_date, dateFormat)}
          </span>
        </ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
