import { useState } from "react";
import { KeyRound, RefreshCw } from "lucide-react";
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

function Row({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-3">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        {children}
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
      <div className="space-y-4">
        <Row label={t("baseUrl")}>
          <code className="text-xs break-all">{baseUrl}</code>
          <CopyButton
            value={baseUrl}
            label={t("copyBaseUrl")}
            successMessage={t("copied")}
          />
        </Row>
        <Row label={t("clientId")}>
          <code className="text-xs break-all">{info.client_id}</code>
          {info.client_id && (
            <CopyButton
              value={info.client_id}
              label={t("copyClientId")}
              successMessage={t("copied")}
            />
          )}
        </Row>
        <Row label={t("secret")}>
          <code className="text-xs">{`••••••••${info.secret_last4 ?? ""}`}</code>
          {canEdit && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onView}
                disabled={busy}
              >
                {t("view")}
              </Button>
            </>
          )}
        </Row>
        <Row label={t("createdBy")}>
          {info.created_by_name || dash}
          {info.created_at && (
            <span className="text-muted-foreground text-xs">
              {formatDate(info.created_at, dateFormat)}
            </span>
          )}
        </Row>
        <Row label={t("lastUsed")}>
          {info.last_used_at
            ? formatDate(info.last_used_at, dateFormat)
            : t("never")}
        </Row>
        <Row label={t("status")}>
          {canEdit ? (
            <label className="flex items-center gap-2">
              <Switch
                checked={!!info.is_active}
                disabled={busy}
                onCheckedChange={(v) => setActive.mutate(v)}
              />
              <span>{info.is_active ? t("active") : t("inactive")}</span>
            </label>
          ) : (
            <span>{info.is_active ? t("active") : t("inactive")}</span>
          )}
        </Row>
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setConfirmRegen(true)}
          >
            <RefreshCw aria-hidden="true" />
            {t("regenerate")}
          </Button>
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
          {secretDialog?.clientId && (
            <Row label={t("clientId")}>
              <code className="text-xs break-all">{secretDialog.clientId}</code>
              <CopyButton
                value={secretDialog.clientId}
                label={t("copyClientId")}
                successMessage={t("copied")}
              />
            </Row>
          )}
          <Row label={t("secret")}>
            <code className="text-xs break-all">{secretDialog?.secret}</code>
            {secretDialog && (
              <CopyButton
                value={secretDialog.secret}
                label={t("copySecret")}
                successMessage={t("secretCopied")}
              />
            )}
          </Row>
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
