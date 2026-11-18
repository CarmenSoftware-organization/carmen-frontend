import type { CreditNote } from "@/types/credit-note";
import EmptyComponent from "@/components/empty-component";
import { ListCardSkeleton } from "@/components/share/list-card";
import CnCard from "./cn-card";
import { rowNumber } from "@/lib/row-number";
import type { ParamsDto } from "@/types/params";

interface CnCardListProps {
  /** `params` ของหน้าเมื่อแบ่งหน้า · `undefined` = รายการสะสม (infinite) นับจาก 1 */
  readonly pageParams?: ParamsDto;
  readonly items: CreditNote[];
  readonly isLoading?: boolean;
  readonly onEdit: (item: CreditNote) => void;
  readonly onDelete: (item: CreditNote) => void;
  readonly compact?: boolean;
}

export default function CnCardList({
  pageParams,
  items,
  isLoading,
  onEdit,
  onDelete,
  compact = false,
}: CnCardListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ListCardSkeleton key={`skeleton-${i}`} rows={compact ? 3 : 5} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyComponent />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item, i) => (
        <CnCard
          rowNo={rowNumber(pageParams, i)}
          key={item.id}
          item={item}
          onEdit={onEdit}
          onDelete={onDelete}
          compact={compact}
        />
      ))}
    </div>
  );
}
