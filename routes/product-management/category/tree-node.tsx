import {
  ChevronRight,
  History,
  Pencil,
  Plus,
  Trash2,
  Folder,
  FolderOpen,
  Layers,
  Box,
} from "lucide-react";
import { useTranslations } from "use-intl";
import { openActivity } from "@/components/share/activity-sheet-host";
import { cn } from "@/lib/utils";
import { NODE_TYPE, type CategoryNode } from "@/types/category";
import { Badge } from "@/components/ui/badge";

interface TreeNodeProps {
  readonly node: CategoryNode;
  readonly level?: number;
  readonly expanded: Record<string, boolean>;
  readonly toggleExpand: (id: string) => void;
  readonly onEdit: (node: CategoryNode) => void;
  readonly onAdd: (parentNode: CategoryNode) => void;
  readonly onDelete: (node: CategoryNode) => void;
  readonly search?: string;
}

export function TreeNode({
  node,
  level = 0,
  expanded,
  toggleExpand,
  onEdit,
  onAdd,
  onDelete,
  search,
}: TreeNodeProps) {
  const t = useTranslations("productManagement.category");
  const tc = useTranslations("common");
  const ts = useTranslations("status");
  const tActivity = useTranslations("activity");

  const isExpanded = expanded[node.id] ?? false;
  const hasChildren = !!node.children?.length;

  const highlight = (text: string): React.ReactNode => {
    if (!search || !text) return text;
    const escaped = search.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(regex);
    if (parts.length === 1) return text;
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-highlight rounded-sm px-px">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  };

  const iconCls = "h-3 w-3 text-muted-foreground/60 shrink-0";

  const getNodeIcon = () => {
    if (node.type === NODE_TYPE.ITEM_GROUP) return <Box className={iconCls} />;
    if (node.type === NODE_TYPE.SUBCATEGORY)
      return <Layers className={iconCls} />;
    if (isExpanded) return <FolderOpen className={iconCls} />;
    return <Folder className={iconCls} />;
  };

  return (
    <div className="select-none">
      {/* Tree line connector */}
      <div
        className={cn(
          "group/node hover:bg-accent/50 hover:border-border/30 flex h-7 items-center border-b border-transparent transition-colors",
        )}
        style={{ paddingLeft: `${level * 20 + 4}px` }}
      >
        {/* Expand toggle */}
        <button
          type="button"
          className="flex h-4 w-4 shrink-0 items-center justify-center"
          onClick={() => hasChildren && toggleExpand(node.id)}
        >
          {hasChildren ? (
            <ChevronRight
              className={cn(
                "text-muted-foreground h-3 w-3 cursor-pointer transition-transform duration-150",
                isExpanded && "rotate-90",
              )}
            />
          ) : (
            <span className="w-3" />
          )}
        </button>

        {/* Node icon */}
        <div className="mr-1.5 ml-1 flex items-center gap-1.5">
          {getNodeIcon()}
        </div>

        {/* Content - clickable for expand */}
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          onClick={() => toggleExpand(node.id)}
        >
          <Badge
            variant={"secondary"}
            className="text-micro-legal h-5 min-w-7 shrink-0 justify-center tabular-nums"
          >
            {highlight(node.code)}
          </Badge>

          <span className="truncate text-xs font-semibold">
            {highlight(node.name)}
          </span>

          {node.description && (
            <span className="text-muted-foreground/60 hidden truncate text-xs xl:inline">
              — {highlight(node.description)}
            </span>
          )}
        </button>

        {/* Status indicator */}
        {!node.is_active && (
          <Badge
            variant="secondary"
            size="xs"
            className="text-micro-legal mr-1 shrink-0"
          >
            {ts("inactive")}
          </Badge>
        )}

        {/* Actions - visible on hover */}
        <div className="ml-auto hidden items-center pr-2 group-hover/node:flex">
          {node.type !== NODE_TYPE.ITEM_GROUP && (
            <button
              type="button"
              className="hover:bg-primary/10 hover:text-primary rounded p-1 transition-colors"
              onClick={() => onAdd(node)}
              title={t("addChild")}
              aria-label={t("addChild")}
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            className="hover:bg-primary/10 hover:text-primary rounded p-1 transition-colors"
            onClick={() => onEdit(node)}
            title={tc("edit")}
            aria-label={tc("edit")}
          >
            <Pencil className="h-3 w-3" />
          </button>
          {/* ทั้งสามระดับของ tree (category · sub-category · item-group) เป็น entity
              คนละตัวที่ backend บันทึกกิจกรรมให้ทั้งหมด — node.id จึงใช้ได้ตรง ๆ */}
          <button
            type="button"
            className="hover:bg-primary/10 hover:text-primary rounded p-1 transition-colors"
            onClick={() => openActivity(node.id, node.name)}
            title={tActivity("title")}
            aria-label={tActivity("title")}
          >
            <History className="h-3 w-3" />
          </button>
          <button
            type="button"
            className="hover:bg-destructive/10 hover:text-destructive rounded p-1 transition-colors"
            onClick={() => onDelete(node)}
            title={tc("delete")}
            aria-label={tc("delete")}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="relative">
          {/* Vertical tree line */}
          <div
            className="border-border/40 absolute top-0 bottom-0 border-l"
            style={{ left: `${level * 20 + 12}px` }}
          />
          {node.children?.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expanded={expanded}
              toggleExpand={toggleExpand}
              onEdit={onEdit}
              onAdd={onAdd}
              onDelete={onDelete}
              search={search}
            />
          ))}
        </div>
      )}
    </div>
  );
}
