import { useTranslations } from "use-intl";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
} from "@/components/share/list-card";
import type { PriceList } from "@/types/price-list";
import { PlPeriodCell } from "./pl-period-cell";

interface PriceListCardProps {
  readonly item: PriceList;
  readonly onEdit: (item: PriceList) => void;
  readonly onDelete: (item: PriceList) => void;
  readonly quietExpired?: boolean;
}

export default function PriceListCard({
  item,
  onEdit,
  onDelete,
  quietExpired = false,
}: PriceListCardProps) {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");

  return (
    <ListCard
      title={item.name || "..."}
      badge={
        <StatusIconLabel
          status={item.status}
          label={ts(
            item.status as "draft" | "submitted" | "active" | "inactive",
          )}
          className="uppercase"
        />
      }
      onOpen={() => onEdit(item)}
      onDelete={() => onDelete(item)}
    >
      {item.no && <ListCardRow label={tfl("no")}>{item.no}</ListCardRow>}
      {item.vendor?.name && (
        <ListCardRow label={tfl("vendor")}>{item.vendor.name}</ListCardRow>
      )}
      {item.effectivePeriod && (
        <ListCardRow label={tfl("effectivePeriod")}>
          <PlPeriodCell
            period={item.effectivePeriod}
            className="text-right"
            compact
            quietExpired={quietExpired}
          />
        </ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
