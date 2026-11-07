import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { toast } from "sonner";
import { Ban, ChevronRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { formatRelativeTime } from "@/lib/relative-time";
import type { McpToken, McpTokenStatus } from "@/types/mcp-token";
import { McpTokenCreateDialog } from "./mcp-token-create-dialog";
import { getMcpScopeMessageKey } from "./mcp-token-scopes";
import { getMcpTokenStatus, useMcpTokens, useRevokeMcpToken } from "./use-mcp-tokens";

const STATUS_VARIANT: Record<McpTokenStatus, "success-light" | "warning-light" | "destructive-light"> = {
  active: "success-light",
  expired: "warning-light",
  revoked: "destructive-light",
};

/**
 * section "MCP tokens" ของหน้า profile/setting
 *
 * แยกโทเค็นที่ใช้งานได้ออกจากที่เพิกถอน/หมดอายุ — ของที่ตายแล้วสะสมไปเรื่อย ๆ
 * (ถือ active ได้แค่ 10 ใบ แต่ revoked ไม่มีเพดาน) ถ้าปนกันในตารางเดียว
 * แถวที่ต้องดูแลจริงจะจมอยู่ใต้ประวัติ จึงยุบส่วนที่ไม่ active ไว้ใน Collapsible
 */
export function McpTokensSection() {
  const t = useTranslations("profile.mcpTokens");
  const tc = useTranslations("common");
  const tokens = useMcpTokens();
  const revoke = useRevokeMcpToken();
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<McpToken | null>(null);

  const rows = tokens.data ?? [];
  const activeRows = rows.filter((row) => getMcpTokenStatus(row) === "active");
  const inactiveRows = rows.filter((row) => getMcpTokenStatus(row) !== "active");

  const handleConfirmRevoke = () => {
    if (!revokeTarget) return;
    revoke.mutate(
      { id: revokeTarget.id, doc_version: revokeTarget.doc_version },
      {
        onSuccess: () => {
          toast.success(t("revoked"));
          setRevokeTarget(null);
        },
        // 409: toast กลางขึ้นเอง และ onSettled ของ hook โหลดรายการใหม่ — ปิด dialog ให้ผู้ใช้เห็นสถานะจริง
        onError: () => setRevokeTarget(null),
      },
    );
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 border-t pt-8 md:grid-cols-[220px_1fr] lg:gap-8">
      <div className="pt-2">
        <h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">{t("title")}</h2>
        <p className="text-muted-foreground mt-2 text-xs">{t("description")}</p>
      </div>
      <section className="bg-card overflow-hidden rounded-xl border shadow-sm">
        <div className="bg-muted/10 flex items-center justify-between gap-2 border-b px-4 py-3">
          <span className="text-muted-foreground text-xs font-semibold tabular-nums">
            {tokens.isSuccess && `${t("statusActive")} ${activeRows.length}`}
          </span>
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" aria-hidden="true" />
            {t("create")}
          </Button>
        </div>
        {tokens.isPending ? (
          <div className="text-muted-foreground px-4 py-8 text-center text-sm">{tc("loading")}</div>
        ) : tokens.isError ? (
          <ErrorState error={tokens.error} onRetry={() => tokens.refetch()} />
        ) : (
          <>
            {activeRows.length === 0 ? (
              <div className="text-muted-foreground px-4 py-8 text-center text-sm">
                <p className="font-medium">{t("empty")}</p>
                <p className="mt-1 text-xs">{t("emptyHint")}</p>
              </div>
            ) : (
              <TokenTable rows={activeRows} onRevoke={setRevokeTarget} />
            )}
            {inactiveRows.length > 0 && (
              <Collapsible className="border-t">
                <CollapsibleTrigger className="group text-muted-foreground hover:text-foreground hover:bg-muted/30 focus-visible:ring-ring/50 flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none">
                  <ChevronRight
                    className="size-3.5 transition-transform group-data-[state=open]:rotate-90"
                    aria-hidden="true"
                  />
                  {t("inactiveTokens", { count: inactiveRows.length })}
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t">
                  <TokenTable rows={inactiveRows} showStatus />
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </section>

      <McpTokenCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}
        title={t("revokeTitle")}
        description={revokeTarget ? t("revokeConfirm", { name: revokeTarget.name }) : ""}
        confirmText={t("revoke")}
        confirmIcon={<Ban className="size-3.5" aria-hidden="true" />}
        variant="destructive"
        isPending={revoke.isPending}
        onConfirm={handleConfirmRevoke}
      />
    </div>
  );
}

/**
 * ตารางโทเค็น — ชื่อกับ prefix ซ้อนกันในคอลัมน์เดียว (ชื่อซ้ำกันได้ prefix คือตัวแยก)
 * วันที่แสดงแบบ relative และใส่เวลาเต็มไว้ใน `title` เพื่อไม่ให้คอลัมน์วันที่ตัดบรรทัด
 */
function TokenTable({
  rows,
  showStatus,
  onRevoke,
}: {
  readonly rows: McpToken[];
  readonly showStatus?: boolean;
  readonly onRevoke?: (row: McpToken) => void;
}) {
  const t = useTranslations("profile.mcpTokens");
  const locale = useLocale();
  const { dateTimeFormat } = useProfile();

  const statusLabel: Record<McpTokenStatus, string> = {
    active: t("statusActive"),
    expired: t("statusExpired"),
    revoked: t("statusRevoked"),
  };
  const absolute = (iso: string | null) => (iso ? formatDate(iso, dateTimeFormat) : undefined);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-muted-foreground border-b">
          <tr>
            <th className="px-4 py-2 text-left font-medium">{t("name")}</th>
            <th className="px-2 py-2 text-left font-medium">{t("scopes")}</th>
            <th className="px-2 py-2 text-left font-medium whitespace-nowrap">{t("lastUsedAt")}</th>
            <th className="px-2 py-2 text-left font-medium whitespace-nowrap">{t("expiresAt")}</th>
            {showStatus && <th className="px-2 py-2 text-left font-medium">{t("status")}</th>}
            {onRevoke && <th className="px-4 py-2" />}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const status = getMcpTokenStatus(row);
            const isMuted = status !== "active";
            return (
              <tr key={row.id} className={isMuted ? "text-muted-foreground" : undefined}>
                <td className="px-4 py-2.5 align-top" title={absolute(row.created_at)}>
                  <div className="font-medium break-words">{row.name}</div>
                  <div className="text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                    {row.token_prefix}…
                  </div>
                </td>
                <td className="px-2 py-2.5 align-top">
                  <div className="flex min-w-[180px] flex-wrap gap-1">
                    {(row.scopes ?? []).map((scope) => (
                      <Badge
                        key={scope}
                        variant={scope.startsWith("write:") ? "warning-light" : "invert-light"}
                        size="xs"
                        title={t(`scope_${getMcpScopeMessageKey(scope)}`)}
                      >
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-2 py-2.5 align-top whitespace-nowrap" title={absolute(row.last_used_at)}>
                  {row.last_used_at ? formatRelativeTime(row.last_used_at, locale) : t("never")}
                </td>
                <td className="px-2 py-2.5 align-top whitespace-nowrap" title={absolute(row.expires_at)}>
                  {/* โทเค็นที่เพิกถอนแล้ว "หมดอายุอีก 3 เดือน" อ่านเหมือนยังใช้ได้ */}
                  {status === "revoked" ? "—" : formatRelativeTime(row.expires_at, locale)}
                </td>
                {showStatus && (
                  <td className="px-2 py-2.5 align-top">
                    <Badge variant={STATUS_VARIANT[status]} size="xs">{statusLabel[status]}</Badge>
                  </td>
                )}
                {onRevoke && (
                  <td className="px-4 py-1.5 text-right align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRevoke(row)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Ban className="size-3.5" aria-hidden="true" />
                      {t("revoke")}
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
