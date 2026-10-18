import { useTranslations } from "use-intl";
import {
  CUISINE_REGION_DOT,
  CUISINE_REGION_LABEL_KEY,
} from "@/constant/cuisine";
import { cn } from "@/lib/utils";

interface CuisineRegionLabelProps {
  readonly region: string;
  readonly className?: string;
}

/**
 * ชื่อ region พร้อมจุดสีนำหน้า — ใช้ทั้งตาราง การ์ด และตัวเลือกในฟอร์ม
 * ให้ region เดียวกันเป็นสีเดียวกันทุกมุมมอง · ราก `data-slot` ห้ามถอด (ดู
 * `DataGridTableCell` — ลูกที่ไม่มี data-slot ถูก line-clamp ทับ display)
 *
 * region ที่ไม่รู้จัก (ค่าใหม่จาก backend) แสดงค่าดิบกับจุดสีกลาง
 */
export function CuisineRegionLabel({
  region,
  className,
}: CuisineRegionLabelProps) {
  const t = useTranslations("operationPlan.cuisine");
  const labelKey = CUISINE_REGION_LABEL_KEY[region];

  return (
    // data-slot กันเซลล์ของ DataGrid แปลงเป็น -webkit-box (line-clamp) จนจุดสีหาย
    <span
      data-slot="cuisine-region-label"
      className={cn("inline-flex items-center gap-1.5", className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-full",
          CUISINE_REGION_DOT[region] ?? "bg-muted-foreground/50",
        )}
      />
      {labelKey ? t(labelKey) : region}
    </span>
  );
}
