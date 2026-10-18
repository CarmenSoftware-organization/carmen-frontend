import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import type { Cuisine } from "@/types/cuisine";
import { CuisineRegionLabel } from "./cuisine-region-label";

interface CuisineCardProps {
  readonly item: Cuisine;
  readonly onEdit: (item: Cuisine) => void;
  readonly onDelete: (item: Cuisine) => void;
}

/**
 * การ์ด cuisine 1 รายการ สำหรับหน้ารายการโหมด grid/mobile
 *
 * ใช้ `ListCard` ตัวเดียวกับการ์ดโมดูลอื่น · region แสดงด้วย `CuisineRegionLabel`
 * (จุดสี + ชื่อ) ตัวเดียวกับคอลัมน์ในตาราง ให้สีตรงกันทั้งสองมุมมอง
 *
 * @param props.item - ข้อมูล cuisine
 * @param props.onEdit - callback เมื่อคลิกการ์ด
 * @param props.onDelete - callback เมื่อกดปุ่มลบ
 */
export default function CuisineCard({
  item,
  onEdit,
  onDelete,
}: CuisineCardProps) {
  const t = useTranslations("operationPlan.cuisine");
  const tfl = useTranslations("field");

  return (
    <ListCard
      title={item.name || "..."}
      onOpen={() => onEdit(item)}
      onDelete={() => onDelete(item)}
    >
      <ListCardActiveRow active={item.is_active} />
      {item.region && (
        <ListCardRow label={tfl("region")}>
          <CuisineRegionLabel region={item.region} />
        </ListCardRow>
      )}
      {item.recipe_count != null && (
        <ListCardRow label={t("recipes")}>
          <span className="tabular-nums">{item.recipe_count}</span>
        </ListCardRow>
      )}
      {item.description && (
        <ListCardRow label={tfl("description")}>{item.description}</ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
