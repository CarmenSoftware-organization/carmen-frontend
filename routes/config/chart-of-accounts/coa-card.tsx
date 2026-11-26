import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import type { ChartOfAccount } from "@/types/chart-of-accounts";
import { secondaryName } from "./use-coa-table";

interface Props {
  readonly rowNo?: number;
  readonly item: ChartOfAccount;
  readonly onEdit: (item: ChartOfAccount) => void;
  readonly onDelete?: (item: ChartOfAccount) => void;
}

export default function CoaCard({ item, onEdit, onDelete, rowNo }: Props) {
  const t = useTranslations("config.chartOfAccounts");
  const tfl = useTranslations("field");
  const secondary = secondaryName(item);

  return (
    <ListCard
      rowNo={rowNo}
      title={item.code || "..."}
      onOpen={() => onEdit(item)}
      onDelete={onDelete ? () => onDelete(item) : undefined}
    >
      <ListCardActiveRow active={item.is_active} />
      <ListCardRow label={t("accountName")}>{item.description_1}</ListCardRow>
      {secondary && (
        <ListCardRow label={tfl("description")}>{secondary}</ListCardRow>
      )}
      <ListCardRow label={tfl("category")}>
        {item.category ? (
          t(`accountCategory.${item.category}`)
        ) : (
          <span className="text-warning-ink">{t("labels.categoryUnset")}</span>
        )}
      </ListCardRow>
      <ListCardRow label={tfl("nature")}>
        {t(`nature.${item.nature}`)}
      </ListCardRow>
      <ListCardRow label={tfl("type")}>
        {t(`accountType.${item.type}`)}
      </ListCardRow>
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
