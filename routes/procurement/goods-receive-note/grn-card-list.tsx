import type { GoodsReceiveNote } from "@/types/goods-receive-note";
import EmptyComponent from "@/components/empty-component";
import { ListCardSkeleton } from "@/components/share/list-card";
import GrnCard from "./grn-card";

interface GrnCardListProps {
  readonly items: GoodsReceiveNote[];
  readonly isLoading?: boolean;
  readonly onEdit: (item: GoodsReceiveNote) => void;
  readonly onDelete: (item: GoodsReceiveNote) => void;
  readonly compact?: boolean;
}

export default function GrnCardList({
  items,
  isLoading,
  onEdit,
  onDelete,
  compact = false,
}: GrnCardListProps) {
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
        <GrnCard
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
