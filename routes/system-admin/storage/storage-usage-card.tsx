import { Link } from "react-router";
import { toast } from "sonner";
import { HardDrive, RefreshCw } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import {
  CompactSection,
  CompactSectionSkeleton,
  FieldGrid,
} from "@/components/share/compact-section";
import { FormPageShell } from "@/components/share/form-page-shell";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PERMISSIONS } from "@/constant/permissions";
import { useCan } from "@/hooks/use-can";
import { useMeasureStorage, useStorageUsage } from "@/hooks/use-storage-usage";
import { ApiError } from "@/lib/api-error";
import { formatFileSize } from "@/lib/format-file-size";
import { documentReferenceLabel } from "@/routes/system-admin/shared/document-reference-labels";
import type { StorageKindUsage } from "@/types/storage-usage";

function UsageBar({ usage }: { readonly usage: StorageKindUsage }) {
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
    <div className="min-w-0 space-y-2">
      {/* ชื่อกับยอดใช้อยู่ติดกันชิดซ้าย — justify-between บนจอกว้างทำให้ห่างกันทั้งความกว้างช่อง */}
      <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-medium">{t(`kind.${usage.kind}`)}</span>
        <span className="text-muted-foreground tabular-nums">
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
      <p className="text-muted-foreground text-xs tabular-nums">
        {t("measuredAt", {
          date: new Date(usage.measured_at).toLocaleString(),
        })}
      </p>
    </div>
  );
}

/**
 * หน้า `/system-admin/storage` — พื้นที่เก็บข้อมูลของ BU: แถบใช้งาน database / ไฟล์แนบ,
 * ปุ่มวัดใหม่ (ปิดหลัง 429 = วัดไปแล้วภายใน 10 นาที) และตารางไฟล์แนบแยกตามชนิดอ้างอิง
 * (ตารางมีเฉพาะผู้มี `system_admin.view` — backend ไม่ส่ง breakdown ให้คนอื่น)
 */
export function StorageUsageCard() {
  const t = useTranslations("storageQuota");
  const tm = useTranslations("modules");
  const { can } = useCan();
  const { data, isLoading } = useStorageUsage();
  const measure = useMeasureStorage();
  const canManage = can(PERMISSIONS.system_admin.view);
  const rateLimited =
    measure.error instanceof ApiError && measure.error.statusCode === 429;

  const measureButton = (
    <Button
      variant="outline"
      size="sm"
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

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <HardDrive className="size-5 shrink-0" aria-hidden />
          {t("pageTitle")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("pageDesc")}</p>
      </div>
      {canManage &&
        (rateLimited ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="shrink-0">
                {measureButton}
              </span>
            </TooltipTrigger>
            <TooltipContent>{t("measureTooSoon")}</TooltipContent>
          </Tooltip>
        ) : (
          <span className="shrink-0">{measureButton}</span>
        ))}
    </div>
  );

  if (isLoading) {
    // โครงเดียวกับหน้าจริง: หมวดการใช้งาน + (ผู้มีสิทธิ์) หมวดแยกตามชนิด
    return (
      <FormPageShell width="wide" header={header}>
        <CompactSectionSkeleton first className="h-24" />
        {canManage && <CompactSectionSkeleton className="h-32" />}
      </FormPageShell>
    );
  }

  return (
    <FormPageShell width="wide" header={header}>
      <CompactSection first title={t("usageTitle")}>
        {!data && (
          <p className="text-muted-foreground text-sm">{t("loadFailed")}</p>
        )}
        {data?.kinds.length === 0 && (
          <p className="text-muted-foreground text-sm">{t("notMeasured")}</p>
        )}
        {!!data?.kinds.length && (
          // จำนวนชนิดมาจากข้อมูล (ปกติ 2) — auto-fit ไม่เหลือคอลัมน์ว่างแบบกริดจำนวนคอลัมน์ตายตัว
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-x-8 gap-y-4">
            {data.kinds.map((k) => (
              <UsageBar key={k.kind} usage={k} />
            ))}
          </div>
        )}
      </CompactSection>

      {canManage && data && (
        <CompactSection
          title={t("breakdownTitle")}
          count={data.by_reference_type.length || undefined}
          description={
            <>
              {t("breakdownDesc")}{" "}
              <Link
                to="/system-admin/document"
                className="text-primary underline"
              >
                {t("openDocuments")}
              </Link>
            </>
          }
        >
          {data.by_reference_type.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("breakdownEmpty")}
            </p>
          ) : (
            // เดิมเป็นตาราง "ชนิดชิดซ้าย · ขนาดชิดขวา" เต็มแถว — บนจอกว้างค่าห่างจากป้ายทั้งจอ
            // แต่ละชนิดเป็นช่องของกริด: ป้ายบน ขนาดล่าง (ค่าหลัก) จำนวนไฟล์เป็นค่ารอง
            <FieldGrid>
              {[...data.by_reference_type]
                .sort((a, b) => b.size - a.size)
                .map((row) => (
                  <div
                    key={row.reference_type ?? "__other"}
                    className="min-w-0"
                  >
                    <div className="text-muted-foreground truncate text-xs">
                      {documentReferenceLabel(
                        row.reference_type,
                        tm,
                        t("directUpload"),
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm tabular-nums">
                      <span className="font-medium">
                        {formatFileSize(row.size)}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {t("fileCount", { count: row.count })}
                      </span>
                    </div>
                  </div>
                ))}
            </FieldGrid>
          )}
        </CompactSection>
      )}
    </FormPageShell>
  );
}
