import { useState } from "react";
import { Eye, KeyRound, RefreshCw } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { SettingSection } from "@/components/ui/setting-section";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import { Switch } from "@/components/ui/switch";
import { PERMISSIONS } from "@/constant/permissions";
import { useCan } from "@/hooks/use-can";
import { useInterfaceEntitlement } from "@/hooks/use-interface-entitlement";
import { useLocale } from "@/hooks/use-locale";
import { formatDate } from "@/lib/date-utils";
import {
  externalApiBaseUrl,
  useBuApiKey,
  useCreateBuApiKey,
  useRegenerateBuApiKey,
  useRevealBuApiKey,
  useSetBuApiKeyActive,
} from "./use-bu-api-key";

type SecretDialog = {
  readonly kind: "created" | "regenerated" | "revealed";
  readonly clientId?: string;
  readonly secret: string;
};

/** ปุ่ม copy ที่อยู่ในกรอบของ `CredentialField` แล้ว — ไม่ต้องมีกรอบซ้อนอีกชั้น */
const COPY_IN_FIELD = "border-transparent bg-transparent";

/**
 * ช่องค่าที่ผู้ใช้หยิบไป copy — กรอบ monospace สูงเท่ากันทุกแถว ปุ่มอยู่ท้ายช่อง
 *
 * label วางเหนือกรอบ (ไม่ใช่ซ้าย) ให้ค่ายาวอย่าง Base URL ได้เต็มความกว้าง ปุ่มจึงไม่หล่นบรรทัด
 */
function CredentialField({
  label,
  value,
  actions,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <div className="bg-muted/40 flex min-h-9 items-center gap-2 rounded-md border py-1 pr-1.5 pl-3">
        <code className="min-w-0 flex-1 font-mono text-xs break-all">
          {value}
        </code>
        {actions && (
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
        )}
      </div>
    </div>
  );
}

/**
 * ส่วน "API Access" ของหน้า Accounting → External — จัดการ API key ขาเข้าของ BU
 *
 * ทำงานทันทีด้วย mutation ของตัวเอง ไม่อยู่ในวงจร dirty/save ของฟอร์ม (render หลัง
 * `<form>` ผ่าน slot `afterForm` จึงไม่ถูก `<fieldset disabled>` ของโหมดอ่านปิดไปด้วย)
 *
 * - ไม่มีสิทธิ์ `system_admin.bu_api_key.view` → ไม่ render
 * - ปุ่มเขียนทั้งหมด (สร้าง/ออกใหม่/สวิตช์/View — View ก็คือ reveal) ต้องมี `.update`
 *   และใบ INF ไม่หมดอายุ (backend ตอบ 403 ทั้งเขียนและ reveal เมื่อหมดอายุ)
 * - secret ที่เปิดเผยถือใน state ของ component นี้เท่านั้น ปิด dialog/unmount = ทิ้ง
 *
 * @returns React element ของ section หรือ null เมื่อไม่มีสิทธิ์ดู
 */
export function ExternalApiAccessSection() {
  const t = useTranslations(
    "systemAdmin.interface.accounting.external.apiAccess",
  );
  const { can, canWrite } = useCan();
  const {
    entitlementOf,
    canReadConfig,
    isLoading: licenseLoading,
  } = useInterfaceEntitlement();
  const { dateFormat } = useLocale();

  const [secretDialog, setSecretDialog] = useState<SecretDialog | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  // เก็บ kind ล่าสุดไว้ให้หัว dialog ไม่เปลี่ยนตอน animation ปิด (state ถูกเคลียร์ทันที)
  const [lastKind, setLastKind] = useState<SecretDialog["kind"]>("revealed");
  const showSecret = (d: SecretDialog) => {
    setLastKind(d.kind);
    setSecretDialog(d);
  };

  const canView = can(PERMISSIONS.system_admin.bu_api_key.view);
  const licenseExpired =
    !canWrite || entitlementOf("accounting", "external") === "expired";
  const canEdit =
    can(PERMISSIONS.system_admin.bu_api_key.update) && !licenseExpired;

  const readable = canReadConfig("accounting", "external");
  const query = useBuApiKey(canView && readable);
  const create = useCreateBuApiKey();
  const regenerate = useRegenerateBuApiKey();
  const reveal = useRevealBuApiKey();
  const setActive = useSetBuApiKeyActive();

  if (!canView) return null;

  const info = query.data;
  const baseUrl = externalApiBaseUrl(info);

  const closeSecretDialog = () => {
    setSecretDialog(null);
    // ทิ้งผลของ mutation ที่ถือ secret ไว้ด้วย
    create.reset();
    regenerate.reset();
    reveal.reset();
  };

  const onCreate = () =>
    create.mutate(undefined, {
      onSuccess: (r) =>
        showSecret({
          kind: "created",
          clientId: r.client_id,
          secret: r.secret,
        }),
    });

  const onRegenerate = () =>
    regenerate.mutate(undefined, {
      onSuccess: (r) => {
        setConfirmRegen(false);
        showSecret({
          kind: "regenerated",
          clientId: r.client_id,
          secret: r.secret,
        });
      },
    });

  const onView = () =>
    reveal.mutate(undefined, {
      onSuccess: (r) => {
        showSecret({ kind: "revealed", secret: r.secret });
        reveal.reset();
      },
    });

  const busy =
    create.isPending ||
    regenerate.isPending ||
    reveal.isPending ||
    setActive.isPending;

  const dash = <span className="text-muted-foreground">—</span>;

  let body: React.ReactNode;
  if (licenseLoading || (query.isPending && query.fetchStatus !== "idle")) {
    body = <Skeleton className="h-24 w-full" />;
  } else if (!readable) {
    // query ถูกปิด (ใบ INF อ่านไม่ได้) — ห้ามบอกว่า "ยังไม่มี key" เพราะเราไม่รู้
    body = <p className="text-muted-foreground text-sm">{t("unavailable")}</p>;
  } else if (query.isError) {
    body = (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    );
  } else if (!info?.exists) {
    body = (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">{t("noKey")}</p>
        {canEdit && (
          <Button type="button" size="sm" onClick={onCreate} disabled={busy}>
            <KeyRound aria-hidden="true" />
            {create.isPending ? t("creating") : t("create")}
          </Button>
        )}
      </div>
    );
  } else {
    body = (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusDotBadge tone={info.is_active ? "success" : "neutral"}>
            {info.is_active ? t("active") : t("inactive")}
          </StatusDotBadge>
          {canEdit && (
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              {t("status")}
              <Switch
                checked={!!info.is_active}
                disabled={busy}
                onCheckedChange={(v) => setActive.mutate(v)}
              />
            </label>
          )}
        </div>

        {/* Base URL เต็มแถว, Client ID กับ Secret คู่กันเมื่อ "การ์ด" กว้างพอ — วัดที่ container
            ไม่ใช่ viewport เพราะการ์ดอยู่คอลัมน์ขวา 2/3 ความกว้างของ viewport บอกอะไรไม่ได้ */}
        <div className="@container">
          <div className="grid gap-4 @lg:grid-cols-2">
            <div className="@lg:col-span-2">
              <CredentialField
                label={t("baseUrl")}
                value={baseUrl}
                actions={
                  <CopyButton
                    value={baseUrl}
                    label={t("copyBaseUrl")}
                    successMessage={t("copied")}
                    className={COPY_IN_FIELD}
                  />
                }
              />
            </div>
            <CredentialField
              label={t("clientId")}
              value={info.client_id || dash}
              actions={
                info.client_id && (
                  <CopyButton
                    value={info.client_id}
                    label={t("copyClientId")}
                    successMessage={t("copied")}
                    className={COPY_IN_FIELD}
                  />
                )
              }
            />
            <CredentialField
              label={t("secret")}
              value={`••••••••${info.secret_last4 ?? ""}`}
              actions={
                canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={onView}
                    disabled={busy}
                  >
                    <Eye aria-hidden="true" />
                    {t("view")}
                  </Button>
                )
              }
            />
          </div>
        </div>

        <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span>
            {t("createdBy")}{" "}
            <span className="text-foreground">
              {info.created_by_name || "—"}
            </span>
            {info.created_at && (
              <span className="whitespace-nowrap">
                {` · ${formatDate(info.created_at, dateFormat)}`}
              </span>
            )}
          </span>
          <span>
            {t("lastUsed")}{" "}
            <span className="text-foreground whitespace-nowrap">
              {info.last_used_at
                ? formatDate(info.last_used_at, dateFormat)
                : t("never")}
            </span>
          </span>
        </p>

        {canEdit && (
          <div className="border-destructive/30 bg-destructive/5 flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2.5">
            <p className="text-muted-foreground min-w-0 flex-1 basis-56 text-xs">
              {t("regenerateDesc")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive border-destructive/40"
              disabled={busy}
              onClick={() => setConfirmRegen(true)}
            >
              <RefreshCw aria-hidden="true" />
              {t("regenerate")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <SettingSection title={t("title")} description={t("desc")} plain first>
        <div className="space-y-4">
          {licenseExpired && (
            <p className="text-warning-ink text-xs">{t("licenseExpired")}</p>
          )}
          {body}
        </div>
      </SettingSection>

      <ConfirmDialog
        open={confirmRegen}
        onOpenChange={setConfirmRegen}
        title={t("regenerateTitle")}
        description={t("regenerateDesc")}
        confirmText={t("regenerate")}
        variant="destructive"
        isPending={regenerate.isPending}
        onConfirm={onRegenerate}
      />

      <Dialog
        open={secretDialog !== null}
        onOpenChange={(o) => {
          if (!o) closeSecretDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {lastKind === "revealed" ? t("secretTitle") : t("newSecretTitle")}
            </DialogTitle>
            <DialogDescription>
              {lastKind === "revealed" ? t("secretLogged") : t("newSecretDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {secretDialog?.clientId && (
              <CredentialField
                label={t("clientId")}
                value={secretDialog.clientId}
                actions={
                  <CopyButton
                    value={secretDialog.clientId}
                    label={t("copyClientId")}
                    successMessage={t("copied")}
                    className={COPY_IN_FIELD}
                  />
                }
              />
            )}
            <CredentialField
              label={t("secret")}
              value={secretDialog?.secret}
              actions={
                secretDialog && (
                  <CopyButton
                    value={secretDialog.secret}
                    label={t("copySecret")}
                    successMessage={t("secretCopied")}
                    className={COPY_IN_FIELD}
                  />
                )
              }
            />
          </div>
          <DialogFooter>
            <Button type="button" onClick={closeSecretDialog}>
              {t("done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
