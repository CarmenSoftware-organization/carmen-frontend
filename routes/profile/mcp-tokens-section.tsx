import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { toast } from "sonner";
import { Ban, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type { McpToken, McpTokenStatus } from "@/types/mcp-token";
import { McpTokenCreateDialog } from "./mcp-token-create-dialog";
import { getMcpScopeMessageKey } from "./mcp-token-scopes";
import {
  getMcpTokenStatus,
  useDeleteInactiveMcpTokens,
  useDeleteMcpToken,
  useMcpTokens,
  useRevokeMcpToken,
} from "./use-mcp-tokens";

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
 *
 * การลบมีเฉพาะในส่วนที่ไม่ active — ใบที่ยังใช้ได้ต้องเพิกถอนก่อนเสมอ
 * ลบจึงไม่มีทางทำให้ client ที่ต่ออยู่หลุดโดยไม่ตั้งใจ (backend บังคับซ้ำด้วย 409)
 */
export function McpTokensSection() {
  const t = useTranslations("profile.mcpTokens");
  const tc = useTranslations("common");
  const tokens = useMcpTokens();
  const revoke = useRevokeMcpToken();
  const deleteOne = useDeleteMcpToken();
  const deleteInactive = useDeleteInactiveMcpTokens();
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<McpToken | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<McpToken | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

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

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteOne.mutate(
      { id: deleteTarget.id, doc_version: deleteTarget.doc_version },
      {
        onSuccess: () => {
          toast.success(t("deleted"));
          setDeleteTarget(null);
        },
        onError: () => setDeleteTarget(null),
      },
    );
  };

  const handleConfirmDeleteAll = () => {
    deleteInactive.mutate(undefined, {
      onSuccess: (data) => {
        toast.success(t("deletedMany", { count: data.deleted_count }));
        setDeleteAllOpen(false);
      },
      onError: () => setDeleteAllOpen(false),
    });
  };

  return (
    <>
      <CompactSection
        title={t("title")}
        count={tokens.isSuccess ? activeRows.length : undefined}
        action={
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" aria-hidden="true" />
            {t("create")}
          </Button>
        }
      >
        {/* คำอธิบายยาวสามประโยค — อยู่ในการ์ด ไม่ใช่บรรทัดหัวข้อ ไม่งั้นดันปุ่ม Create ตกบรรทัด */}
        <p className="text-muted-foreground mb-3 max-w-3xl text-xs">
          {t("description")}
        </p>
        {tokens.isPending ? (
          <div className="text-muted-foreground text-sm">{tc("loading")}</div>
        ) : tokens.isError ? (
          <ErrorState error={tokens.error} onRetry={() => tokens.refetch()} />
        ) : (
          <>
            {activeRows.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                <p className="font-medium">{t("empty")}</p>
                <p className="mt-1 text-xs">{t("emptyHint")}</p>
              </div>
            ) : (
              <TokenGrid rows={activeRows} onRevoke={setRevokeTarget} />
            )}
            {inactiveRows.length > 0 && (
              <Collapsible className="mt-3 border-t pt-1">
                {/* ปุ่ม Delete all อยู่ข้าง trigger ไม่ใช่ข้างใน — button ซ้อน button ไม่ได้ */}
                <div className="flex items-center gap-2">
                  <CollapsibleTrigger className="group text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex min-w-0 items-center gap-1.5 rounded-md py-2 pr-2 text-left text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none">
                    <ChevronRight
                      className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90"
                      aria-hidden="true"
                    />
                    {t("inactiveTokens", { count: inactiveRows.length })}
                  </CollapsibleTrigger>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={deleteInactive.isPending}
                    onClick={() => setDeleteAllOpen(true)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="size-3" aria-hidden="true" />
                    {t("deleteAll")}
                  </Button>
                </div>
                <CollapsibleContent className="pt-1">
                  <TokenGrid rows={inactiveRows} showStatus onDelete={setDeleteTarget} />
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </CompactSection>

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
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={t("deleteTitle")}
        description={deleteTarget ? t("deleteConfirm", { name: deleteTarget.name }) : ""}
        confirmText={t("delete")}
        confirmIcon={<Trash2 className="size-3.5" aria-hidden="true" />}
        variant="destructive"
        isPending={deleteOne.isPending}
        onConfirm={handleConfirmDelete}
      />
      <ConfirmDialog
        open={deleteAllOpen}
        onOpenChange={setDeleteAllOpen}
        title={t("deleteAllTitle")}
        description={t("deleteAllConfirm", { count: inactiveRows.length })}
        confirmText={t("deleteAll")}
        confirmIcon={<Trash2 className="size-3.5" aria-hidden="true" />}
        variant="destructive"
        isPending={deleteInactive.isPending}
        onConfirm={handleConfirmDeleteAll}
      />
    </>
  );
}

/**
 * รายการโทเค็น — หนึ่งโทเค็นหนึ่งช่องของกริด จำนวนคอลัมน์ตามความกว้างการ์ด
 *
 * เดิมเป็น `<table>`: ยืดเต็มการ์ดแล้วคอลัมน์สั้น ๆ ห่างกันเป็นพันพิกเซลบนจอกว้าง ไม่ยืดก็
 * เหลือที่ว่างสองในสามของการ์ด และตาราง active กับ revoked คอลัมน์ไม่ตรงกัน (จำนวนคอลัมน์ต่างกัน)
 * โทเค็นเป็นรายการที่มีหลายส่วน (ชื่อ scope วันที่ สถานะ ปุ่ม) จึงใช้ `FieldGrid size="item"`
 * แบบเดียวกับ provider ของหน้า Ask AI — จอกว้างขึ้นได้คอลัมน์เพิ่ม ไม่ใช่ช่องกว้างขึ้น
 *
 * ชื่อกับ prefix อยู่ด้วยกันเสมอ (ชื่อซ้ำกันได้ prefix คือตัวแยก) และวันที่เป็น relative
 * พร้อม `title` เวลาเต็ม
 */
function TokenGrid({
  rows,
  showStatus,
  onRevoke,
  onDelete,
}: {
  readonly rows: McpToken[];
  readonly showStatus?: boolean;
  /** ปุ่มเพิกถอน — ใช้กับรายการ active */
  readonly onRevoke?: (row: McpToken) => void;
  /** ปุ่มลบ — ใช้กับรายการที่เพิกถอน/หมดอายุแล้ว */
  readonly onDelete?: (row: McpToken) => void;
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

  const items = rows.map((row) => {
    const status = getMcpTokenStatus(row);
    return {
      row,
      status,
      isMuted: status !== "active",
      lastUsed: row.last_used_at ? formatRelativeTime(row.last_used_at, locale) : t("never"),
      // โทเค็นที่เพิกถอนแล้ว "หมดอายุอีก 3 เดือน" อ่านเหมือนยังใช้ได้
      expires: status === "revoked" ? "—" : formatRelativeTime(row.expires_at, locale),
    };
  });

  const renderName = (row: McpToken) => (
    <>
      <div className="font-medium break-words">{row.name}</div>
      <div className="text-muted-foreground font-mono text-micro whitespace-nowrap">{row.token_prefix}…</div>
    </>
  );
  const renderScopes = (row: McpToken) =>
    (row.scopes ?? []).map((scope) => (
      <Badge
        key={scope}
        variant={scope.startsWith("write:") ? "warning-light" : "invert-light"}
        size="xs"
        title={t(`scope_${getMcpScopeMessageKey(scope)}`)}
      >
        {scope}
      </Badge>
    ));
  const renderStatus = (status: McpTokenStatus) => (
    <Badge variant={STATUS_VARIANT[status]} size="xs">{statusLabel[status]}</Badge>
  );
  const renderAction = (row: McpToken) => {
    if (onRevoke) {
      return (
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
      );
    }
    if (onDelete) {
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDelete(row)}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          {t("delete")}
        </Button>
      );
    }
    return null;
  };

  return (
    <FieldGrid size="item">
      {items.map(({ row, status, isMuted, lastUsed, expires }) => (
        <div
          key={row.id}
          className={cn(
            "flex min-w-0 flex-col gap-2 rounded-lg border p-3 text-xs",
            isMuted && "text-muted-foreground",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0" title={absolute(row.created_at)}>
              {renderName(row)}
            </div>
            {showStatus && renderStatus(status)}
          </div>
          <div className="flex flex-wrap gap-1">{renderScopes(row)}</div>
          {/* mt-auto: ช่องในแถวเดียวกันสูงเท่ากัน (scope ตัดบรรทัดไม่เท่ากัน) — วันที่กับปุ่มชิดล่างให้ตรงกันทั้งแถว */}
          <div className="mt-auto flex items-center justify-between gap-2">
            <dl className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5">
              <div className="flex gap-1" title={absolute(row.last_used_at)}>
                <dt>{t("lastUsedAt")}</dt>
                <dd className={isMuted ? undefined : "text-foreground"}>
                  {lastUsed}
                </dd>
              </div>
              <div className="flex gap-1" title={absolute(row.expires_at)}>
                <dt>{t("expiresAt")}</dt>
                <dd className={isMuted ? undefined : "text-foreground"}>
                  {expires}
                </dd>
              </div>
            </dl>
            {renderAction(row)}
          </div>
        </div>
      ))}
    </FieldGrid>
  );
}
