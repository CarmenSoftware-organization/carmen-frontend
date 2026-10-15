import { useState } from "react";
import { useWatch, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "use-intl";
import { KeySquare, UserCog } from "lucide-react";
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
import { SectionCard } from "../shared/admin-ui";
import { FormPageShell } from "@/components/share/form-page-shell";
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
        className="space-y-4"
      >
        {/* Name */}
        <Reveal delay={140}>
          <SectionCard icon={UserCog} title={t("name")}>
            <Field data-invalid={!!form.formState.errors.application_role_name}>
              <Input
                placeholder={t("namePlaceholder")}
                className="h-9 max-w-md"
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
          </SectionCard>
        </Reveal>

        {/* Permissions */}
        <Reveal delay={200}>
          <SectionCard
            icon={KeySquare}
            title={t("permissions")}
            count={selectedPermissionCount}
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
          </SectionCard>
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
