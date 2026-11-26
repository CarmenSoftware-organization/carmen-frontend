import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";

interface CoamSelectAllBannerProps {
  /** จำนวนแถวที่โหลดมาแล้ว (ที่ติ๊กอยู่) */
  loaded: number;
  /** จำนวนแถวทั้งหมดที่ตรงตัวกรอง (paginate.total) */
  total: number;
  allMatching: boolean;
  onSelectAll: () => void;
  onClear: () => void;
}

/**
 * แถบเหนือตาราง — ติ๊กหัวตารางเลือกได้แค่แถวที่โหลดแล้ว (lazy load ทีละ 50)
 * จึงต้องให้ผู้ใช้ขยายไปเป็น "ทุกแถวที่ตรงตัวกรอง" เองอย่างชัดเจน
 */
export function CoamSelectAllBanner({
  loaded,
  total,
  allMatching,
  onSelectAll,
  onClear,
}: CoamSelectAllBannerProps) {
  const t = useTranslations("config.chartOfAccountMapping");
  return (
    <div
      role="status"
      className="bg-muted text-foreground flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-md px-3 py-1.5"
    >
      <span className="tabular-nums">
        {allMatching
          ? t("allMatchingSelected", { count: total })
          : t("selectedLoaded", { count: loaded })}
      </span>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto p-0 tabular-nums"
        onClick={allMatching ? onClear : onSelectAll}
      >
        {allMatching
          ? t("clearSelection")
          : t("selectAllMatching", { count: total })}
      </Button>
    </div>
  );
}
