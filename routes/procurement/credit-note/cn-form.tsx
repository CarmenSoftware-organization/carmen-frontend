import { lazy, Suspense, useEffect, useState } from "react";
import { useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { useListReturn } from "@/hooks/use-list-return";
import { useTranslations } from "use-intl";
import {
  buildItemChanges,
  countInvalidItems,
  scrollToFirstInvalidField,
  draftSaveHandler,
} from "@/lib/form-helpers";
import { toast } from "sonner";
import {
  useCreateCreditNote,
  useUpdateCreditNote,
  useDeleteCreditNote,
  useSubmitCreditNote,
  cnCommentCrud,
} from "./use-credit-note";
import {
  CN_STATUS,
  type CreditNoteDetail,
  type CreateCnDto,
} from "@/types/credit-note";
import type { FormMode } from "@/types/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useDiscardConfirm } from "@/hooks/use-discard-confirm";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { useProfile } from "@/hooks/use-profile";
import { useBuCode } from "@/hooks/use-bu-code";
import { httpClient } from "@/lib/http-client";
import { pickDocVersion, withFreshDetailVersions } from "@/lib/doc-version";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { FormPageShell } from "@/components/share/form-page-shell";
import { CnHeader } from "./cn-header";
import { CnGeneralFields } from "./cn-general-fields";
import { CnItem } from "./cn-item";
import { CnStockTable } from "./cn-stock-table";
import { CnFooterAction } from "./cn-footer-action";
import {
  createCnSchema,
  type CnFormValues,
  getDefaultValues,
  keepGrnRefs,
  mapItemToPayload,
} from "./cn-form-schema";

const EntityCommentSheet = lazy(() =>
  import("@/components/share/entity-comment-sheet").then((mod) => ({
    default: mod.EntityCommentSheet,
  })),
);

interface CnFormProps {
  readonly creditNote?: CreditNoteDetail;
}

export function CnForm({ creditNote }: CnFormProps) {
  const t = useTranslations("procurement.creditNote");
  const tc = useTranslations("common");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");
  const tfl = useTranslations("field");
  const navigate = useNavigate();
  const { toList, returnState } = useListReturn("/procurement/credit-note");
  const buCode = useBuCode();
  const [mode, setMode] = useState<FormMode>(creditNote ? "view" : "add");
  const isView = mode === "view";
  const isEdit = mode === "edit";
  const isAdd = mode === "add";

  const createCn = useCreateCreditNote();
  const updateCn = useUpdateCreditNote();
  const deleteCn = useDeleteCreditNote();
  const submitCn = useSubmitCreditNote();
  const [showDelete, setShowDelete] = useState(false);
  const [tab, setTab] = useState("items");
  const [showSubmit, setShowSubmit] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const isPending =
    createCn.isPending || updateCn.isPending || submitCn.isPending;
  const isDisabled = isView || isPending;

  const defaultValues = getDefaultValues(creditNote);

  const cnSchema = createCnSchema(tv, tfl);
  const form = useForm<CnFormValues>({
    resolver: zodResolver(cnSchema) as Resolver<CnFormValues>,
    defaultValues,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const discard = useDiscardConfirm({
    isDirty: form.formState.isDirty,
    isPending,
  });

  // ระหว่าง submit ตอน create ปิด guard — ไม่งั้น sentinel ที่ guard ดันไว้ที่ /new
  // ทำให้ navigate(replace) หลัง create ไม่กิน /new จริง → back เด้งกลับ /new
  const [isSubmitting, setIsSubmitting] = useState(false);

  // guard เฉพาะโหมด add/edit และฟอร์มมีการแก้ไข
  const navGuard = useNavigationGuard(
    (isAdd || isEdit) && form.formState.isDirty && !isSubmitting,
  );

  const cnSyncKey = [
    creditNote?.doc_version ?? "",
    ...(creditNote?.credit_note_detail ?? []).map(
      (d) => `${d.id}:${d.doc_version}`,
    ),
  ].join("|");
  useEffect(() => {
    if (mode === "view" && creditNote) {
      form.reset(
        keepGrnRefs(getDefaultValues(creditNote), form.getValues("items")),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form/getDefaultValues stable; mode read intentionally without retriggering
  }, [cnSyncKey, creditNote?.id]);

  const buildPayload = (
    values: CnFormValues,
    docVersion?: number,
    freshDetails?: readonly { id: string; doc_version?: number }[],
  ): CreateCnDto => {
    const detail = buildItemChanges(
      values.items,
      defaultValues.items,
      mapItemToPayload,
    );
    // ทับหลัง buildItemChanges เสมอ — ดันเข้า input จะทำให้ทุกแถวกลายเป็น update
    detail.update = withFreshDetailVersions(detail.update, freshDetails);
    return {
      ...((docVersion ?? values.doc_version) != null
        ? { doc_version: docVersion ?? values.doc_version }
        : {}),
      credit_note_type: values.credit_note_type,
      grn_id: values.grn_id,
      grn_date: values.grn_date,
      vendor_id: values.vendor_id,
      // ใบใหม่ยังไม่มีเลขที่ — backend ออกให้ตอน create สำเร็จ ส่ง "" ไปไม่ได้
      ...(values.cn_no ? { credit_note_number: values.cn_no } : {}),
      cn_date: values.cn_date,
      cn_reason_id: values.reason,
      reference_number: values.reference_number,
      description: values.description,
      currency_id: values.currency_code,
      exchange_rate: values.exchange_rate,
      // omit ตอนว่าง — backend ไม่รับ "" (invoice_date เป็น ISO-8601 datetime)
      ...(values.invoice_no ? { invoice_no: values.invoice_no } : {}),
      ...(values.invoice_date ? { invoice_date: values.invoice_date } : {}),
      tax_invoice_no: values.tax_invoice_no,
      tax_invoice_date: values.tax_invoice_date,
      tax_amount: values.tax_amount,
      discount_amount: values.discount_amount,
      note: values.notes,
      // หลังบ้าน CN รับบรรทัดที่ลบในชื่อ `delete` (ดู CreateCnDto)
      credit_note_detail: {
        add: detail.add,
        update: detail.update,
        delete: detail.remove,
      },
    };
  };

  const onSubmit = async (values: CnFormValues) => {
    if (isEdit && creditNote) {
      const fresh = await fetchFreshCn(creditNote.id);
      updateCn.mutate(
        {
          id: creditNote.id,
          ...buildPayload(
            values,
            pickDocVersion(
              fresh?.doc_version,
              values.doc_version,
              creditNote.doc_version,
            ),
            fresh?.credit_note_detail,
          ),
        },
        {
          onSuccess: () => {
            toast.success(tt("updateSuccess", { entity: t("entity") }));
            setMode("view");
          },
        },
      );
    } else if (isAdd) {
      // ปิด guard ก่อนยิง mutation → sentinel ถูก teardown ลบระหว่างรอ network →
      // navigate(replace) กิน /new จริง → stack เหลือ [list, /:id] → back = list
      setIsSubmitting(true);
      // ใบใหม่ยังไม่มี id ให้ GET — doc_version ในฟอร์มเป็น undefined อยู่แล้ว
      createCn.mutate(buildPayload(values), {
        onSuccess: (data) => {
          toast.success(tt("createSuccess", { entity: t("entity") }));
          const newId = data?.data?.id;
          if (newId) {
            // ไม่ setMode("view") — route /:id mount CnForm view mode เอง (เลี่ยง churn)
            navigate(`/procurement/credit-note/${newId}`, {
              replace: true,
              ...returnState,
            });
          } else {
            toList();
          }
        },
        onError: () => setIsSubmitting(false),
      });
    }
  };

  const handleCancel = () => {
    discard.confirm(() => {
      if (isEdit && creditNote) {
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
      discard.confirm(goBack);
    } else {
      goBack();
    }
  };

  const isLocked =
    creditNote?.doc_status === CN_STATUS.COMPLETED ||
    creditNote?.doc_status === CN_STATUS.CANCELLED ||
    creditNote?.doc_status === CN_STATUS.VOIDED;

  // ชื่อผู้สร้างใต้เลขที่ใบ — แสดงอย่างเดียว ไม่เข้า payload · วันที่ย้ายไปเป็น
  // ช่องกรอกในฟอร์มแล้ว (cn_date) หัวใบจึงไม่ต้องโชว์ซ้ำ
  const { data: profileData, avatarUrl } = useProfile();
  const createdByName = creditNote
    ? (creditNote.audit?.created?.name ?? "")
    : [profileData?.user_info?.firstname, profileData?.user_info?.lastname]
        .filter(Boolean)
        .join(" ");

  // กรอกไม่ครบ → พาไปยังช่องแรกที่ขาดแล้วบอกว่าขาดกี่รายการ (ใช้ทั้งปุ่ม Save
  // และปุ่ม Submit — ปุ่มที่กดแล้วเงียบคือทางตัน)
  const revealInvalid = (errors: FieldErrors<CnFormValues>) => {
    scrollToFirstInvalidField();
    const count = countInvalidItems(errors as Record<string, unknown>);
    toast.warning(
      count > 0 ? tv("incompleteItems", { count }) : tv("incompleteDocument"),
    );
  };

  // ปิด dialog ให้ด้วยตอนพัง ไม่งั้นค้างทับ toast แจ้ง error ที่เพิ่งขึ้น
  const abortSubmit = () => {
    setShowSubmit(false);
    setIsSubmitting(false);
  };

  // GET ใบสดจาก DB ก่อนยิง submit — doc_version ที่ถืออยู่ค้างเก่าทันทีที่ save
  // ผ่าน (backend bump ให้) ส่งของเก่าไป = ชน 409 optimistic lock (แบบเดียวกับ PR/PO)
  type FreshCn = {
    doc_version?: number;
    credit_note_detail?: { id: string; doc_version?: number }[];
  };

  // คืนทั้งก้อน ไม่ใช่แค่เลขหัวเอกสาร — lock ของ backend เช็ค tb_credit_note_detail
  // แยกอีกชั้น ส่งเลขราย row เก่าไปก็ 409 เหมือนกัน
  const fetchFreshCn = async (id: string): Promise<FreshCn | null> => {
    if (!buCode) return null;
    try {
      const res = await httpClient.get(
        `${API_ENDPOINTS.CREDIT_NOTE(buCode)}/${id}`,
      );
      if (res.ok) {
        const fresh = ((await res.json())?.data ?? null) as FreshCn | null;
        if (import.meta.env.DEV && fresh?.doc_version == null) {
          console.warn(
            "[CN] GET คืน 200 แต่ไม่มี doc_version — ใช้ค่าในฟอร์มแทน",
            id,
          );
        }
        return fresh;
      }
      if (import.meta.env.DEV)
        console.warn("[CN] ดึง doc_version สดไม่สำเร็จ", res.status, id);
    } catch (err) {
      // ยังคืน null (ไม่ throw) เพราะ GET ล้มไม่ควรทำให้บันทึกไม่ได้เลย — แต่ต้องไม่เงียบ
      if (import.meta.env.DEV)
        console.warn("[CN] ดึง doc_version สดไม่สำเร็จ", err);
    }
    return null;
  };

  const fireSubmit = (id: string, docVersion: number) => {
    submitCn.mutate(
      { id, doc_version: docVersion },
      {
        onSuccess: () => {
          toast.success(tt("submitSuccess", { entity: t("entity") }));
          toList();
        },
        onError: abortSubmit,
      },
    );
  };

  /**
   * ส่งใบ = เซฟก่อนแล้วค่อยส่ง (เหมือน PR) — คนกดส่งทั้งที่ยังแก้ค้างอยู่ไม่ได้
   * แปลว่าอยากทิ้งสิ่งที่แก้ ถ้าส่งใบเวอร์ชันเก่าไปเงียบ ๆ คือกินข้อมูลเขาหาย
   * ใบที่ยังไม่เคยเซฟ (add) ก็สร้างแล้วส่งต่อในคลิกเดียว
   */
  const saveThenSubmit = async (values: CnFormValues) => {
    // ปิด guard ก่อนยิง mutation ไม่ใช่ตอนสำเร็จ — ฟอร์มที่แก้ค้างอยู่จะทำให้
    // navigate ตอนสำเร็จไปโผล่ dialog ถามว่าจะทิ้งการแก้ไขไหม ทั้งที่ส่งไปแล้ว
    setIsSubmitting(true);

    if (!creditNote) {
      createCn.mutate(buildPayload(values), {
        onSuccess: async (data) => {
          const newId = data?.data?.id;
          if (!newId) return abortSubmit();
          fireSubmit(newId, (await fetchFreshCn(newId))?.doc_version ?? 0);
        },
        onError: abortSubmit,
      });
      return;
    }

    if (!form.formState.isDirty) {
      fireSubmit(creditNote.id, creditNote.doc_version ?? 0);
      return;
    }

    // GET สด **ก่อน** /save ไม่ใช่หลัง — ของเดิมไปเอาเลขใน onSuccess เพื่อส่งต่อให้
    // submit เท่านั้น ตัว /save เองยังส่งเลขจากฟอร์ม ถ้าเลขนั้นค้างเก่าก็ชน 409
    // ตั้งแต่บันทึก แล้วบรรทัดที่ไป GET ไม่มีโอกาสได้ทำงานเลย
    const beforeSave = await fetchFreshCn(creditNote.id);
    updateCn.mutate(
      {
        id: creditNote.id,
        ...buildPayload(
          values,
          pickDocVersion(
            beforeSave?.doc_version,
            values.doc_version,
            creditNote.doc_version,
          ),
          beforeSave?.credit_note_detail,
        ),
      },
      {
        onSuccess: async () => {
          const fresh = await fetchFreshCn(creditNote.id);
          fireSubmit(
            creditNote.id,
            pickDocVersion(
              fresh?.doc_version,
              undefined,
              creditNote.doc_version,
            ),
          );
        },
        onError: abortSubmit,
      },
    );
  };

  const handleSubmitCn = () => {
    form.handleSubmit(saveThenSubmit, (errors) => {
      abortSubmit();
      revealInvalid(errors);
    })();
  };

  return (
    <FormPageShell
      width="wide"
      header={
        <CnHeader
          creditNote={creditNote}
          mode={mode}
          isPending={isPending}
          deleteIsPending={deleteCn.isPending}
          isLocked={isLocked}
          createdByName={createdByName}
          createdByAvatar={
            creditNote ? creditNote.audit?.created?.avatar : avatarUrl
          }
          onBack={handleBack}
          onEnterEdit={() => setMode("edit")}
          onCancel={handleCancel}
          onShowDelete={() => setShowDelete(true)}
          onShowComment={() => setShowComment(true)}
        />
      }
      footer={
        <CnFooterAction
          control={form.control}
          canSubmit={
            isAdd || (!isLocked && creditNote?.doc_status === CN_STATUS.DRAFT)
          }
          isPending={isPending}
          onSubmitCn={() => setShowSubmit(true)}
        />
      }
    >
      <form
        id="cn-form"
        onSubmit={draftSaveHandler(form, onSubmit)}
        className="space-y-3"
      >
        <CnGeneralFields
          form={form}
          disabled={isDisabled || isView}
          vendorName={creditNote?.vendor?.name ?? undefined}
          savedGrn={creditNote?.grn}
        />
        <hr className="border-border" />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line">
            <TabsTrigger value="items">{t("tabItems")}</TabsTrigger>
            <TabsTrigger value="stock">{t("tabStock")}</TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            <CnItem form={form} disabled={isDisabled} />
          </TabsContent>

          <TabsContent value="stock">
            <CnStockTable
              cnId={creditNote?.id}
              docStatus={creditNote?.doc_status}
            />
          </TabsContent>
        </Tabs>
      </form>

      {/* ส่งใบแล้วย้อนไม่ได้ — ถามก่อนหนึ่งครั้ง เหมือน PR/PO/SR */}
      <ConfirmDialog
        open={showSubmit}
        onOpenChange={setShowSubmit}
        title={t("submitTitle")}
        description={t("submitConfirm")}
        confirmText={tc("submit")}
        isPending={submitCn.isPending}
        onConfirm={handleSubmitCn}
      />

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

      {creditNote && (
        <>
          <DeleteDialog
            open={showDelete}
            onOpenChange={(open) =>
              !open && !deleteCn.isPending && setShowDelete(false)
            }
            title={t("deleteTitle")}
            description={t("deleteConfirm", { cnNo: creditNote.cn_no })}
            isPending={deleteCn.isPending}
            onConfirm={() => {
              deleteCn.mutate(creditNote.id, {
                onSuccess: () => {
                  toast.success(tt("deleteSuccess", { entity: t("entity") }));
                  toList();
                },
              });
            }}
          />
          <Suspense fallback={null}>
            <EntityCommentSheet
              crud={cnCommentCrud}
              entityId={creditNote.id}
              open={showComment}
              onOpenChange={setShowComment}
            />
          </Suspense>
        </>
      )}
    </FormPageShell>
  );
}
