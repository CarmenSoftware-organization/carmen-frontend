import { useState } from "react";
import { Controller, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  FieldError,
  FieldInput,
  FieldLabel,
} from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Textarea } from "@/components/ui/textarea";
import {
  SettingSection,
  SettingSectionSkeleton,
} from "@/components/ui/setting-section";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useEntityForm } from "@/hooks/use-entity-form";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import {
  useCreateNotificationTemplate,
  useDeleteNotificationTemplate,
  useUpdateNotificationTemplate,
} from "@/hooks/use-notification-template";
import type { NotificationTemplate } from "@/types/noti-tmpl";
import {
  getDefaultValues,
  mapToPayload,
  notificationTemplateSchema,
  type NotificationTemplateFormValues,
} from "./noti-tmpl-form-schema";
import { NotiTmplPreview } from "./noti-tmpl-preview";
import { VariableChips } from "./noti-tmpl-variable-chips";
import { FormPageShell } from "@/components/share/form-page-shell";
import { FormToolbar } from "@/components/share/form-toolbar";
import { FormPageHeaderSkeleton } from "@/components/loader/form-page-skeleton";

const LIST_PATH = "/system-admin/notification-template";
const FORM_ID = "notification-template-form";

interface NotificationTemplateFormProps {
  readonly template?: NotificationTemplate;
}

export function NotificationTemplateForm({
  template,
}: NotificationTemplateFormProps) {
  const t = useTranslations("systemAdmin.notificationTemplate");
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const tt = useTranslations("toast");

  const createMut = useCreateNotificationTemplate();
  const updateMut = useUpdateNotificationTemplate();
  const deleteMut = useDeleteNotificationTemplate();
  const [showDelete, setShowDelete] = useState(false);
  const isPending = createMut.isPending || updateMut.isPending;
  const f = useEntityForm<NotificationTemplateFormValues>({
    entity: template,
    serverFieldErrors: { NOTIFICATION_TEMPLATE_ALREADY_EXISTS: "name" },
    resolver: zodResolver(
      notificationTemplateSchema,
    ) as Resolver<NotificationTemplateFormValues>,
    defaultValues: getDefaultValues(template),
    listPath: LIST_PATH,
    isPending,
  });
  const { form, isAdd, isEdit, isDisabled } = f;
  const errors = form.formState.errors;

  const watchedName = useWatch({ control: form.control, name: "name" });
  const watchedActive = useWatch({ control: form.control, name: "is_active" });
  const watchedBody = useWatch({ control: form.control, name: "body" });
  const title = isAdd ? t("add") : watchedName || t("untitled");

  const onSubmit = (values: NotificationTemplateFormValues) => {
    const payload = mapToPayload(values);
    if (isEdit && template) {
      updateMut.mutate(
        // doc_version round-trips the loaded record's version — backend requires it for optimistic-concurrency on update
        { id: template.id, doc_version: template.doc_version, ...payload },
        {
          onSuccess: () => {
            toast.success(tt("updateSuccess", { entity: t("entity") }));
            f.backToList();
          },
        },
      );
      return;
    }
    createMut.mutate(payload, {
      onSuccess: () => {
        toast.success(tt("createSuccess", { entity: t("entity") }));
        f.backToList();
      },
    });
  };

  // Back = กลับหน้า list เสมอ ไม่ใช่ history back — history คือเส้นทางที่เดินผ่านมา
  // ไม่ใช่ที่ที่อยากกลับไป กดครั้งเดียวต้องถึง list ไม่ใช่ถอยทีละหน้า
  const handleDelete = () => {
    if (!template) return;
    deleteMut.mutate(template.id, {
      onSuccess: () => {
        toast.success(tt("deleteSuccess", { entity: t("entity") }));
        f.backToList();
      },
    });
  };

  return (
    <FormPageShell
      header={
        <FormToolbar
          mode={f.mode}
          formId={FORM_ID}
          isPending={isPending}
          title={title}
          badges={
            !isAdd && (
              <Badge
                variant={watchedActive ? "success-light" : "warning-light"}
                size="xs"
                className="tracking-wider uppercase"
              >
                {watchedActive ? ts("active") : ts("inactive")}
              </Badge>
            )
          }
          onBack={f.handleBack}
          onCancel={f.handleCancel}
          onEdit={f.handleEdit}
          onDelete={template ? () => setShowDelete(true) : undefined}
          deleteIsPending={deleteMut.isPending}
          activity={template && { id: template.id, label: template.name }}
        />
      }
    >
      <form
        id={FORM_ID}
        onSubmit={form.handleSubmit(onSubmit, () =>
          scrollToFirstInvalidField(),
        )}
      >
        {/* Section: General */}
        <SettingSection
          first
          title={t("sectionGeneralTitle")}
          description={t("sectionGeneralDesc")}
        >
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="nt-name" required>
              {tfl("name")}
            </FieldLabel>
            <FieldInput
              id="nt-name"
              placeholder={t("namePlaceholder")}
              disabled={isDisabled}
              maxLength={100}
              error={errors.name?.message}
              {...form.register("name")}
            />
          </Field>

          {template?.code && (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground font-mono text-xs">
                {template.code}
              </p>
              <p className="text-muted-foreground text-xs">
                {t("systemDefaultHint")}
              </p>
            </div>
          )}

          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="nt-description">
              {tfl("description")}
            </FieldLabel>
            <Textarea
              id="nt-description"
              placeholder={tfl("optional")}
              rows={2}
              disabled={isDisabled}
              maxLength={256}
              {...form.register("description")}
            />
          </Field>

          <div className="sm:col-span-2">
            <Controller
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <StatusSwitch
                  id="nt-is-active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isDisabled}
                  // สถานะเดียวกันเคยแสดงสามที่: badge ข้างชื่อเรื่อง, สวิตช์ และ
                  // badge ซ้ำในกล่องสวิตช์ — เหลือสองที่ที่ทำหน้าที่ต่างกันจริง
                  hideBadge
                />
              )}
            />
          </div>
        </SettingSection>

        {/* Section: Message content — section เดียวของหน้าที่กินเต็มความกว้าง
            เพราะเป็นงานจริงของหน้านี้ ครึ่งซ้ายเขียน ครึ่งขวาเห็นผลทันที */}
        <SettingSection
          wide
          title={t("sectionMessageTitle")}
          description={t("sectionMessageDesc")}
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="min-w-0 space-y-5">
              <Field>
                <FieldLabel htmlFor="nt-body" required>
                  {t("colBody")}
                </FieldLabel>
                <Textarea
                  id="nt-body"
                  placeholder={t("bodyPlaceholder")}
                  disabled={isDisabled}
                  maxLength={259}
                  rows={6}
                  className="min-h-32"
                  aria-invalid={!!errors.body}
                  {...form.register("body")}
                />
                <FieldError>{errors.body?.message}</FieldError>
                <VariableChips
                  label={t("insertVariable")}
                  targetId="nt-body"
                  disabled={isDisabled}
                />
              </Field>
            </div>

            <NotiTmplPreview
              name={watchedName || t("untitled")}
              body={watchedBody ?? ""}
            />
          </div>
        </SettingSection>
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

      {template && (
        <DeleteDialog
          open={showDelete}
          onOpenChange={(open) =>
            !open && !deleteMut.isPending && setShowDelete(false)
          }
          title={t("deleteTitle")}
          description={t("deleteConfirm", { name: template.name })}
          isPending={deleteMut.isPending}
          onConfirm={handleDelete}
        />
      )}
    </FormPageShell>
  );
}

export function NotificationTemplateFormSkeleton() {
  return (
    <FormPageShell header={<FormPageHeaderSkeleton />}>
      {/* General: name · description(textarea) · status */}
      <SettingSectionSkeleton first fields={["full", "tall", "full"]} />
      {/* Message content: ครึ่งซ้ายช่องกรอก ครึ่งขวาพรีวิว */}
      <div className="border-border/70 mt-8 space-y-4 border-t pt-8">
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-64" />
        </div>
        <div className="bg-card grid gap-6 rounded-xl border p-5 shadow-sm sm:p-6 lg:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </FormPageShell>
  );
}
