import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
} from "@/components/share/list-card";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { RequestPriceList } from "@/types/request-price-list";
import { RfpResponses, RfpWindowBadge } from "./rfp-list-cells";

interface RfpCardProps {
  readonly item: RequestPriceList;
  readonly onEdit: (item: RequestPriceList) => void;
  readonly onDelete: (item: RequestPriceList) => void;
}

export default function RfpCard({ item, onEdit, onDelete }: RfpCardProps) {
  const tfl = useTranslations("field");
  const { dateFormat } = useProfile();

  const period = (() => {
    const from = formatDate(item.start_date, dateFormat);
    const to = formatDate(item.end_date, dateFormat);
    if (!from && !to) return null;
    return `${from} - ${to}`;
  })();

  return (
    <ListCard
      title={item.name || "..."}
      badge={<RfpWindowBadge item={item} />}
      onOpen={() => onEdit(item)}
      onDelete={() => onDelete(item)}
    >
      {item.pricelist_template?.name && (
        <ListCardRow label={tfl("template")}>
          {item.pricelist_template.name}
        </ListCardRow>
      )}
      {period && (
        <ListCardRow label={tfl("effectivePeriod")}>
          <span className="tabular-nums">{period}</span>
        </ListCardRow>
      )}
      <ListCardRow label={tfl("responses")}>
        <RfpResponses item={item} />
      </ListCardRow>
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
