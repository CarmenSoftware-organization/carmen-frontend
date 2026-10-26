import { useTranslations } from "use-intl";
import { useInterfaceEntitlement } from "@/hooks/use-interface-entitlement";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import type { PosSftpPullStatus } from "@/types/pos-sale";
import { usePosSftpLatestPull } from "../shared/use-pos-sale";

/** สีข้อความของสถานะ — ใช้ token `-ink` / `text-destructive` ให้ผ่าน WCAG AA ทั้งสองธีม */
const STATUS_TONE: Record<PosSftpPullStatus, string> = {
  completed: "text-success-ink",
  running: "text-muted-foreground",
  abandoned: "text-muted-foreground",
  connect_failed: "text-destructive",
  host_key_mismatch: "text-destructive",
  failed: "text-destructive",
};

/** รหัส error ระดับรอบที่ backend เก็บไว้ → คีย์ i18n (ข้อความอื่นไม่โชว์ดิบ เผื่อหลุดรายละเอียดภายใน) */
const ERROR_KEY: Record<string, string> = {
  unreachable: "unreachable",
  dns_not_found: "dnsNotFound",
  auth_failed: "authFailed",
  host_not_allowed: "hostNotAllowed",
  host_key_mismatch: "hostKeyMismatch",
  secret_unreadable: "secretUnreadable",
  stale_run: "stale",
  sftp_session_lost: "sessionLost",
  list_failed: "listFailed",
  run_budget_exceeded: "runBudgetExceeded",
};

/**
 * สถานะรอบดึงไฟล์ Simphony ผ่าน SFTP ล่าสุด — แสดงใต้ส่วนตั้งเวลาดึงของหน้า Simphony
 *
 * ไม่มีปุ่ม (ไม่เพิ่มปุ่มหลักของหน้า) · ไม่ยิงเมื่อ license ของ Simphony ไม่ใช่ `entitled`
 * และซ่อนทั้งก้อนเมื่อ backend ตอบ 403 / 404 (ยังไม่ deploy หรือไม่มีสิทธิ์)
 *
 * @param enabled - ฟอร์มตั้งค่าโหลดเสร็จแล้ว
 * @returns React element ของสถานะ หรือ `null` เมื่อต้องซ่อน
 */
export function PosSftpLastPull({ enabled }: { enabled: boolean }) {
  const t = useTranslations("operationPlan.posSale.simphony.lastPull");
  const { dateTimeFormat } = useProfile();
  const { entitlementOf } = useInterfaceEntitlement();
  const { data, isError, error, isLoading } = usePosSftpLatestPull(
    enabled && entitlementOf("pos", "simphony") === "entitled",
  );

  if (isLoading) return null;
  if (isError) {
    const code = error?.statusCode;
    if (code === 403 || code === 404) return null;
  }
  const body = (() => {
    if (isError)
      return <p className="text-muted-foreground mt-2">{t("loadError")}</p>;
    if (!data)
      return <p className="text-muted-foreground mt-2">{t("never")}</p>;
    return null;
  })();

  return (
    <section
      aria-label={t("title")}
      className="bg-card mt-6 rounded-lg border p-4 text-sm"
    >
      <h3 className="font-medium">{t("title")}</h3>
      {body ??
        (data ? (
          <div className="mt-2 space-y-1">
            <p>
              <span className="text-muted-foreground">
                {formatDate(data.started_at, dateTimeFormat)}
              </span>
              {" · "}
              <span className={cn("font-medium", STATUS_TONE[data.status])}>
                {t(`status.${data.status}`)}
              </span>
            </p>
            <p className="text-muted-foreground">
              {t("summary", {
                imported: data.files_imported,
                rejected: data.files_rejected,
                failed: data.files_failed,
                skipped: data.files_skipped,
              })}
            </p>
            {data.status === "completed" && data.files_failed > 0 && (
              <p className="text-warning-ink">{t("someFailed")}</p>
            )}
            {data.status !== "completed" && data.error_message && (
              <p className="text-destructive">
                {t(`error.${ERROR_KEY[data.error_message] ?? "unknown"}`)}
              </p>
            )}
            {data.status === "host_key_mismatch" && (
              <div>
                {data.host_key_sha256 && (
                  <p className="text-muted-foreground font-mono break-all">
                    {t("trustedKey", { fingerprint: data.host_key_sha256 })}
                  </p>
                )}
                {data.presented_host_key_sha256 && (
                  <p className="text-muted-foreground font-mono break-all">
                    {t("offeredKey", {
                      fingerprint: data.presented_host_key_sha256,
                    })}
                  </p>
                )}
                <p className="text-muted-foreground">{t("hostKeyHint")}</p>
              </div>
            )}
            {data.status !== "host_key_mismatch" && data.host_key_sha256 && (
              <p className="text-muted-foreground font-mono text-xs break-all">
                {t("trustedKey", { fingerprint: data.host_key_sha256 })}
              </p>
            )}
          </div>
        ) : null)}
    </section>
  );
}
