import type { PurchaseOrder } from "@/types/purchase-order";
import EmptyComponent from "@/components/empty-component";
import { ListCardSkeleton } from "@/components/share/list-card";
import PoCard from "./po-card";

interface PoCardListProps {
  readonly items: PurchaseOrder[];
  readonly isLoading?: boolean;
  readonly onEdit: (item: PurchaseOrder) => void;
  readonly onDelete: (item: PurchaseOrder) => void;
  readonly compact?: boolean;
}

export default function PoCardList({
  items,
  isLoading,
  onEdit,
  onDelete,
  compact = false,
}: PoCardListProps) {
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
      {items.map((item) => (
        <PoCard
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
