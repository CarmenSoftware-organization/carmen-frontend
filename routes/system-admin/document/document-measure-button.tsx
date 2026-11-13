import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMeasureStorage } from "@/hooks/use-storage-usage";
import { ApiError } from "@/lib/api-error";

/**
 * ปุ่มสั่งวัดพื้นที่เก็บข้อมูลของ BU ใหม่ — ปิดหลัง 429 (วัดไปแล้วภายใน 10 นาที) พร้อม
 * tooltip บอกเหตุผล ไม่เช็คสิทธิ์เอง: ผู้เรียกต้องแสดงเฉพาะผู้มี `system_admin.view`
 */
export function DocumentMeasureButton() {
  const t = useTranslations("storageQuota");
  const measure = useMeasureStorage();
  const rateLimited =
    measure.error instanceof ApiError && measure.error.statusCode === 429;

  const button = (
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      disabled={measure.isPending || rateLimited}
      onClick={() =>
        measure.mutate(undefined, {
          onError: (error) => {
            if (!(error instanceof ApiError && error.statusCode === 429)) {
              toast.error(t("measureFailed"));
            }
          },
        })
      }
    >
      <RefreshCw
        className={measure.isPending ? "animate-spin" : undefined}
        aria-hidden
      />
      {t("measureNow")}
    </Button>
  );

  if (!rateLimited) return <span>{button}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* ปุ่ม disabled ไม่ยิง pointer event — span รับ hover/focus แทนให้ tooltip ขึ้น */}
        <span tabIndex={0}>{button}</span>
      </TooltipTrigger>
      <TooltipContent>{t("measureTooSoon")}</TooltipContent>
    </Tooltip>
  );
}
