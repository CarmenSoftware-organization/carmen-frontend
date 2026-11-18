import { useTranslations } from "use-intl";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
} from "@/components/share/list-card";
import type { Product } from "@/types/product";

interface ProductCardProps {
  /** เลขลำดับแถว (`rowNumber()`) → `ListCard rowNo` */
  readonly rowNo?: number;
  readonly item: Product;
  readonly onEdit: (item: Product) => void;
  readonly onDelete: (item: Product) => void;
}

export default function ProductCard({
  item,
  onEdit,
  onDelete,
  rowNo,
}: ProductCardProps) {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");

  const isActive = item.product_status_type === "active";
  const unitName = item.inventory_unit_name ?? item.inventory_unit?.name;
  const categoryPath = [
    item.product_category?.name,
    item.product_sub_category?.name,
    item.product_item_group?.name,
  ].filter(Boolean);

  return (
    <ListCard
      rowNo={rowNo}
      title={item.name || "..."}
      badge={
        <StatusDotBadge tone={isActive ? "success" : "neutral"} size="xs">
          {isActive ? ts("active") : ts("inactive")}
        </StatusDotBadge>
      }
      onOpen={() => onEdit(item)}
      onDelete={() => onDelete(item)}
    >
      <ListCardRow label={tfl("code")}>
        <span className="tabular-nums">{item.code}</span>
      </ListCardRow>
      {item.local_name && (
        <ListCardRow label={tfl("localName")}>{item.local_name}</ListCardRow>
      )}
      {unitName && <ListCardRow label={tfl("unit")}>{unitName}</ListCardRow>}
      {/* หมวดสามระดับรวมเป็นแถวเดียวแบบเส้นทาง — รูปเดียวกับแถบตัวตนบนหัว
          หน้ารายละเอียด (pd-form-toolbar) เดิมแยกเป็นสามแถวทำให้การ์ดสูงเกินเนื้อหา */}
      {categoryPath.length > 0 && (
        <ListCardRow label={tfl("category")}>
          {categoryPath.join(" › ")}
        </ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
