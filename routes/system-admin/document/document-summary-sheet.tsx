import { useTranslations } from "use-intl";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { formatFileSize } from "@/lib/format-file-size";
import { documentReferenceLabel } from "@/routes/system-admin/shared/document-reference-labels";
import type { DocumentSummary } from "@/types/document";

interface DocumentSummarySheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly summary: DocumentSummary;
}

/**
 * Sheet แจกแจงพื้นที่จัดเก็บไฟล์แนบของ BU ทีละโมดูลต้นทาง
 *
 * เป็น presentational ล้วน ไม่ fetch เอง — หน้าที่ส่ง summary ที่โหลดแล้วเข้ามา
 * แถบสัดส่วนใช้สีเดียวกันทุกแถวโดยตั้งใจ (DESIGN.md ห้ามใช้สีสื่อความหมาย)
 * ความยาวแถบคือตัวสื่อสารสัดส่วน และมีตัวเลข % กำกับไว้ไม่ให้พึ่งสายตาอย่างเดียว
 *
 * @param props - props ของ DocumentSummarySheet
 * @param props.open - เปิดอยู่หรือไม่
 * @param props.onOpenChange - callback เมื่อสถานะเปิด/ปิดเปลี่ยน
 * @param props.summary - ยอดสรุปที่โหลดมาแล้ว
 * @returns JSX element ของ sheet
 * @example
 * <DocumentSummarySheet open={open} onOpenChange={setOpen} summary={summary} />
 */
export default function DocumentSummarySheet({
  open,
  onOpenChange,
  summary,
}: DocumentSummarySheetProps) {
  const t = useTranslations("systemAdmin.document.summary");
  const tm = useTranslations("modules");
  const directUpload = t("directUpload");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="pr-12">
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          <p className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tabular-nums">
              {formatFileSize(summary.total_size)}
            </span>
            <span className="text-muted-foreground text-xs tabular-nums">
              {t("fileCount", { count: summary.total_count })}
            </span>
          </p>

          <ul className="space-y-3">
            {summary.by_reference_type.map((row) => {
              const percent =
                summary.total_size > 0
                  ? (row.size / summary.total_size) * 100
                  : 0;
              return (
                <li
                  key={row.reference_type ?? "__direct_upload__"}
                  className="space-y-1"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs">
                      {documentReferenceLabel(
                        row.reference_type,
                        tm,
                        directUpload,
                      )}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums">
                      {formatFileSize(row.size)}
                    </span>
                  </div>
                  <Progress
                    value={percent}
                    variant="primary"
                    className="h-1.5"
                  />
                  <div className="text-muted-foreground text-micro flex justify-between tabular-nums">
                    <span>{t("fileCount", { count: row.count })}</span>
                    <span>{percent.toFixed(1)}%</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
