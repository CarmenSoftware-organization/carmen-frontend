import type { PurchaseRequest } from "@/types/purchase-request";
import EmptyComponent from "@/components/empty-component";
import { ListCardSkeleton } from "@/components/share/list-card";
import PrCard from "./pr-card";

interface PrCardListProps {
  readonly items: PurchaseRequest[];
  readonly isLoading?: boolean;
  readonly onEdit: (item: PurchaseRequest) => void;
  readonly onApprove?: (item: PurchaseRequest) => void;
  readonly onReject?: (item: PurchaseRequest) => void;
  readonly onDelete?: (item: PurchaseRequest) => void;
  readonly isMyPending?: boolean;
  readonly compact?: boolean;
}

export default function PrCardList({
  items,
  isLoading,
  onEdit,
  onApprove,
  onReject,
  onDelete,
  isMyPending = false,
  compact = false,
}: PrCardListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ListCardSkeleton
            key={`skeleton-${i}`}
            rows={compact ? 3 : 5}
            hasFooter={!compact}
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyComponent />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <PrCard
          key={item.id}
          item={item}
          onEdit={onEdit}
          onApprove={onApprove}
          onReject={onReject}
          onDelete={onDelete}
          isMyPending={isMyPending}
          compact={compact}
        />
      ))}
    </div>
  );
}
