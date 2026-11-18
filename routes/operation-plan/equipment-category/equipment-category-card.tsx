import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import type { EquipmentCategory } from "@/types/equipment-category";
import { EquipmentCountLink } from "./equipment-count-link";

interface EquipmentCategoryCardProps {
  /** เลขลำดับแถว (`rowNumber()`) → `ListCard rowNo` */
  readonly rowNo?: number;
  readonly item: EquipmentCategory;
  readonly onEdit: (item: EquipmentCategory) => void;
  readonly onDelete: (item: EquipmentCategory) => void;
}

export default function EquipmentCategoryCard({
  item,
  onEdit,
  onDelete,
  rowNo,
}: EquipmentCategoryCardProps) {
  const tfl = useTranslations("field");
  const t = useTranslations("operationPlan.equipmentCategory");

  return (
    <ListCard
      rowNo={rowNo}
      title={item.name || "..."}
      onOpen={() => onEdit(item)}
      onDelete={() => onDelete(item)}
    >
      <ListCardActiveRow active={item.is_active} />
      <ListCardRow label={t("equipment")}>
        <span className="tabular-nums">
          <EquipmentCountLink
            categoryId={item.id}
            count={item.equipment_count}
          />
        </span>
      </ListCardRow>
      {item.description && (
        <ListCardRow label={tfl("description")}>{item.description}</ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
