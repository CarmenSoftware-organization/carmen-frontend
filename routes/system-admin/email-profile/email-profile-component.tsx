import { useState } from "react";
import { Link2, Loader2, Pencil, Send, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { ListPageShell } from "@/components/share/list-page-shell";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  authTypeOf,
  isOAuthConnected,
  type EmailProfile,
} from "@/types/email-profile";
import { EmailProfileOAuthDialog } from "./email-profile-oauth-dialog";
import { EmailProfileDialog } from "./email-profile-dialog";
import { EmailProfileTestDialog } from "./email-profile-test-dialog";
import { useEmailProfiles } from "@/hooks/use-email-profiles";

/**
 * หน้าตั้งค่าโปรไฟล์อีเมลผู้ส่งของหน่วยธุรกิจ — สร้าง/แก้/ลบ/ตั้งค่าเริ่มต้น และทดสอบส่ง
 *
 * ทุกโปรไฟล์เก็บรวมกันเป็น array เดียวใน app-config key `email_profiles` (ไม่มี list
 * endpoint แยก ไม่มี pagination) จึงใช้ตาราง HTML ธรรมดาแทน `DataGrid`
 *
 * @returns React element ของหน้า email profile
 */
export default function EmailProfileComponent() {
  const t = useTranslations("systemAdmin.emailProfile");
  const tc = useTranslations("common");
  const tt = useTranslations("toast");

  const { value, isLoading, isError, save, isSaving, testProfile, isTesting } =
    useEmailProfiles();
  const { profiles, default_profile_id } = value;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<EmailProfile | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<EmailProfile | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testTarget, setTestTarget] = useState<EmailProfile | null>(null);
  const [connectTarget, setConnectTarget] = useState<EmailProfile | null>(null);

  const openAdd = () => {
    setEditingProfile(null);
    setDialogOpen(true);
  };

  const openEdit = (profile: EmailProfile) => {
    setEditingProfile(profile);
    setDialogOpen(true);
  };

  const handleSave = (profile: EmailProfile) => {
    const isEdit = profiles.some((p) => p.id === profile.id);

    // ── ประกอบ `profiles[]` ก่อนส่ง — ยังต้องส่งทั้งชุดเสมอ ──
    // save เป็นการเขียนทับ value ทั้งก้อน (ไม่ใช่ partial update) ไม่ส่งโปรไฟล์เดิมมาด้วย =
    // รายการที่ไม่ได้แก้หายไปเงียบๆ backend จับคู่รหัสผ่านที่เก็บไว้ด้วย `id` ของโปรไฟล์
    // (ไม่ใช่ตามตำแหน่งใน array แล้ว — Task B1 แก้เป็น id-based ใน commit 49162675a)
    // โปรไฟล์ที่ยังถือค่า mask แต่ `id` ไม่ตรงกับของที่เก็บไว้ backend จะ throw ดังนั้น
    // โปรไฟล์ใหม่ (id ใหม่) ต้องมีรหัสผ่านจริงเสมอ ห้ามส่ง mask — แก้ไข = map ทับที่ id เดิม,
    // เพิ่มใหม่ = append ต่อท้าย (ลำดับไม่มีผลต่อการจับคู่รหัสผ่านอีกแล้ว แต่ก็ไม่มีเหตุผลต้อง
    // สลับลำดับอยู่ดี)
    const nextProfiles = isEdit
      ? profiles.map((p) => (p.id === profile.id ? profile : p))
      : [...profiles, profile];
    // เหลือโปรไฟล์เดียว → เป็นค่าเริ่มต้นโดยอัตโนมัติ
    const nextDefault =
      nextProfiles.length === 1 ? nextProfiles[0].id : default_profile_id;

    save(
      { default_profile_id: nextDefault, profiles: nextProfiles },
      {
        onSuccess: () => {
          toast.success(
            isEdit
              ? tt("updateSuccess", { entity: t("entity") })
              : tt("createSuccess", { entity: t("entity") }),
          );
          setDialogOpen(false);
        },
      },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    // ลบแล้วลำดับของรายการที่เหลือเลื่อนตามธรรมชาติ — ไม่มีผลอะไร (backend จับคู่รหัสผ่าน
    // ด้วย `id` ไม่ใช่ตำแหน่ง) ใช้ `filter` ตรงไปตรงมา ไม่ต้องคิดเรื่องลำดับ
    const nextProfiles = profiles.filter((p) => p.id !== deleteTarget.id);
    const nextDefault =
      nextProfiles.length === 0
        ? null
        : nextProfiles.length === 1
          ? nextProfiles[0].id
          : default_profile_id;

    save(
      { default_profile_id: nextDefault, profiles: nextProfiles },
      {
        onSuccess: () => {
          toast.success(tt("deleteSuccess", { entity: t("entity") }));
          setDeleteTarget(null);
        },
      },
    );
  };

  const handleSetDefault = (profile: EmailProfile) => {
    // ไม่แตะ `profiles` เลย — ส่งอาเรย์เดิมกลับไปตามลำดับเดิม เปลี่ยนแค่ default_profile_id
    save(
      { default_profile_id: profile.id, profiles },
      {
        onSuccess: () =>
          toast.success(t("setDefaultSuccess", { name: profile.name })),
      },
    );
  };

  const handleTest = (profile: EmailProfile) => {
    setTestTarget(profile);
  };

  const handleTestSend = (to: string) => {
    const profile = testTarget;
    if (!profile) return;
    setTestingId(profile.id);
    testProfile(
      { profile_id: profile.id, to },
      {
        onSuccess: (response) => {
          // gateway ห่อผลลัพธ์ไว้ใต้ `data` เสมอ — อ่านระดับบนสุดจะได้ undefined
          // และ HTTP 200 เองก็ไม่ได้แปลว่าส่งสำเร็จ ต้องอ่าน `sent`/`error` ต่ออีกชั้น
          const result = response.data;
          if (result?.sent) {
            toast.success(
              t("testSentSuccess", { recipient: result.recipient ?? to }),
            );
            setTestTarget(null);
          } else {
            // ส่งไม่สำเร็จ → คงกล่องไว้ให้แก้ปลายทางแล้วลองใหม่ได้ทันที
            toast.error(result?.error || t("testSentFailure"));
          }
        },
        onSettled: () => setTestingId(null),
      },
    );
  };

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      actions={
        !isError && !isLoading ? (
          <DocumentListActions
            onAdd={openAdd}
            addLabel={t("add")}
            hideExportPrint
          />
        ) : undefined
      }
    >
      {isError && <ErrorState message={t("loadError")} />}

      {!isError && isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {!isError && !isLoading && profiles.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      )}

      {!isError && !isLoading && profiles.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted border-b">
              <tr>
                <th className="h-9 px-3 text-left font-medium">
                  {t("table.name")}
                </th>
                <th className="h-9 px-3 text-left font-medium">
                  {t("table.from")}
                </th>
                <th className="h-9 px-3 text-left font-medium">
                  {t("table.status")}
                </th>
                <th className="h-9 px-3 text-right font-medium">
                  {tc("rowActions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => {
                const isDefault = profile.id === default_profile_id;
                // ลบตัวที่เป็นค่าเริ่มต้นไม่ได้ถ้ายังมีตัวอื่น — ต้องตั้งตัวใหม่ก่อน
                const deleteDisabled = isDefault && profiles.length > 1;
                const isRowTesting = isTesting && testingId === profile.id;

                return (
                  <tr key={profile.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{profile.name}</span>
                        {isDefault && (
                          <Badge variant="success-light" size="xs">
                            {t("defaultBadge")}
                          </Badge>
                        )}
                        {authTypeOf(profile) !== "password" && (
                          <Badge variant="secondary" size="xs">
                            {authTypeOf(profile) === "oauth2_app"
                              ? t("badgeMicrosoft365")
                              : t("badgeMicrosoft")}
                          </Badge>
                        )}
                        {authTypeOf(profile) === "oauth2_delegated" &&
                          !isOAuthConnected(profile) && (
                            <Badge variant="warning-light" size="xs">
                              {t("badgeNotConnected")}
                            </Badge>
                          )}
                      </div>
                    </td>
                    <td className="text-muted-foreground px-3 py-2">
                      {profile.from_email}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={profile.enabled ? "default" : "secondary"}
                      >
                        {profile.enabled
                          ? t("statusEnabled")
                          : t("statusDisabled")}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {!isDefault && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleSetDefault(profile)}
                            disabled={isSaving}
                          >
                            <Star className="size-3" aria-hidden="true" />
                            {t("setDefault")}
                          </Button>
                        )}
                        {authTypeOf(profile) === "oauth2_delegated" && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setConnectTarget(profile)}
                          >
                            <Link2 className="size-3" aria-hidden="true" />
                            {isOAuthConnected(profile)
                              ? t("reconnect")
                              : t("connect")}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleTest(profile)}
                          disabled={isTesting}
                          aria-label={t("testSend")}
                        >
                          {isRowTesting ? (
                            <Loader2
                              className="size-3.5 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Send className="size-3.5" aria-hidden="true" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => openEdit(profile)}
                          aria-label={tc("edit")}
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </Button>
                        {deleteDisabled ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex" tabIndex={0}>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  disabled
                                  aria-label={tc("delete")}
                                >
                                  <Trash2
                                    className="size-3.5"
                                    aria-hidden="true"
                                  />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t("cannotDeleteDefaultTooltip")}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setDeleteTarget(profile)}
                            aria-label={tc("delete")}
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <EmailProfileDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        profile={editingProfile}
        onSave={handleSave}
        isSaving={isSaving}
      />

      {/* mount เฉพาะตอนเปิด — ค่าตั้งต้นของช่องปลายทางจึงมาจาก initializer ไม่ต้องใช้ effect sync */}
      {testTarget && (
        <EmailProfileTestDialog
          open
          onOpenChange={(open) => !open && setTestTarget(null)}
          profile={testTarget}
          onSend={handleTestSend}
          isSending={isTesting}
        />
      )}

      {/* mount เฉพาะตอนเปิด — ปิด = unmount = poll หยุดทันที */}
      {connectTarget && (
        <EmailProfileOAuthDialog
          profile={connectTarget}
          onOpenChange={(open) => !open && setConnectTarget(null)}
        />
      )}

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !isSaving && setDeleteTarget(null)}
        title={t("deleteTitle")}
        description={t("deleteConfirm", { name: deleteTarget?.name ?? "" })}
        isPending={isSaving}
        onConfirm={handleDelete}
      />
    </ListPageShell>
  );
}
