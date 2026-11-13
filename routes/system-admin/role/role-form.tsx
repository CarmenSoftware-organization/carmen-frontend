import { useState } from "react";
import { useWatch, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "use-intl";
import { Input } from "@/components/ui/input";
import { Field, FieldError } from "@/components/ui/field";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useEntityForm } from "@/hooks/use-entity-form";
import { AnimationStyles, Reveal } from "@/components/share/reveal";
import { toast } from "sonner";
import {
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
} from "../shared/use-role";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import type { RoleDetail } from "@/types/role";
import { FormPageShell } from "@/components/share/form-page-shell";
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import { SettingField } from "@/components/share/setting-field";
import { RoleHero } from "./role-form-hero";
import { PermissionPicker } from "./permission-picker";
import { useRolePrint } from "./use-role-print";
import {
  roleSchema,
  getDefaultValues,
  grantedPermissionIds,
  type RoleFormValues,
} from "./role-form-schema";

interface RoleFormProps {
  readonly role?: RoleDetail;
}

const LIST_PATH = "/system-admin/role";

export function RoleForm({ role }: RoleFormProps) {
  const t = useTranslations("systemAdmin.role");
  const tt = useTranslations("toast");
  const tfl = useTranslations("field");
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const [showDelete, setShowDelete] = useState(false);

  const isPending = createRole.isPending || updateRole.isPending;

  const originalPermissionIds = new Set(role ? grantedPermissionIds(role) : []);

  const defaultValues = getDefaultValues(role);

  const f = useEntityForm<RoleFormValues>({
    entity: role,
    serverFieldErrors: { ROLE_NAME_ALREADY_EXISTS: "application_role_name" },
    resolver: zodResolver(roleSchema) as Resolver<RoleFormValues>,
    defaultValues,
    listPath: LIST_PATH,
    isPending,
  });
  const { form, isAdd, isEdit, isDisabled } = f;
  const { printRole } = useRolePrint();

  /* Live watches — subscribe only to specific fields */
  const watchedName = useWatch({
    control: form.control,
    name: "application_role_name",
  });
  const watchedPermissions = useWatch({
    control: form.control,
    name: "permissions",
  });
  const selectedPermissionCount = watchedPermissions?.length ?? 0;

  const onSubmit = (values: RoleFormValues) => {
    if (isAdd) {
      createRole.mutate(
        {
          application_role_name: values.application_role_name,
          permissions: { add: values.permissions },
        },
        {
          onSuccess: () => {
            toast.success(tt("createSuccess", { entity: t("entity") }));
            f.backToList();
          },
        },
      );
    } else if (isEdit && role) {
      const currentIds = new Set(values.permissions);
      const add = values.permissions.filter(
        (id) => !originalPermissionIds.has(id),
      );
      const remove = [...originalPermissionIds].filter(
        (id) => !currentIds.has(id),
      );

      updateRole.mutate(
        {
          id: role.id,
          // doc_version round-trips the loaded record's version — backend requires it for optimistic-concurrency on update
          doc_version: role.doc_version,
          application_role_name: values.application_role_name,
          permissions: { add, remove },
        },
        {
          onSuccess: () => {
            toast.success(tt("updateSuccess", { entity: t("entity") }));
            f.backToList();
          },
        },
      );
    }
  };

  const heroName = watchedName ?? "";

  return (
    <FormPageShell
      width="wide"
      header={
        <Reveal>
          <RoleHero
            name={heroName}
            mode={f.mode}
            canDelete={!!role}
            isDeleting={deleteRole.isPending}
            isSaving={isPending}
            onBack={f.handleBack}
            onDelete={() => setShowDelete(true)}
            onEdit={f.handleEdit}
            onCancel={f.handleCancel}
            onPrint={() => printRole(heroName, watchedPermissions ?? [])}
          />
        </Reveal>
      }
    >
      <AnimationStyles />
      {/* ── Form ──────────────────────────────────── */}
      <form
        id="role-form"
        onSubmit={form.handleSubmit(onSubmit, () =>
          scrollToFirstInvalidField(),
        )}
      >
        {/* Name — โหมดดูเป็นข้อความ (ป้ายเงียบ + ค่า) กรอบมีเฉพาะตอนแก้ได้จริง */}
        <Reveal delay={140}>
          <CompactSection first title={tfl("general")}>
            <FieldGrid>
              {f.mode === "view" ? (
                <SettingField label={t("name")} value={watchedName} />
              ) : (
                <Field
                  data-invalid={!!form.formState.errors.application_role_name}
                >
                  <label
                    htmlFor="role-name"
                    className="text-foreground text-xs font-semibold"
                  >
                    {t("name")}
                  </label>
                  <Input
                    id="role-name"
                    placeholder={t("namePlaceholder")}
                    className="h-9"
                    disabled={isDisabled}
                    maxLength={100}
                    {...form.register("application_role_name")}
                  />
                  {form.formState.errors.application_role_name?.message && (
                    <FieldError>
                      {form.formState.errors.application_role_name.message}
                    </FieldError>
                  )}
                </Field>
              )}
            </FieldGrid>
          </CompactSection>
        </Reveal>

        {/* Permissions — ทั้งโหมดดูและโหมดแก้แสดงทุกรายการของทะเบียนในโครงเดียวกัน (ผู้ใช้สั่ง
            2026-11-13: โหมดดูที่โชว์เฉพาะสิทธิ์ที่ถืออยู่อ่านแล้วงง) — โหมดดูแค่กดไม่ได้ ส่วนค้นหา
            กับตัวกรอง Granted / Missing ยังใช้ได้ · แต่ละโมดูลมีกรอบของตัวเอง จึงไม่ห่อการ์ดซ้อน */}
        <Reveal delay={200}>
          <CompactSection
            title={t("permissions")}
            count={selectedPermissionCount}
            frameless
          >
            <Controller
              control={form.control}
              name="permissions"
              render={({ field }) => (
                <PermissionPicker
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isDisabled}
                />
              )}
            />
          </CompactSection>
        </Reveal>
      </form>

      <DiscardDialog {...f.discard.dialogProps} variant="warning" />

      <DiscardDialog
        open={f.navGuard.isOpen}
        onOpenChange={(o) => {
          if (!o) f.navGuard.cancel();
        }}
        onConfirm={f.navGuard.confirm}
        onCancel={f.navGuard.cancel}
        variant="warning"
      />

      {role && (
        <DeleteDialog
          open={showDelete}
          onOpenChange={(open) =>
            !open && !deleteRole.isPending && setShowDelete(false)
          }
          title={t("deleteTitle")}
          description={t("deleteConfirm", {
            name: role.application_role_name,
          })}
          isPending={deleteRole.isPending}
          onConfirm={() => {
            deleteRole.mutate(role.id, {
              onSuccess: () => {
                toast.success(tt("deleteSuccess", { entity: t("entity") }));
                f.backToList();
              },
            });
          }}
        />
      )}
    </FormPageShell>
  );
}
