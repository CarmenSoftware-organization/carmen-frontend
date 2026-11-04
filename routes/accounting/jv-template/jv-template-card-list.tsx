import { useTranslations } from "use-intl";
import EmptyComponent from "@/components/empty-component";
import {
  ListCard,
  ListCardRow,
  ListCardSkeleton,
  ListCardStatusRow,
} from "@/components/share/list-card";
import { formatCurrency } from "@/lib/currency-utils";
import type { JvTemplatePageKind } from "./jv-template-config";
import type { JvTemplate } from "./jv-template-types";
import {
  jvTemplateActiveLabel,
  jvTemplateAmount,
  jvTemplateAmountLabelKey,
  jvTemplatePeriodRange,
  jvTemplateTypeLabel,
} from "./jv-template-labels";

interface JvTemplateCardListProps {
  readonly kind: JvTemplatePageKind;
  readonly items: JvTemplate[];
  readonly isLoading?: boolean;
  readonly onOpen: (item: JvTemplate) => void;
  readonly onDelete?: (item: JvTemplate) => void;
}

/** การ์ด template สำหรับโหมด grid/มือถือ — ท่าเดียวกับ `JvCardList` */
export default function JvTemplateCardList({
  kind,
  items,
  isLoading,
  onOpen,
  onDelete,
}: JvTemplateCardListProps) {
  const t = useTranslations("accounting.jvTemplate");

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ListCardSkeleton key={`skeleton-${i}`} />
        ))}
      </div>
    );
  }

  if (items.length === 0) return <EmptyComponent />;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => {
        const amount = jvTemplateAmount(item);
        return (
          <ListCard
            key={item.id}
            title={item.code}
            onOpen={() => onOpen(item)}
            onDelete={onDelete ? () => onDelete(item) : undefined}
          >
            <ListCardStatusRow
              status={item.is_active ? "active" : "inactive"}
              label={jvTemplateActiveLabel(t, item.is_active)}
            />
            <ListCardRow label={t("name")}>{item.name}</ListCardRow>
            {kind === "all" && (
              <ListCardRow label={t("type")}>
                {jvTemplateTypeLabel(t, item.template_type)}
              </ListCardRow>
            )}
            <ListCardRow label={t("periodRange")}>
              <span className="tabular-nums">
                {jvTemplatePeriodRange(item)}
              </span>
            </ListCardRow>
            {amount !== null && (
              <ListCardRow label={t(jvTemplateAmountLabelKey(kind))}>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(amount)}
                </span>
              </ListCardRow>
            )}
            {item.template_type === "recurring" &&
              item.frequency_months !== null && (
                <ListCardRow label={t("frequencyMonths")}>
                  <span className="tabular-nums">{item.frequency_months}</span>
                </ListCardRow>
              )}
          </ListCard>
        );
      })}
    </div>
  );
}
