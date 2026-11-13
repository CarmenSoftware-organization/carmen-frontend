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
import { StatusSwitch } from "@/components/ui/status-switch";
import { Textarea } from "@/components/ui/textarea";
import {
  CompactSection,
  CompactSectionSkeleton,
  FieldGrid,
  SECTION_PAIR,
} from "@/components/share/compact-section";
import { SettingField } from "@/components/share/setting-field";
import { cn } from "@/lib/utils";
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
import { NotiTmplPreview, TemplateText } from "./noti-tmpl-preview";
import { VariableChips } from "./noti-tmpl-variable-chips";
import { FormPageShell } from "@/components/share/form-page-shell";
import { FormToolbar } from "@/components/share/form-toolbar";
import { FormPageHeaderSkeleton } from "@/components/loader/form-page-skeleton";

const LIST_PATH = "/system-admin/notification-template";
const FORM_ID = "notification-template-form";

/**
 * สองหมวดของหน้า (ทั่วไป | เนื้อหาข้อความ) วางเคียงกันบนจอกว้าง 1700px ขึ้นไป ต่ำกว่านั้นเรียงลง
 * `-mt-5` หักระยะบนของหมวดแรกทิ้ง — ใส่ `first` ให้หมวดซ้ายไม่ได้ เพราะตอนวางเคียงกันหมวดขวา
 * ยังมี `mt-5` อยู่ หัวข้อสองฝั่งจะเหลื่อมกัน 20px
 */
const SECTIONS = cn(SECTION_PAIR, "-mt-5");

/** ครึ่งซ้ายเขียน ครึ่งขวาเห็นผล — แบ่งตามความกว้างของการ์ดเอง (การ์ดครึ่งจอบน Full HD ก็ยังแบ่งได้) */
const MESSAGE_GRID = "grid gap-4 @2xl:grid-cols-2";

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
  const watchedDescription = useWatch({
    control: form.control,
    name: "description",
  });
  // โหมดดูแสดงค่าเป็นข้อความ (ป้ายเงียบ + ค่า) — กรอบมีเฉพาะช่องที่แก้ได้จริง
  const isView = f.mode === "view";
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
      width="wide"
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
        <div className={SECTIONS}>
          <CompactSection
            title={t("sectionGeneralTitle")}
            description={t("sectionGeneralDesc")}
          >
            <FieldGrid>
              {isView ? (
                <SettingField label={tfl("name")} value={watchedName} />
              ) : (
                <Field className="min-w-0">
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
              )}

              {/* รหัสแก้ไม่ได้ทั้งสองโหมด จึงเป็นข้อความเสมอ */}
              {template?.code && (
                <SettingField
                  label={tfl("code")}
                  value={template.code}
                  mono
                  example={t("systemDefaultHint")}
                />
              )}

              {isView ? (
                // สถานะซ้ำกับ badge ข้างชื่อเรื่องโดยตั้งใจ: badge บอกสถานะของเอกสาร ส่วนช่องนี้
                // คือค่าของช่องที่โหมดแก้เปลี่ยนเป็นสวิตช์ — ตัดออกแล้วช่องจะโผล่/หายตอนสลับโหมด
                <SettingField
                  label={tfl("status")}
                  value={watchedActive ? ts("active") : ts("inactive")}
                />
              ) : (
                <div className="min-w-0">
                  <Controller
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <StatusSwitch
                        id="nt-is-active"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isDisabled}
                        hideBadge
                      />
                    )}
                  />
                </div>
              )}

              {isView ? (
                <SettingField
                  label={tfl("description")}
                  value={watchedDescription}
                  fullWidth
                />
              ) : (
                <Field className="min-w-0 @md:col-span-2">
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
              )}
            </FieldGrid>
          </CompactSection>

          {/* เนื้อหาข้อความ — งานจริงของหน้านี้: ซ้ายคือเทมเพลต (โหมดแก้เป็นช่องกรอก) ขวาคือผลที่ผู้รับเห็น */}
          <CompactSection
            title={t("sectionMessageTitle")}
            description={t("sectionMessageDesc")}
          >
            <div className="@container h-full">
              <div className={cn(MESSAGE_GRID, "h-full")}>
                {isView ? (
                  <div className="min-w-0">
                    <div className="text-muted-foreground text-xs">
                      {t("colBody")}
                    </div>
                    <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">
                      {watchedBody ? (
                        <TemplateText text={watchedBody} wrap />
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </p>
                  </div>
                ) : (
                  <Field className="min-w-0">
                    <FieldLabel htmlFor="nt-body" required>
                      {t("colBody")}
                    </FieldLabel>
                    <Textarea
                      id="nt-body"
                      placeholder={t("bodyPlaceholder")}
                      disabled={isDisabled}
                      maxLength={259}
                      rows={4}
                      className="min-h-24"
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
                )}

                <NotiTmplPreview
                  name={watchedName || t("untitled")}
                  body={watchedBody ?? ""}
                />
              </div>
            </div>
          </CompactSection>
        </div>
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
    <FormPageShell width="wide" header={<FormPageHeaderSkeleton />}>
      {/* โครงเดียวกับหน้าจริง: สองหมวด เคียงกันบนจอกว้าง */}
      <div className={SECTIONS}>
        <CompactSectionSkeleton className="h-28" />
        <CompactSectionSkeleton className="h-28" />
      </div>
    </FormPageShell>
  );
}
