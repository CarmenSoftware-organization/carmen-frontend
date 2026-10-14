import { useState } from "react";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { Ban, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { McpToken, McpTokenStatus } from "@/types/mcp-token";
import { McpTokenCreateDialog } from "./mcp-token-create-dialog";
import { getMcpTokenStatus, useMcpTokens, useRevokeMcpToken } from "./use-mcp-tokens";

const STATUS_VARIANT: Record<McpTokenStatus, "success-light" | "warning-light" | "destructive-light"> = {
  active: "success-light",
  expired: "warning-light",
  revoked: "destructive-light",
};

/** section "MCP tokens" ของหน้า profile/setting — markup ตาม section ลายเซ็นในหน้าเดียวกัน */
export function McpTokensSection() {
  const t = useTranslations("profile.mcpTokens");
  const { dateTimeFormat } = useProfile();
  const tokens = useMcpTokens();
  const revoke = useRevokeMcpToken();
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<McpToken | null>(null);

  const rows = tokens.data ?? [];
  const statusLabel: Record<McpTokenStatus, string> = {
    active: t("statusActive"),
    expired: t("statusExpired"),
    revoked: t("statusRevoked"),
  };

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

  const fmt = (iso: string | null) => (iso ? formatDate(iso, dateTimeFormat) : t("never"));

  return (
    <div className="grid grid-cols-1 items-start gap-6 border-t pt-8 md:grid-cols-[220px_1fr] lg:gap-8">
      <div className="pt-2">
        <h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">{t("title")}</h2>
        <p className="text-muted-foreground mt-2 text-xs">{t("description")}</p>
      </div>
      <section className="bg-card overflow-hidden rounded-xl border shadow-sm">
        <div className="bg-muted/10 flex items-center justify-end border-b px-4 py-3">
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" aria-hidden="true" />
            {t("create")}
          </Button>
        </div>
        {rows.length === 0 ? (
          <div className="text-muted-foreground px-4 py-8 text-center text-sm">
            <p className="font-medium">{t("empty")}</p>
            <p className="mt-1 text-xs">{t("emptyHint")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-2 text-left">{t("name")}</th>
                  <th className="p-2 text-left">{t("tokenPrefix")}</th>
                  <th className="p-2 text-left">{t("createdAt")}</th>
                  <th className="p-2 text-left">{t("expiresAt")}</th>
                  <th className="p-2 text-left">{t("lastUsedAt")}</th>
                  <th className="p-2 text-left">{t("status")}</th>
                  <th className="p-2 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => {
                  const status = getMcpTokenStatus(row);
                  const muted = status !== "active";
                  return (
                    <tr key={row.id} className={muted ? "text-muted-foreground" : undefined}>
                      <td className="p-2 font-medium">{row.name}</td>
                      <td className="p-2 font-mono">{row.token_prefix}…</td>
                      <td className="p-2">{fmt(row.created_at)}</td>
                      <td className="p-2">{fmt(row.expires_at)}</td>
                      <td className="p-2">{fmt(row.last_used_at)}</td>
                      <td className="p-2">
                        <Badge variant={STATUS_VARIANT[status]} size="xs">{statusLabel[status]}</Badge>
                      </td>
                      <td className="p-2 text-right">
                        {status === "active" && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => setRevokeTarget(row)}>
                            <Ban className="size-3.5" aria-hidden="true" />
                            {t("revoke")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
