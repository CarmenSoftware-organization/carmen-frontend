import { useTranslations } from "use-intl";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
} from "@/components/share/list-card";
import type { PriceList, PriceListStatus } from "@/types/price-list";
import { PlPeriodCell } from "./pl-period-cell";

interface PriceListCardProps {
  readonly item: PriceList;
  readonly onEdit: (item: PriceList) => void;
  readonly onVoid: (item: PriceList) => void;
  readonly quietExpired?: boolean;
}

export default function PriceListCard({
  item,
  onEdit,
  onVoid,
  quietExpired = false,
}: PriceListCardProps) {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const t = useTranslations("vendorManagement.priceList");

  return (
    <ListCard
      title={item.name || "..."}
      badge={
        <StatusIconLabel
          status={item.status}
          label={ts(
            item.status as PriceListStatus,
          )}
          className="uppercase"
        />
      }
      onOpen={() => onEdit(item)}
      onDelete={() => onVoid(item)}
      deleteLabel={t("void")}
      deleteDisabledTitle={
        item.status === "voided" ? t("alreadyVoided") : undefined
      }
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
