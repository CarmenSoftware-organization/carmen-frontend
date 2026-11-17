import { useEffect, useRef, useState } from "react";
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
import { FormPageHeaderSkeleton } from "@/components/loader/form-page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { FormToolbar, ToolbarLabel } from "@/components/share/form-toolbar";
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
import { JvTemplateLines, JvTemplateSummary } from "./jv-template-lines";
import { JvTemplateGenerateDialog } from "./jv-template-generate-dialog";

const FORM_ID = "jv-template-form";
const PERMISSION_PREFIX = "accounting.gl.jv_template";

/**
 * หน้ารายละเอียด template (add / view / edit) — `:id` = `new` คือสร้างใหม่
 * ชนิดมาจากหน้าที่เปิด (recurring/allocation ล็อก) หรือ `?type=` · หน้ารวมไม่ระบุชนิด
 * หน้ารวมเริ่มด้วย recurring และเปลี่ยนชนิดได้ตอนสร้าง · ชนิดเปลี่ยนไม่ได้หลังสร้าง
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
  if (isLoading) return <JvTemplateSkeleton />;
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

function JvTemplateSkeleton() {
  return (
    <div
      className="@container/jvt-loading flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 px-4"
      aria-busy="true"
    >
      <FormPageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-3 @md/jvt-loading:grid-cols-2 @3xl/jvt-loading:grid-cols-4 @min-[96rem]/jvt-loading:grid-cols-6">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className={
              i === 1
                ? "space-y-1.5 @3xl/jvt-loading:col-span-2 @min-[96rem]/jvt-loading:col-span-4"
                : "space-y-1.5"
            }
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
      <div className="space-y-3 border-t pt-3">
        <Skeleton className="h-5 w-20" />
        <div className="grid grid-cols-1 gap-3 @md/jvt-loading:grid-cols-2 @3xl/jvt-loading:grid-cols-3 @min-[96rem]/jvt-loading:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 @md/jvt-loading:grid-cols-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-hidden border-t pt-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-10 w-full shrink-0" />
    </div>
  );
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
  const tc = useTranslations("common");
  const tm = useTranslations("modules");
  const pageTitle = tm(
    kind === "all"
      ? "templateVoucher"
      : kind === "recurring"
        ? "recurringVoucher"
        : "allocationVoucher",
  );
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
  const typeChoices = !template && !presetType ? page.creatableTypes : null;

  const createTemplate = useCreateJvTemplate();
  const updateTemplate = useUpdateJvTemplate();
  const deleteTemplate = useDeleteJvTemplate();
  const isPending = createTemplate.isPending || updateTemplate.isPending;
  const [showDelete, setShowDelete] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  const defaultValues = getJvTemplateDefaultValues(
    template,
    presetType || page.creatableTypes[0],
  );
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

  // doc_version ที่ผู้ใช้เริ่มแก้ — จับไว้ตอนกด Edit ไม่อ่านจาก prop ตอน save เพราะ refetch
  // ระหว่างแก้ (focus/invalidate) จะยื่นเวอร์ชันใหม่ให้เงียบ ๆ แล้วเขียนทับงานของคนอื่นได้
  const editVersionRef = useRef<number | null>(null);
  const handleEdit = () => {
    editVersionRef.current = template?.doc_version ?? null;
    f.handleEdit();
  };

  // หลัง save สำเร็จ detail ถูก refetch — doc_version ใหม่มาที่ prop · โหมดดูต้องตามค่าจาก
  // server ไม่งั้น Edit รอบถัดไปเริ่มจากค่าที่ normalize ไม่ตรงกับที่ backend เก็บ
  useEffect(() => {
    if (f.mode === "view" && template) {
      form.reset(getJvTemplateDefaultValues(template, template.template_type));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- รีเซ็ตเมื่อเวอร์ชันเปลี่ยนเท่านั้น
  }, [template?.doc_version]);

  const watchedType = useWatch({
    control: form.control,
    name: "template_type",
  });
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
        {
          id: template.id,
          doc_version: editVersionRef.current ?? template.doc_version,
          ...input,
        },
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
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 px-4">
      <FormToolbar
        entity={t("entity")}
        mode={f.mode}
        formId={FORM_ID}
        isPending={isPending}
        title={isAdd ? pageTitle : watchedCode || template?.code || pageTitle}
        subtitle={isAdd ? undefined : watchedName || template?.name}
        submitLabel={tc("save")}
        onBack={f.handleBack}
        onCancel={f.handleCancel}
        onEdit={handleEdit}
        onDelete={template ? () => setShowDelete(true) : undefined}
        deleteIsPending={deleteTemplate.isPending}
        permissionPrefix={PERMISSION_PREFIX}
        badges={
          <>
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
            title={t("generate")}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowGenerate(true)}
          >
            <Play />
            <ToolbarLabel>{t("generate")}</ToolbarLabel>
          </Button>
        )}
      </FormToolbar>
      <form
        id={FORM_ID}
        className="flex min-h-0 flex-1 flex-col gap-3"
        noValidate
        onSubmit={form.handleSubmit(onSubmit, () =>
          scrollToFirstInvalidField(),
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
          <div className="shrink-0">
            <JvTemplateHeaderFields
              form={form}
              isView={isView}
              isDisabled={isDisabled}
              typeChoices={typeChoices}
              onTypeChange={handleTypeChange}
            />
          </div>

          {watchedType && (
            <JvTemplateLines
              type={watchedType}
              control={form.control}
              readOnly={isDisabled}
            />
          )}
        </div>
        {watchedType && (
          <JvTemplateSummary type={watchedType} control={form.control} />
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
    </div>
  );
}
