import { useEffect, useState } from "react";
import { useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { SettingSection } from "@/components/ui/setting-section";
import { FormPageSkeleton } from "@/components/loader/form-page-skeleton";
import { FormPageShell } from "@/components/share/form-page-shell";
import { FormToolbar } from "@/components/share/form-toolbar";
import { useEntityForm } from "@/hooks/use-entity-form";
import { useCan } from "@/hooks/use-can";
import { PERMISSIONS } from "@/constant/permissions";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import type { JvTemplate, JvTemplateType } from "./jv-template-types";
import {
  JV_TEMPLATE_PAGES,
  jvTemplateDetailPath,
  type JvTemplatePageKind,
} from "./jv-template-config";
import {
  createJvTemplateFormSchema,
  defaultLinesFor,
  getJvTemplateDefaultValues,
  toJvTemplateInput,
  type JvTemplateFormValues,
} from "./jv-template-form-schema";
import { jvTemplateTypeLabel } from "./jv-template-labels";
import {
  useCreateJvTemplate,
  useDeleteJvTemplate,
  useJvTemplate,
  useUpdateJvTemplate,
} from "./use-jv-template";
import { JvTemplateHeaderFields } from "./jv-template-header-fields";
import { JvTemplateLines } from "./jv-template-lines";
import { JvTemplateGenerateDialog } from "./jv-template-generate-dialog";

const FORM_ID = "jv-template-form";
const PERMISSION_PREFIX = "accounting.gl.jv_template";

/**
 * หน้ารายละเอียด template (add / view / edit) — `:id` = `new` คือสร้างใหม่
 * ชนิดมาจากหน้าที่เปิด (recurring/allocation ล็อก) หรือ `?type=` · หน้ารวมไม่ระบุชนิด
 * ต้องเลือกชนิดก่อนกรอกส่วนอื่น · ชนิดเปลี่ยนไม่ได้หลังสร้าง
 */
export function JvTemplateDetail({
  kind,
}: {
  readonly kind: JvTemplatePageKind;
}) {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const t = useTranslations("accounting.jvTemplate");
  const { data, isLoading, error, refetch } = useJvTemplate(
    isNew ? undefined : id,
  );

  if (isNew) return <JvTemplateForm kind={kind} />;
  if (isLoading) return <FormPageSkeleton />;
  if (error || !data) {
    return (
      <ErrorState
        error={error}
        notFoundMessage={t("notFound")}
        onRetry={() => refetch()}
        backTo={JV_TEMPLATE_PAGES[kind].path}
      />
    );
  }
  return <JvTemplateForm key={data.id} kind={kind} template={data} />;
}

function JvTemplateForm({
  kind,
  template,
}: {
  readonly kind: JvTemplatePageKind;
  readonly template?: JvTemplate;
}) {
  "use no memo";
  const page = JV_TEMPLATE_PAGES[kind];
  const t = useTranslations("accounting.jvTemplate");
  const tv = useTranslations("validation");
  const tt = useTranslations("toast");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { can, canWrite } = useCan();
  const canGenerate =
    canWrite && can(PERMISSIONS.accounting.gl_jv_template.generate);

  // ชนิดตอนสร้าง: หน้าชนิดเดียวล็อกเอง · `?type=` ที่หน้านี้สร้างได้ก็ล็อก · ไม่งั้นให้เลือก
  const queryType = searchParams.get("type") as JvTemplateType | null;
  const presetType: JvTemplateType | "" =
    page.fixedType ??
    (queryType && page.creatableTypes.includes(queryType) ? queryType : "");
  const typeChoices =
    !template && !presetType ? page.creatableTypes : null;

  const createTemplate = useCreateJvTemplate();
  const updateTemplate = useUpdateJvTemplate();
  const deleteTemplate = useDeleteJvTemplate();
  const isPending = createTemplate.isPending || updateTemplate.isPending;
  const [showDelete, setShowDelete] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  const defaultValues = getJvTemplateDefaultValues(template, presetType);
  const f = useEntityForm<JvTemplateFormValues>({
    entity: template,
    resolver: zodResolver(
      createJvTemplateFormSchema(t, tv),
    ) as Resolver<JvTemplateFormValues>,
    defaultValues,
    listPath: page.path,
    isPending,
    serverFieldErrors: { GL_JV_TEMPLATE_DUPLICATE_CODE: "code" },
  });
  const { form, isAdd, isEdit, isView, isDisabled } = f;

  // หลัง save สำเร็จ detail ถูก refetch — doc_version ใหม่มาที่ prop · โหมดดูต้องตามค่าจาก
  // server ไม่งั้น Edit รอบถัดไปเริ่มจากค่าที่ normalize ไม่ตรงกับที่ backend เก็บ
  useEffect(() => {
    if (f.mode === "view" && template) {
      form.reset(getJvTemplateDefaultValues(template, template.template_type));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- รีเซ็ตเมื่อเวอร์ชันเปลี่ยนเท่านั้น
  }, [template?.doc_version]);

  const watchedType = useWatch({ control: form.control, name: "template_type" });
  const watchedName = useWatch({ control: form.control, name: "name" });
  const watchedCode = useWatch({ control: form.control, name: "code" });
  const watchedActive = useWatch({ control: form.control, name: "is_active" });

  const handleTypeChange = (next: JvTemplateType) => {
    form.setValue("template_type", next, {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });
    // บรรทัดของแต่ละชนิดคนละรูป (เดบิต/เครดิต vs ฝั่ง+อัตราส่วน vs สองบรรทัดคงที่) — เริ่มใหม่
    form.setValue("lines", defaultLinesFor(next), { shouldDirty: true });
    form.setValue("amortize_type", next === "amortize" ? "monthly" : null);
  };

  const onSubmit = (values: JvTemplateFormValues) => {
    const input = toJvTemplateInput(values);
    if (isEdit && template) {
      // doc_version จากใบที่โหลดมา — ใบถูกแก้จากที่อื่นแล้ว backend ตอบ 409 ซึ่ง toast กลาง
      // แปลเป็น "มีคนแก้เอกสารนี้" · ค่าในฟอร์มอยู่ครบเพราะไม่ reset ตอน error
      updateTemplate.mutate(
        { id: template.id, doc_version: template.doc_version, ...input },
        {
          onSuccess: () => {
            toast.success(tt("updateSuccess", { entity: t("entity") }));
            form.reset(values);
            f.setMode("view");
          },
        },
      );
    } else if (isAdd) {
      f.submit(createTemplate, input, (res) => {
        toast.success(tt("createSuccess", { entity: t("entity") }));
        const newId = (res as { id?: string } | undefined)?.id;
        if (newId) {
          navigate(jvTemplateDetailPath(kind, newId), {
            replace: true,
            ...f.returnState,
          });
        } else {
          f.backToList();
        }
      });
    }
  };

  const handleConfirmDelete = () => {
    if (!template) return;
    deleteTemplate.mutate(template.id, {
      onSuccess: () => {
        toast.success(tt("deleteSuccess", { entity: t("entity") }));
        f.backToList();
      },
    });
  };

  const showGenerateButton =
    isView && !!template && template.is_active && canGenerate;

  return (
    <FormPageShell
      width="wide"
      header={
        <FormToolbar
          entity={t("entity")}
          mode={f.mode}
          formId={FORM_ID}
          isPending={isPending}
          title={isAdd ? undefined : watchedName || template?.name}
          onBack={f.handleBack}
          onCancel={f.handleCancel}
          onEdit={f.handleEdit}
          onDelete={template ? () => setShowDelete(true) : undefined}
          deleteIsPending={deleteTemplate.isPending}
          permissionPrefix={PERMISSION_PREFIX}
          badges={
            <>
              {!isAdd && watchedCode && (
                <span className="text-muted-foreground shrink-0 text-sm">
                  · {watchedCode}
                </span>
              )}
              {watchedType && (
                <Badge variant="outline" size="sm" className="shrink-0">
                  {jvTemplateTypeLabel(t, watchedType)}
                </Badge>
              )}
              {!isAdd && <StatusBadge active={watchedActive} />}
            </>
          }
        >
          {showGenerateButton && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowGenerate(true)}
            >
              <Play />
              {t("generate")}
            </Button>
          )}
        </FormToolbar>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={form.handleSubmit(onSubmit, () => scrollToFirstInvalidField())}
      >
        <JvTemplateHeaderFields
          form={form}
          isView={isView}
          isDisabled={isDisabled}
          typeChoices={typeChoices}
          onTypeChange={handleTypeChange}
        />

        {watchedType && (
          <SettingSection
            wide
            title={t("lines")}
            description={t(`linesDesc_${watchedType}`)}
          >
            <JvTemplateLines
              type={watchedType}
              control={form.control}
              readOnly={isDisabled}
            />
          </SettingSection>
        )}
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
            !open && !deleteTemplate.isPending && setShowDelete(false)
          }
          title={t("deleteTitle")}
          description={`${t("deleteConfirm", { code: template.code })} ${t("deleteKeepsJv")}`}
          isPending={deleteTemplate.isPending}
          onConfirm={handleConfirmDelete}
        />
      )}

      {template && canGenerate && template.is_active && (
        <JvTemplateGenerateDialog
          open={showGenerate}
          onOpenChange={setShowGenerate}
          template={template}
        />
      )}
    </FormPageShell>
  );
}
