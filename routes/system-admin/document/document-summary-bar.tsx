import { ChevronRight } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFileSize } from "@/lib/format-file-size";
import { documentReferenceLabel } from "@/routes/system-admin/shared/document-reference-labels";
import type { DocumentSummary } from "@/types/document";

interface DocumentSummaryBarProps {
  readonly summary: DocumentSummary | undefined;
  readonly isLoading: boolean;
  readonly onViewAll: () => void;
}

/**
 * แถบสรุปขนาดไฟล์แนบรวมของ BU วางเหนือช่องค้นหาในหน้า Document
 *
 * ยอดเป็นของทั้ง BU เสมอ ไม่ขยับตาม filter ของตาราง
 * เมื่อโหลดไม่สำเร็จ (รวม 401 จาก app allowlist ที่ยังไม่เติมตอน deploy) หรือ BU
 * ยังไม่มีไฟล์เลย จะคืน null ไปเงียบ ๆ — แถบนี้เป็นข้อมูลเสริม หน้าต้องใช้งานได้ครบ
 * เหมือนเดิมโดยไม่ขึ้น error state ให้ผู้ใช้ต้องจัดการ
 *
 * @param props - props ของ DocumentSummaryBar
 * @param props.summary - ยอดสรุป (undefined ระหว่างโหลดหรือเมื่อ error)
 * @param props.isLoading - กำลังโหลดอยู่หรือไม่
 * @param props.onViewAll - callback เปิด Sheet รายละเอียด
 * @returns JSX element ของแถบสรุป หรือ null
 * @example
 * <DocumentSummaryBar summary={data} isLoading={isLoading} onViewAll={open} />
 */
export default function DocumentSummaryBar({
  summary,
  isLoading,
  onViewAll,
}: DocumentSummaryBarProps) {
  const t = useTranslations("systemAdmin.document.summary");
  const tm = useTranslations("modules");

  if (isLoading) return <Skeleton className="h-9 w-full rounded-md" />;
  if (!summary || summary.total_count === 0) return null;

  const directUpload = t("directUpload");
  const top = summary.by_reference_type
    .slice(0, 3)
    .map(
      (row) =>
        `${documentReferenceLabel(row.reference_type, tm, directUpload)} ${formatFileSize(row.size)}`,
    )
    .join(" · ");

  return (
    <div className="bg-muted/40 flex flex-col gap-1 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold tabular-nums">
          {formatFileSize(summary.total_size)}
        </span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {t("fileCount", { count: summary.total_count })}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted-foreground truncate text-xs">{top}</span>
        <Button
          variant="link"
          size="sm"
          className="h-auto shrink-0 px-0"
          onClick={onViewAll}
        >
          {t("viewAll")}
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
