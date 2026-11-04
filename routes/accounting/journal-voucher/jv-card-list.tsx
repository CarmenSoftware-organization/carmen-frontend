import { useTranslations } from "use-intl";
import EmptyComponent from "@/components/empty-component";
import {
  ListCard,
  ListCardRow,
  ListCardSkeleton,
  ListCardStatusRow,
} from "@/components/share/list-card";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { formatCurrency } from "@/lib/currency-utils";
import type { JournalVoucher } from "@/types/journal-voucher";
import { jvSourceLabel, jvStatusLabel } from "./jv-status";

interface JvCardListProps {
  readonly items: JournalVoucher[];
  readonly isLoading?: boolean;
  readonly onEdit: (item: JournalVoucher) => void;
  readonly onDelete: (item: JournalVoucher) => void;
}

/** การ์ด JV สำหรับโหมด grid/มือถือ — ท่าเดียวกับ `PoCardList` */
export default function JvCardList({
  items,
  isLoading,
  onEdit,
  onDelete,
}: JvCardListProps) {
  const t = useTranslations("accounting.journalVoucher");
  const tfl = useTranslations("field");
  const { dateFormat } = useProfile();

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
        const debit = Number(item.total_debit);
        return (
          <ListCard
            key={item.id}
            title={item.display_no}
            onOpen={() => onEdit(item)}
            onDelete={() => onDelete(item)}
            deleteDisabledTitle={
              item.jv_status === "draft" ? undefined : t("deleteDraftOnly")
            }
          >
            <ListCardStatusRow
              status={item.jv_status}
              label={jvStatusLabel(item.jv_status)}
            />
            <ListCardRow label={t("jvDate")}>
              <span className="tabular-nums">
                {formatDate(item.jv_date, dateFormat)}
              </span>
            </ListCardRow>
            <ListCardRow label={t("source")}>
              {jvSourceLabel(item.source_type)}
            </ListCardRow>
            {item.description && (
              <ListCardRow label={tfl("description")}>
                {item.description}
              </ListCardRow>
            )}
            {!Number.isNaN(debit) && (
              <ListCardRow label={t("debit")}>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(debit)}
                </span>
              </ListCardRow>
            )}
          </ListCard>
        );
      })}
    </div>
  );
}
