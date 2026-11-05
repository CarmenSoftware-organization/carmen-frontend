import { Link } from "react-router";
import { useTranslations } from "use-intl";
import type { ApDocStatus } from "@/types/accounts-payable";

/**
 * แถบบนหน้า detail ของเอกสาร AP ที่ลงบัญชีแล้ว — ลิงก์ JV ตอน post ยังต้องโชว์หลัง void
 * (backend เก็บ gl_jv_id เดิมไว้) พร้อม JV กลับรายการ (ถ้า backend ส่งมา) และเหตุผลที่ void
 */
export function ApPostingBanner({
  status,
  jvId,
  jvNo,
  reversalJvId,
  voidReason,
}: {
  readonly status: ApDocStatus;
  readonly jvId: string | null;
  readonly jvNo: string | null;
  readonly reversalJvId?: string | null;
  readonly voidReason: string | null;
}) {
  // คีย์ journal/openJournal/voidReason/reversalJournal มีเหมือนกันทั้ง invoice และ payment
  const td = useTranslations("accounting.accountsPayable.invoice.detail");
  const isVoid = status === "void";
  if (status !== "posted" && !isVoid) return null;
  const showReason = isVoid && !!voidReason;
  if (!jvId && !reversalJvId && !showReason) return null;

  return (
    <div className="flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm">
      {(jvId || reversalJvId) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {jvId && (
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground">{td("journal")}</span>
              <Link
                className="font-medium underline"
                to={`/accounting/journal-voucher/${jvId}`}
              >
                {jvNo ?? td("openJournal")}
              </Link>
            </span>
          )}
          {isVoid && reversalJvId && (
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground">
                {td("reversalJournal")}
              </span>
              <Link
                className="font-medium underline"
                to={`/accounting/journal-voucher/${reversalJvId}`}
              >
                {td("openJournal")}
              </Link>
            </span>
          )}
        </div>
      )}
      {showReason && (
        <div>
          <span className="text-muted-foreground">{td("voidReason")}: </span>
          {voidReason}
        </div>
      )}
    </div>
  );
}
