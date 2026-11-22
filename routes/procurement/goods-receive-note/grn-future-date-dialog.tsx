import { useTranslations } from "use-intl";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";

interface GrnFutureDateDialogProps {
  readonly open: boolean;
  /** วันที่รับสินค้าบนใบ (ISO) */
  readonly grnDate: string;
  /** ใช่ = ทำต่อ */
  readonly onConfirm: () => void;
  /** ไม่ / ปิด = ไม่ทำ */
  readonly onCancel: () => void;
}

/**
 * ถามก่อน Save และก่อน Commit เมื่อวันที่รับสินค้าบนใบยังมาไม่ถึง
 *
 * เตือนอย่างเดียว — ตอบ "ใช่" ก็ทำต่อตามปกติ หลังบ้านไม่บล็อก (ดู `isFutureReceiveDate`)
 */
export function GrnFutureDateDialog({
  open,
  grnDate,
  onConfirm,
  onCancel,
}: GrnFutureDateDialogProps) {
  const t = useTranslations("procurement.goodsReceiveNote");
  const tc = useTranslations("common");
  const { dateFormat } = useProfile();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => !next && onCancel()}
      title={t("futureReceiveDateTitle")}
      description={t("futureReceiveDateConfirm", {
        date: grnDate ? formatDate(grnDate, dateFormat) : "—",
        today: formatDate(new Date().toISOString(), dateFormat),
      })}
      confirmText={tc("yes")}
      cancelText={tc("no")}
      onConfirm={onConfirm}
    />
  );
}
