import { useTranslations } from "use-intl";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { GrnFormValues } from "./grn-form-schema";

interface GrnExpiredItemsDialogProps {
  readonly open: boolean;
  /** บรรทัดที่หมดอายุแล้ว — แสดงใต้คำถามให้รู้ว่าบรรทัดไหน */
  readonly lines: GrnFormValues["items"];
  /** ใช่ = ทำต่อ */
  readonly onConfirm: () => void;
  /** ไม่ / ปิด = ไม่ทำ */
  readonly onCancel: () => void;
}

/**
 * ถามก่อนสร้างใบและก่อน commit เมื่อมีบรรทัดที่กรอกวันหมดอายุเป็นวันที่ผ่านมาแล้ว
 *
 * เตือนอย่างเดียว — ตอบ "ใช่" ก็ทำต่อตามปกติ ไม่มีการตรวจอะไรเพิ่ม
 */
export function GrnExpiredItemsDialog({
  open,
  lines,
  onConfirm,
  onCancel,
}: GrnExpiredItemsDialogProps) {
  const t = useTranslations("procurement.goodsReceiveNote");
  const tc = useTranslations("common");
  const { dateFormat } = useProfile();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => !next && onCancel()}
      title={t("expiredItemsTitle")}
      description={
        <div className="space-y-2">
          <p>{t("expiredItemsConfirm")}</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {lines.map((line, i) => (
              <li key={line.id ?? i}>
                {t("expiredItemLine", {
                  product: line.product_name || "—",
                  date: line.expired_at
                    ? formatDate(line.expired_at, dateFormat)
                    : "—",
                })}
              </li>
            ))}
          </ul>
        </div>
      }
      confirmText={tc("yes")}
      cancelText={tc("no")}
      onConfirm={onConfirm}
    />
  );
}
