import { Trash2 } from "lucide-react";
import { useTranslations } from "use-intl";
import { formatDate } from "@/lib/date-utils";

interface DeletedAttachmentChipProps {
  /** ISO timestamp ที่ไฟล์ถูกลบ (`deleted_at` ของ tombstone) */
  readonly deletedAt: string;
  /** ชื่อผู้ลบ — ส่งเมื่อรู้ชื่อแล้วเท่านั้น (tombstone มีแต่ id) */
  readonly deletedBy?: string;
  readonly dateFormat?: string;
}

/**
 * placeholder ของไฟล์แนบที่ถูกลบ — ไม่คลิกได้ ไม่มีลิงก์ ไม่โหลดรูป
 * ใช้แทนไฟล์แนบเดิมทุกที่ที่แสดง attachment array
 */
export function DeletedAttachmentChip({
  deletedAt,
  deletedBy,
  dateFormat = "dd/MM/yyyy",
}: DeletedAttachmentChipProps) {
  const t = useTranslations("commentSheet");
  const date = formatDate(deletedAt, dateFormat);
  const label = deletedBy
    ? t("deletedFileBy", { date, name: deletedBy })
    : t("deletedFile", { date });

  return (
    <span
      className="bg-muted/30 text-muted-foreground text-micro-legal inline-flex items-center gap-1 rounded border border-dashed px-1.5 py-0.5"
      title={label}
    >
      <Trash2 className="size-2.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}
