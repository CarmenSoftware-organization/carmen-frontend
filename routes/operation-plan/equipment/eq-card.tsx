import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import type { Equipment } from "@/types/equipment";
import { EqThumbnail } from "./eq-thumbnail";
import { EqMaintenanceBadge } from "./eq-maintenance-badge";
import { EqAvailability } from "./eq-availability";

interface EqCardProps {
  readonly item: Equipment;
  readonly categoryName?: string;
  readonly onEdit: (item: Equipment) => void;
  readonly onDelete: (item: Equipment) => void;
}

export default function EqCard({
  item,
  categoryName,
  onEdit,
  onDelete,
}: EqCardProps) {
  const tfl = useTranslations("field");
  const t = useTranslations("operationPlan.equipment");
  const brandModel = [item.brand, item.model].filter(Boolean).join(" · ");

  return (
    <ListCard
      title={item.name || "..."}
      onOpen={() => onEdit(item)}
      onDelete={() => onDelete(item)}
    >
      {/* รูปมาก่อนข้อความ — ในครัวคนจำเครื่องจากหน้าตา ไม่ใช่รหัส · สูงคงที่
          (ไม่ใช่ aspect ratio) การ์ดกว้างแค่ไหนแถบรูปก็ไม่ข่มข้อมูล และทุกใบ
          มีแถบเท่ากันแม้ไม่มีรูป แถวข้อมูลข้างล่างจึงตรงกันทั้งกริด */}
      <EqThumbnail
        src={item.image_url}
        alt={item.name}
        className="mb-1.5 h-24 w-full"
      />
      <ListCardActiveRow active={item.is_active} />
      <ListCardRow label={t("maintenance")}>
        <EqMaintenanceBadge nextDate={item.next_maintenance_date} size="xs" />
      </ListCardRow>
      <ListCardRow label={t("availabilityCol")}>
        <EqAvailability available={item.available_qty} total={item.total_qty} />
      </ListCardRow>
      {item.code && <ListCardRow label={tfl("code")}>{item.code}</ListCardRow>}
      {categoryName && (
        <ListCardRow label={tfl("category")}>{categoryName}</ListCardRow>
      )}
      {item.station && (
        <ListCardRow label={tfl("station")}>{item.station}</ListCardRow>
      )}
      {brandModel && (
        <ListCardRow label={tfl("brand")}>{brandModel}</ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
