import { ChevronRight } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFileSize } from "@/lib/format-file-size";
import { documentReferenceLabel } from "@/routes/system-admin/shared/document-reference-labels";
import type { DocumentSummary } from "@/types/document";
import type { BuStorageUsage, StorageKindUsage } from "@/types/storage-usage";

interface DocumentStorageBarProps {
  readonly usage: BuStorageUsage | undefined;
  readonly isUsageLoading: boolean;
  readonly summary: DocumentSummary | undefined;
  readonly isSummaryLoading: boolean;
  readonly onViewAll: () => void;
}

function QuotaBar({ usage }: { readonly usage: StorageKindUsage }) {
  const t = useTranslations("storageQuota");
  const pct =
    usage.quota_bytes > 0 ? (usage.used_bytes / usage.quota_bytes) * 100 : 0;
  const variant =
    usage.step === 0 || usage.blocking
      ? "destructive"
      : usage.step === null
        ? "primary"
        : "warning";

  return (
    <div className="min-w-0 space-y-1">
      {/* ชื่อกับยอดใช้อยู่ติดกันชิดซ้าย — justify-between บนจอกว้างทำให้ห่างกันทั้งความกว้างช่อง */}
      <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-medium capitalize">
          {t(`kind.${usage.kind}`)}
        </span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {t("usedOfQuota", {
            used: formatFileSize(usage.used_bytes),
            quota: formatFileSize(usage.quota_bytes),
            pct: Math.round(pct),
          })}
        </span>
      </div>
      <Progress
        value={Math.min(100, pct)}
        variant={variant}
        aria-label={t(`kind.${usage.kind}`)}
      />
    </div>
  );
}

/**
 * กล่องพื้นที่เก็บข้อมูลเหนือช่องค้นหาในหน้า Document — รวมของสองแหล่งไว้ที่เดียว:
 *
 * - แถวโควตา: ผลวัดเป็นรอบของ BU (`useStorageUsage`) เทียบโควตา ทั้งไฟล์แนบและ database
 * - แถวแจกแจง: ยอดสดของไฟล์แนบแยกตามชนิดเอกสาร (`useDocumentSummary`)
 *
 * สองยอดนี้ไม่ตรงกันได้หลังอัปโหลด/ลบไฟล์ จนกว่าจะวัดรอบใหม่ — แสดงตามจริงทั้งคู่
 * โดยมี "วัดล่าสุด" กำกับฝั่งโควตา (ผู้ใช้เลือกแบบนี้เอง ไม่สั่งวัดอัตโนมัติ)
 *
 * แต่ละแถวซ่อนตัวเองได้อิสระ: โหลดไม่สำเร็จ (รวม 401 จาก app allowlist ที่ยังไม่เติมตอน
 * deploy) หรือไม่มีข้อมูล = แถวนั้นหายไปเงียบ ๆ ไม่มีทั้งคู่ = คืน null — กล่องนี้เป็น
 * ข้อมูลเสริม หน้าต้องใช้งานได้ครบโดยไม่ขึ้น error state
 */
export default function DocumentStorageBar({
  usage,
  isUsageLoading,
  summary,
  isSummaryLoading,
  onViewAll,
}: DocumentStorageBarProps) {
  const t = useTranslations("systemAdmin.document.summary");
  const tq = useTranslations("storageQuota");
  const tm = useTranslations("modules");

  // ไฟล์แนบขึ้นก่อน — หน้านี้คือที่จัดการไฟล์ database เป็นข้อมูลประกอบ
  const kinds = [...(usage?.kinds ?? [])].sort(
    (a, b) => Number(b.kind === "attachment") - Number(a.kind === "attachment"),
  );
  const hasQuota = kinds.length > 0;
  const hasSummary = !!summary && summary.total_count > 0;

  if (!hasQuota && !hasSummary) {
    // สูงเท่ากล่องสองแถว — ตารางข้างล่างเผื่อพื้นที่ไว้เท่านี้ตั้งแต่ตอนโหลด จึงไม่กระตุก
    return isUsageLoading || isSummaryLoading ? (
      <Skeleton className="h-[4.875rem] w-full rounded-md" />
    ) : null;
  }

  const measuredAt = (kinds.find((k) => k.kind === "attachment") ?? kinds[0])
    ?.measured_at;
  const directUpload = t("directUpload");
  const top = hasSummary
    ? summary.by_reference_type
        .slice(0, 3)
        .map(
          (row) =>
            `${documentReferenceLabel(row.reference_type, tm, directUpload)} ${formatFileSize(row.size)}`,
        )
        .join(" · ")
    : "";

  return (
    // เรียงแนวนอนเมื่อ "กล่องเอง" กว้างพอ (@lg ของ container) ไม่ใช่เมื่อจอกว้างพอ
    <div className="@container">
      <div className="bg-muted/40 flex flex-col gap-2 rounded-md border px-3 py-2">
        {hasQuota && (
          // จำนวนชนิดมาจากข้อมูล (ปกติ 2) — auto-fit ไม่เหลือคอลัมน์ว่างแบบกริดจำนวนคอลัมน์ตายตัว
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-x-8 gap-y-2">
            {kinds.map((k) => (
              <QuotaBar key={k.kind} usage={k} />
            ))}
          </div>
        )}
        <div className="flex flex-col gap-1 @lg:flex-row @lg:items-center @lg:gap-4">
          {measuredAt && (
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {tq("measuredAt", {
                date: new Date(measuredAt).toLocaleString(),
              })}
            </span>
          )}
          {hasSummary && (
            <>
              <div className="flex shrink-0 items-baseline gap-2">
                <span className="text-sm font-semibold tabular-nums">
                  {formatFileSize(summary.total_size)}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {t("fileCount", { count: summary.total_count })}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-muted-foreground truncate text-xs">
                  {top}
                </span>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
