import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import type { ChartOfAccount } from "@/types/chart-of-accounts";

interface Props {
  readonly item: ChartOfAccount;
  readonly onEdit: (item: ChartOfAccount) => void;
  readonly onDelete?: (item: ChartOfAccount) => void;
}

export default function CoaCard({ item, onEdit, onDelete }: Props) {
  const t = useTranslations("config.chartOfAccounts");
  const tfl = useTranslations("field");

  return (
    <ListCard
      title={item.code || "..."}
      onOpen={() => onEdit(item)}
      onDelete={onDelete ? () => onDelete(item) : undefined}
    >
      <ListCardActiveRow active={item.is_active} />
      <ListCardRow label={t("accountName")}>{item.description_1}</ListCardRow>
      {item.description_2 && (
        <ListCardRow label={tfl("description")}>
          {item.description_2}
        </ListCardRow>
      )}
      <ListCardRow label={tfl("category")}>
        {item.category ? (
          t(`accountCategory.${item.category}`)
        ) : (
          <span className="text-warning-ink">{t("labels.categoryUnset")}</span>
        )}
      </ListCardRow>
      <ListCardRow label={tfl("nature")}>
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`inline-flex size-4.5 items-center justify-center rounded text-micro-legal font-bold ${
              item.nature === "debit"
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {item.nature === "debit" ? "D" : "C"}
          </span>
          <span>{t(`nature.${item.nature}`)}</span>
        </span>
      </ListCardRow>
      <ListCardRow label={tfl("type")}>
        {t(`accountType.${item.type}`)}
      </ListCardRow>
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
