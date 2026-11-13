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
import { COL, META_COL, NAME_CELL, NodeColumns } from "./tree-columns";

interface TreeNodeProps {
  readonly node: CategoryNode;
  /** ใช้เทียบค่าในคอลัมน์ว่าสืบทอดหรือตั้งเอง — ชั้นบนสุดไม่มี */
  readonly parent?: CategoryNode;
  readonly level?: number;
  readonly expanded: Record<string, boolean>;
  readonly toggleExpand: (id: string) => void;
  readonly onEdit: (node: CategoryNode) => void;
  readonly onAdd: (parentNode: CategoryNode) => void;
  readonly onDelete: (node: CategoryNode) => void;
  readonly search?: string;
  /** แถวที่เลือกอยู่ (ไฮไลต์) — คลิกส่วนไหนของแถวก็เลือก รวมถึงปุ่มท้ายชื่อ */
  readonly selectedId?: string | null;
  readonly onSelect?: (id: string) => void;
}

export function TreeNode({
  node,
  parent,
  level = 0,
  expanded,
  toggleExpand,
  onEdit,
  onAdd,
  onDelete,
  search,
  selectedId,
  onSelect,
}: TreeNodeProps) {
  const t = useTranslations("productManagement.category");
  const tc = useTranslations("common");
  const ts = useTranslations("status");
  const tActivity = useTranslations("activity");

  const isExpanded = expanded[node.id] ?? false;
  const hasChildren = !!node.children?.length;
  const isSelected = selectedId === node.id;

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

  // ลำดับชั้นอ่านจากน้ำหนักตัวอักษร ไม่ใช่สี: category หนักสุด → item group เบาสุด
  // รหัสกว้างคงที่ต่อระดับ ชื่อพี่น้องจึงเรียงตรงแนวเดียวกันแม้รหัสยาวไม่เท่ากัน
  const LEVEL_STYLE = {
    [NODE_TYPE.CATEGORY]: {
      row: "h-8 bg-muted/40",
      code: "min-w-6 text-foreground font-semibold",
      name: "text-sm font-semibold",
    },
    [NODE_TYPE.SUBCATEGORY]: {
      row: "h-7",
      code: "min-w-9 text-muted-foreground font-medium",
      name: "text-xs font-medium",
    },
    [NODE_TYPE.ITEM_GROUP]: {
      row: "h-7",
      code: "min-w-10 text-muted-foreground",
      name: "text-xs text-foreground/90",
    },
  }[node.type];

  const childCount = node.children?.length ?? 0;
  const childLabel =
    node.type === NODE_TYPE.CATEGORY
      ? t("nSubcategories", { count: childCount })
      : t("nItemGroups", { count: childCount });

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
          "group/node hover:bg-accent/50 focus-within:bg-accent/50 flex items-center pr-3 transition-colors",
          LEVEL_STYLE.row,
          // โทเคนเดียวกับแถวที่เลือกของ DataGrid — วางหลัง LEVEL_STYLE ให้ทับพื้นของแถว category
          isSelected &&
            "bg-selected hover:bg-selected focus-within:bg-selected",
        )}
        data-state={isSelected ? "selected" : undefined}
        // คลิกลูกทุกตัว (ลูกศร ชื่อ ปุ่ม ที่ว่าง) bubble มาที่นี่ — คีย์บอร์ดเลือกผ่านปุ่มชื่อ
        onClick={() => onSelect?.(node.id)}
      >
        {/* ช่องชื่อ — ย่อหน้าตามระดับอยู่ข้างในช่อง ความกว้างช่องจึงเท่ากันทุกระดับ */}
        <div
          className={cn(NAME_CELL, "h-full")}
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

          {/* Content - clickable for expand. ไม่ยืดเต็มแถว: ปุ่มจึงต่อท้ายชื่อ
            แทนที่จะไปอยู่สุดขอบการ์ดที่กว้างเต็มจอ */}
          <button
            type="button"
            className="flex min-w-0 items-center gap-1.5 text-left"
            onClick={() => toggleExpand(node.id)}
          >
            <span
              className={cn(
                "text-micro shrink-0 tabular-nums",
                LEVEL_STYLE.code,
              )}
            >
              {highlight(node.code)}
            </span>

            <span className={cn("truncate", LEVEL_STYLE.name)}>
              {highlight(node.name)}
            </span>

            {/* ป้ายสถานะอยู่ติดชื่อ ไม่อยู่ฝั่งคอลัมน์ — ความกว้างไม่คงที่จะดันคอลัมน์ให้เหลื่อม */}
            {!node.is_active && (
              <Badge
                variant="secondary"
                size="xs"
                className="text-micro-legal shrink-0"
              >
                {ts("inactive")}
              </Badge>
            )}
          </button>

          {/* ที่ว่างท้ายช่องชื่อยังกดพับ/กางได้เหมือนตอนปุ่มเนื้อหายืดเต็มแถว
            (คีย์บอร์ดใช้ปุ่มเนื้อหาอยู่แล้ว จึงไม่ต้องเป็นปุ่มซ้ำ) */}
          <div
            aria-hidden
            className="h-full min-w-2 flex-1"
            onClick={() => toggleExpand(node.id)}
          />
        </div>

        {/* คอลัมน์ค่าที่ cascade — กว้างคงที่ ตรงกับ TreeColumnsHeader */}
        <NodeColumns node={node} parent={parent} />

        {/* Meta: จำนวนลูก + จำนวนสินค้า ต่อจากคอลัมน์ค่า กว้างคงที่ทุกช่อง (ว่างก็จองที่)
            คอลัมน์จึงตรงแนวกับหัวตารางทุกแถว */}
        <div className="flex shrink-0 items-center">
          <span
            className={cn(
              "text-muted-foreground/70 text-micro-legal text-right tabular-nums",
              META_COL,
              COL.children,
            )}
          >
            {node.type !== NODE_TYPE.ITEM_GROUP && childLabel}
          </span>
          {/* จำนวนสินค้า — ว่างจนกว่า backend จะส่งค่า */}
          <span
            className={cn(
              "text-micro-legal text-right tabular-nums",
              META_COL,
              COL.products,
              node.product_count === 0
                ? "text-muted-foreground/50"
                : "text-muted-foreground",
            )}
          >
            {node.product_count !== undefined &&
              t("nProducts", { count: node.product_count })}
          </span>
        </div>

        {/* ที่ว่างท้ายแถว — การ์ดกว้างพอจึงแสดงคำอธิบาย (ข้อความยาว = ช่องเดียวที่ยืด)
            แคบกว่านั้นคำอธิบายอ่านได้ในหน้าต่างแก้ไข */}
        <div className="flex h-full min-w-0 flex-1 items-center">
          {node.description && (
            <span
              className="text-muted-foreground/60 hidden truncate pl-6 text-xs @7xl:block"
              title={node.description}
            >
              {highlight(node.description)}
            </span>
          )}
          <div
            aria-hidden
            className="h-full flex-1"
            onClick={() => toggleExpand(node.id)}
          />
        </div>

        {/* Actions — ชิดขอบขวาของการ์ด หลังที่ว่างท้ายแถว กว้างคงที่ (4 ปุ่ม × 20px) ชิดขวา
              item group มี 3 ปุ่มจึงตรงแนวกับแถวอื่น · จองที่ไว้ตอนซ่อน (invisible) แถวจึงไม่ขยับ
              โผล่ตอน hover/โฟกัสคีย์บอร์ด/แถวที่เลือก และขึ้นตลอดบนจอสัมผัส */}
        <div
          className={cn(
            "invisible ml-1 flex shrink-0 items-center justify-end group-focus-within/node:visible group-hover/node:visible group-data-[state=selected]/node:visible pointer-coarse:visible",
            COL.actions,
          )}
        >
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
              parent={node}
              level={level + 1}
              expanded={expanded}
              toggleExpand={toggleExpand}
              onEdit={onEdit}
              onAdd={onAdd}
              onDelete={onDelete}
              search={search}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
