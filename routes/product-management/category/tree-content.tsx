import { useTranslations } from "use-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { TreeNode } from "./tree-node";
import { CategoryNode } from "@/types/category";

interface Props {
  isLoading: boolean;
  filteredData: CategoryNode[];
  expanded: Record<string, boolean>;
  toggleExpand: (id: string) => void;
  onEdit: (node: CategoryNode) => void;
  onAdd: (node: CategoryNode) => void;
  onDelete: (node: CategoryNode | null) => void;
  search: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function TreeContent({
  isLoading,
  filteredData,
  expanded,
  toggleExpand,
  onEdit,
  onAdd,
  onDelete,
  search,
  selectedId,
  onSelect,
}: Props) {
  const t = useTranslations("productManagement.category");

  if (isLoading) {
    return (
      <div className="space-y-px p-1">
        {["cat", "sub-1", "item-1", "cat-2", "sub-2", "item-2"].map((id, i) => (
          <div
            key={id}
            className="flex h-7 items-center gap-2"
            style={{ paddingLeft: `${(i % 3) * 20 + 4}px` }}
          >
            <Skeleton className="h-3 w-3 rounded" />
            <Skeleton className="h-3 w-3 rounded" />
            <Skeleton className="h-4 w-10 rounded" />
            <Skeleton className="h-3 w-8 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (filteredData.length === 0) {
    return (
      <div className="text-muted-foreground flex h-32 flex-col items-center justify-center text-sm">
        {search ? t("noResults", { search }) : t("noCategories")}
      </div>
    );
  }

  return (
    <div className="py-2">
      {filteredData.map((cat) => (
        <TreeNode
          key={cat.id}
          node={cat}
          expanded={expanded}
          toggleExpand={toggleExpand}
          onEdit={onEdit}
          onAdd={onAdd}
          onDelete={(node) => onDelete(node)}
          search={search}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
