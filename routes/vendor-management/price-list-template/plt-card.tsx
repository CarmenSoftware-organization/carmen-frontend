import { useTranslations } from "use-intl";
import { StatusChip } from "@/components/ui/status-chip";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
} from "@/components/share/list-card";
import type { PriceListTemplate } from "@/types/price-list-template";

interface PltCardProps {
  readonly item: PriceListTemplate;
  readonly onEdit: (item: PriceListTemplate) => void;
  readonly onDelete: (item: PriceListTemplate) => void;
}

export default function PltCard({ item, onEdit, onDelete }: PltCardProps) {
  const t = useTranslations("vendorManagement.priceListTemplate");
  const tfl = useTranslations("field");
  const ts = useTranslations("status");

  return (
    <ListCard
      title={item.name || "..."}
      badge={
        <StatusChip
          status={item.status}
          label={ts(item.status as "draft" | "active" | "inactive")}
        />
      }
      onOpen={() => onEdit(item)}
      onDelete={() => onDelete(item)}
    >
      {item.description && (
        <ListCardRow label={tfl("description")}>{item.description}</ListCardRow>
      )}
      {item.currency?.code && (
        <ListCardRow label={tfl("currency")}>{item.currency.code}</ListCardRow>
      )}
      {item.validity_period != null && (
        <ListCardRow label={tfl("validityPeriod")}>
          <span className="tabular-nums">
            {t("validityDays", { count: item.validity_period })}
          </span>
        </ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
