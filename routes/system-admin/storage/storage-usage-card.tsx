import { Link } from "react-router";
import { toast } from "sonner";
import { HardDrive, RefreshCw } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
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
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 text-sm">
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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <HardDrive className="size-5" aria-hidden />
            {t("pageTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("pageDesc")}</p>
        </div>
        {canManage &&
          (rateLimited ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>{measureButton}</span>
              </TooltipTrigger>
              <TooltipContent>{t("measureTooSoon")}</TooltipContent>
            </Tooltip>
          ) : (
            measureButton
          ))}
      </div>

      <Card>
        <CardContent className="space-y-6">
          {isLoading && <Skeleton className="h-24 w-full" />}
          {!isLoading && !data && (
            <p className="text-muted-foreground text-sm">{t("loadFailed")}</p>
          )}
          {data?.kinds.map((k) => (
            <UsageBar key={k.kind} usage={k} />
          ))}
          {data?.kinds.length === 0 && (
            <p className="text-muted-foreground text-sm">{t("notMeasured")}</p>
          )}
        </CardContent>
      </Card>

      {canManage && data && (
        <Card>
          <CardHeader>
            <CardTitle>{t("breakdownTitle")}</CardTitle>
            <CardDescription>
              {t("breakdownDesc")}{" "}
              <Link
                to="/system-admin/document"
                className="text-primary underline"
              >
                {t("openDocuments")}
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.by_reference_type.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t("breakdownEmpty")}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="py-2 font-medium">{t("colType")}</th>
                    <th className="py-2 text-right font-medium">
                      {t("colCount")}
                    </th>
                    <th className="py-2 text-right font-medium">
                      {t("colSize")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.by_reference_type]
                    .sort((a, b) => b.size - a.size)
                    .map((row) => (
                      <tr
                        key={row.reference_type ?? "__other"}
                        className="border-b last:border-0"
                      >
                        <td className="py-2">
                          {documentReferenceLabel(
                            row.reference_type,
                            tm,
                            t("directUpload"),
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {row.count}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatFileSize(row.size)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
