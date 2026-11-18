import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { useListReturn } from "@/hooks/use-list-return";
import { useTranslations } from "use-intl";
import {
  buildItemChanges,
  scrollToFirstInvalidField,
} from "@/lib/form-helpers";
import { FormToolbar } from "@/components/share/form-toolbar";
import { FormPageShell } from "@/components/share/form-page-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { DocAuditButton } from "@/components/share/doc-audit-line";
import { DOC_HEADER_CARD } from "@/components/loader/doc-page-skeleton";
import { toast } from "sonner";
import { useCreatePrt, useUpdatePrt, useDeletePrt } from "./use-prt";
import type {
  PurchaseRequestTemplate,
  CreatePrtDto,
} from "@/types/purchase-request";
import type { FormMode } from "@/types/form";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useDiscardConfirm } from "@/hooks/use-discard-confirm";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { PrtGeneralFields } from "./prt-general-fields";
import { PrtItemFields } from "./prt-item-fields";
import {
  createPrtSchema,
  type PrtFormValues,
  getDefaultValues,
  mapItemToPayload,
} from "./prt-form-schema";
import { useProfile } from "@/hooks/use-profile";

interface PrtFormProps {
  readonly template?: PurchaseRequestTemplate;
}

export function PrtForm({ template }: PrtFormProps) {
  const t = useTranslations("procurement.purchaseRequestTemplate");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");
  const tfl = useTranslations("field");
  const { defaultBu } = useProfile();
  const navigate = useNavigate();
  const { toList, returnState } = useListReturn(
    "/procurement/purchase-request-template",
  );
  const [mode, setMode] = useState<FormMode>(template ? "view" : "add");
  const isView = mode === "view";
  const isEdit = mode === "edit";
  const isAdd = mode === "add";

  const createPrt = useCreatePrt();
  const updatePrt = useUpdatePrt();
  const deletePrt = useDeletePrt();
  const [showDelete, setShowDelete] = useState(false);
  const isPending = createPrt.isPending || updatePrt.isPending;

  const defaultValues = getDefaultValues(template);

  const prtSchema = createPrtSchema(tv, tfl);
  const form = useForm<PrtFormValues>({
    resolver: zodResolver(prtSchema) as Resolver<PrtFormValues>,
    defaultValues,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  // หลังบันทึก ข้อมูลสดไหลกลับมาทาง prop (mutation invalidate แล้ว query refetch)
  // ต้อง rebase เข้าฟอร์มด้วย ไม่งั้นฟอร์มยังถือ doc_version ราย row ของรอบก่อน
  // แล้วการบันทึกรอบถัดไปชน 400 "doc_version: expected number, received undefined"
  // / 409 · เงื่อนไขคือ "ไม่มีของค้าง" ไม่ใช่ "โหมดอ่าน" — ระหว่างผู้ใช้กรอกค้าง
  // ห้ามทับ แต่หลังบันทึกเสร็จ (dirty ถูกล้าง) ต้อง rebase ให้ได้ (ทรงเดียวกับ GRN)
  useEffect(() => {
    if (!template || form.formState.isDirty) return;
    form.reset(getDefaultValues(template));
  }, [template, form]);

  const discard = useDiscardConfirm({
    isDirty: form.formState.isDirty,
    isPending,
  });

  // ระหว่าง submit ตอน create ปิด guard — ไม่งั้น sentinel ที่ guard ดันไว้ที่ /new
  // ทำให้ navigate(replace) หลัง create ไม่กิน /new จริง → URL ค้างที่ /new
  const [isSubmitting, setIsSubmitting] = useState(false);

  // in-app navigation guard: เตือนก่อนออกเมื่อ add/edit และฟอร์มถูกแก้ไข
  const navGuard = useNavigationGuard(
    (isAdd || isEdit) && form.formState.isDirty && !isSubmitting,
  );

  const onSubmit = (values: PrtFormValues) => {
    const changes = buildItemChanges(
      values.items,
      defaultValues.items,
      mapItemToPayload,
    );
    // หลังบ้าน PR template รับบรรทัดที่ลบในชื่อ `delete` (ดู CreatePrtDto)
    const purchase_request_template_detail = {
      add: changes.add,
      update: changes.update,
      delete: changes.remove,
    };

    const payload: CreatePrtDto = {
      name: values.name,
      description: values.description,
      workflow_id: values.workflow_id,
      is_active: values.is_active,
      purchase_request_template_detail,
    };

    if (isEdit && template) {
      updatePrt.mutate(
        { id: template.id, doc_version: template.doc_version, ...payload },
        {
          onSuccess: () => {
            toast.success(tt("updateSuccess", { entity: t("entity") }));
            setMode("view");
            // ล้าง dirty ให้ baseline = ค่าที่เพิ่งบันทึก — ต้องทำ ไม่งั้น effect
            // ที่ rebase จากข้อมูลสด (ข้างบน) ไม่ยอมทำงานเพราะยังเห็นว่ามีของค้าง
            // แล้ว doc_version ราย row ก็ค้างเป็นเลขรอบก่อนตลอด
            form.reset(form.getValues());
          },
        },
      );
    } else if (isAdd) {
      // ปิด guard ก่อนยิง mutation → sentinel ถูก teardown ลบระหว่างรอ network →
      // navigate(replace) กิน /new จริง → URL เป็น /:id และ back = list
      setIsSubmitting(true);
      createPrt.mutate(payload, {
        onSuccess: (data) => {
          toast.success(tt("createSuccess", { entity: t("entity") }));
          navigate(`/procurement/purchase-request-template/${data.data.id}`, {
            replace: true,
            ...returnState,
          });
          setMode("view");
        },
        onError: () => setIsSubmitting(false),
      });
    }
  };

  const handleCancel = () => {
    discard.confirm(() => {
      if (isEdit && template) {
        form.reset(defaultValues);
        setMode("view");
      } else {
        toList();
      }
    });
  };

  // Back = กลับหน้า list เสมอ ไม่ใช่ history back — history คือเส้นทางที่เดินผ่านมา
  // ไม่ใช่ที่ที่อยากกลับไป กดครั้งเดียวต้องถึง list ไม่ใช่ถอยทีละหน้า
  const goBack = () => {
    toList();
  };

  const handleBack = () => {
    if (isEdit || isAdd) {
      discard.confirm(() => goBack());
    } else {
      goBack();
    }
  };

  return (
    <FormPageShell
      width="wide"
      header={
        // หัวเอกสารเป็นการ์ดเดียวกับ PR: ชื่อ + สถานะ + ปุ่ม แล้วช่องข้อมูลหัวใบเป็น ribbon
        // (ไม่มีการ์ด General แยกอีกใบ) · โครงตอนโหลดอยู่ใน prt-form-skeleton.tsx
        <div className={DOC_HEADER_CARD}>
          <FormToolbar
            inlineBack
            entity={template?.name || t("entity")}
            badges={
              template && (
                // กลุ่มสถานะแยกจากชื่อด้วยเส้นคั่น ทรงเดียวกับ pr-header · หัวแคบเอาเส้นออก
                <div className="border-border/60 ms-1 flex items-center gap-2 border-s ps-3 @max-md/doc-header:ms-0 @max-md/doc-header:border-s-0 @max-md/doc-header:ps-0">
                  <StatusBadge active={template.is_active} size="xs" />
                </div>
              )
            }
            subtitle={
              // มือถือ: ตาราง audit ใน ribbon ซ่อนอยู่ เหลือไอคอนให้กดดู (เหมือน PR)
              isView && template?.audit ? (
                <DocAuditButton
                  audit={template.audit}
                  docVersion={template.doc_version}
                  className="-my-1 self-start sm:hidden"
                />
              ) : undefined
            }
            ribbon={
              <PrtGeneralFields
                form={form}
                readOnly={isView}
                disabled={isPending}
                workflowName={template?.workflow?.name ?? undefined}
                isAdd={isAdd}
                audit={template?.audit}
                docVersion={template?.doc_version}
              />
            }
            mode={mode}
            formId="prt-form"
            isPending={isPending}
            onBack={handleBack}
            onEdit={() => setMode("edit")}
            onCancel={handleCancel}
            onDelete={template ? () => setShowDelete(true) : undefined}
            deleteIsPending={deletePrt.isPending}
            activity={template && { id: template.id, label: template.name }}
          />
        </div>
      }
    >
      <form
        id="prt-form"
        onSubmit={form.handleSubmit(onSubmit, () =>
          scrollToFirstInvalidField(),
        )}
      >
        <PrtItemFields
          form={form}
          readOnly={isView}
          disabled={isPending}
          defaultBu={defaultBu}
        />
      </form>

      <DiscardDialog {...discard.dialogProps} variant="warning" />

      <DiscardDialog
        open={navGuard.isOpen}
        onOpenChange={(o) => {
          if (!o) navGuard.cancel();
        }}
        onConfirm={navGuard.confirm}
        onCancel={navGuard.cancel}
        variant="warning"
      />

      {template && (
        <DeleteDialog
          open={showDelete}
          onOpenChange={(open) =>
            !open && !deletePrt.isPending && setShowDelete(false)
          }
          title={t("deleteTitle")}
          description={t("deleteConfirm", { name: template.name })}
          isPending={deletePrt.isPending}
          onConfirm={() => {
            deletePrt.mutate(template.id, {
              onSuccess: () => {
                toast.success(tt("deleteSuccess", { entity: t("entity") }));
                toList();
              },
            });
          }}
        />
      )}
    </FormPageShell>
  );
}
