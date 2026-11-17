import { useState } from "react";
import { useNavigate } from "react-router";
import { useListReturn } from "@/hooks/use-list-return";
import { useTranslations } from "use-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { FieldErrors, UseFormReturn } from "react-hook-form";
import {
  buildItemChanges,
  countInvalidItems,
  scrollToFirstInvalidField,
} from "@/lib/form-helpers";
import { useDiscardConfirm } from "@/hooks/use-discard-confirm";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { useBuCode } from "@/hooks/use-bu-code";
import { useProfile } from "@/hooks/use-profile";
import { isOutsideOpenPeriod } from "@/lib/date-utils";
import { httpClient } from "@/lib/http-client";
import { ApiError } from "@/lib/api-error";
import { reportApiError } from "@/lib/api-error-handler";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { SR_LIST_PATH } from "@/constant/store-requisition";
import {
  useCreateStoreRequisition,
  useUpdateStoreRequisition,
  useSubmitStoreRequisition,
  useApproveStoreRequisition,
  useIssueStoreRequisition,
  useRejectStoreRequisition,
  useReviewStoreRequisition,
  useDeleteStoreRequisition,
  type SrActionPayload,
  type SrDatePattern,
  type SrStageDetail,
} from "./use-sr";
import type {
  StoreRequisition,
  CreateStoreRequisitionDto,
} from "@/types/store-requisition";
import type { FormMode } from "@/types/form";
import { STAGE_ROLE } from "@/types/stage-role";
import type { SrFormValues } from "./sr-form-schema";
import { useLineDimensionsEnabled } from "@/hooks/use-line-dimensions-enabled";
import { clearDimensionsDirty } from "@/lib/dimension-payload";
import { mapSrItemToPayload } from "./sr-form-helpers";

export type SrActionDialogType =
  "approve" | "issue" | "reject" | "review" | null;

type SrDatePatternField = "sr_date_pattern" | "issue_date_pattern";

/**
 * 422 สองตัวนี้ไม่ใช่ความผิดพลาด — backend กำลังถามว่าจะลงวันที่ไหน เพราะวันนี้
 * อยู่นอกงวดบัญชีที่เปิดอยู่ทุกงวด ตอบกลับไปด้วยฟิลด์ที่คู่กันแล้วยิงซ้ำได้เลย
 */
const DATE_PATTERN_FIELD: Record<string, SrDatePatternField> = {
  SR_DATE_PATTERN_REQUIRED: "sr_date_pattern",
  SR_ISSUE_DATE_PATTERN_REQUIRED: "issue_date_pattern",
};

const datePatternField = (err: unknown): SrDatePatternField | undefined =>
  err instanceof ApiError && err.appCode
    ? DATE_PATTERN_FIELD[err.appCode]
    : undefined;

type PendingDatePattern = {
  field: SrDatePatternField;
  retry: (pattern: SrDatePattern) => void;
};

interface UseSrFormActionsParams {
  form: UseFormReturn<SrFormValues>;
  storeRequisition?: StoreRequisition;
  defaultValues: SrFormValues;
  mode: FormMode;
  setMode: (mode: FormMode) => void;
}

export function useSrFormActions({
  form,
  storeRequisition,
  defaultValues,
  mode,
  setMode,
}: UseSrFormActionsParams) {
  const t = useTranslations("storeOperation.storeRequisition");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");
  const navigate = useNavigate();
  const { toList, returnState } = useListReturn(SR_LIST_PATH);

  const goList = () => {
    toList();
  };
  const queryClient = useQueryClient();

  const isEdit = mode === "edit";
  const isAdd = mode === "add";

  // dialog state
  const [showDelete, setShowDelete] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [actionDialog, setActionDialog] = useState<SrActionDialogType>(null);
  const [datePattern, setDatePattern] = useState<PendingDatePattern | null>(
    null,
  );
  // คำตอบเรื่องวันที่ที่ถามในกล่องส่งใบ — ใช้เฉพาะตอนวันนี้อยู่นอกงวด active
  const [submitDatePattern, setSubmitDatePattern] =
    useState<SrDatePattern | null>(null);

  // mutations
  const createSr = useCreateStoreRequisition();
  const updateSr = useUpdateStoreRequisition();
  const submitSr = useSubmitStoreRequisition();
  const approveSr = useApproveStoreRequisition();
  const issueSr = useIssueStoreRequisition();
  const rejectSr = useRejectStoreRequisition();
  const reviewSr = useReviewStoreRequisition();
  const deleteSr = useDeleteStoreRequisition();

  const isPending =
    createSr.isPending ||
    updateSr.isPending ||
    submitSr.isPending ||
    approveSr.isPending ||
    issueSr.isPending ||
    rejectSr.isPending ||
    reviewSr.isPending;

  const isWorkflowActionPending =
    submitSr.isPending ||
    approveSr.isPending ||
    issueSr.isPending ||
    rejectSr.isPending ||
    reviewSr.isPending;

  const discard = useDiscardConfirm({
    isDirty: form.formState.isDirty,
    isPending,
  });

  // ระหว่าง submit ตอน create ปิด guard — ไม่งั้น sentinel ที่ guard ดันไว้ที่ /new
  // ทำให้ navigate(replace) หลัง create ไม่กิน /new จริง → back เด้งกลับ /new
  const [isSubmitting, setIsSubmitting] = useState(false);

  // guard เฉพาะตอน add/edit และมีการกรอกค้าง (dirty) — view/ยังไม่กรอก = ผ่านได้เลย
  // ครอบคลุมคลิกลิงก์ในแอป + กด browser back (ปุ่ม Back/Cancel ใช้ discard เอง)
  const navGuard = useNavigationGuard(
    (isAdd || isEdit) && form.formState.isDirty && !isSubmitting,
  );
  const navDiscardDialogProps = {
    open: navGuard.isOpen,
    onOpenChange: (o: boolean) => {
      if (!o) navGuard.cancel();
    },
    onConfirm: navGuard.confirm,
    onCancel: navGuard.cancel,
  };

  const currentRole = storeRequisition?.role ?? STAGE_ROLE.CREATE;
  const buCode = useBuCode();
  const dimensionsEnabled = useLineDimensionsEnabled();
  const { currentPeriod } = useProfile();
  // ส่งใบแล้ว backend ลงวันนี้ ถ้าวันนี้อยู่นอกงวด active (งวดที่ profile ส่งมา) มันจะตีกลับ
  // SR_DATE_PATTERN_REQUIRED แน่ ๆ — รู้ล่วงหน้าได้ จึงถามในกล่องส่งใบเลย
  const submitDatePatternPeriod = isOutsideOpenPeriod(
    new Date().toISOString(),
    currentPeriod,
  )
    ? currentPeriod
    : undefined;

  // GET SR สดจาก DB ก่อนยิง save/workflow event — กัน 409 optimistic lock จาก
  // doc_version ที่ค้างเก่าใน prop หลัง bump (แบบเดียวกับ PO)
  const fetchSrById = async (id: string): Promise<StoreRequisition | null> => {
    if (!buCode) return null;
    try {
      const res = await httpClient.get(
        `${API_ENDPOINTS.STORE_REQUISITION(buCode)}/${id}`,
      );
      if (res.ok) return (await res.json())?.data ?? null;
    } catch {
      // network/parse fail — fallback prop
    }
    return null;
  };

  const fetchFreshSr = async (): Promise<{ doc_version?: number } | null> =>
    storeRequisition ? fetchSrById(storeRequisition.id) : null;

  const resolveDocVersion = (fresh: { doc_version?: number } | null): number =>
    fresh?.doc_version ?? storeRequisition?.doc_version ?? 0;

  const buildSaveDetails = (
    values: SrFormValues,
    fresh: { doc_version?: number } | null,
  ): CreateStoreRequisitionDto["details"] => ({
    sr_date: values.sr_date,
    expected_date: values.expected_date,
    description: values.description,
    requestor_id: values.requestor_id,
    workflow_id: values.workflow_id,
    department_id: values.department_id,
    from_location_id: values.from_location_id,
    to_location_id: values.to_location_id,
    doc_version: resolveDocVersion(fresh),
    store_requisition_detail: buildItemChanges(
      values.items,
      defaultValues.items,
      (i) => mapSrItemToPayload(i, { dimensionsEnabled }),
    ),
  });

  const onSubmit = async (values: SrFormValues) => {
    const fresh = isEdit && storeRequisition ? await fetchFreshSr() : null;
    const details = buildSaveDetails(values, fresh);

    if (isEdit && storeRequisition) {
      updateSr.mutate(
        { id: storeRequisition.id, stage_role: "create", details },
        {
          onSuccess: () => {
            toast.success(tt("updateSuccess", { entity: t("entity") }));
            form.reset(clearDimensionsDirty(values));
            queryClient.invalidateQueries({
              queryKey: [QUERY_KEYS.STORE_REQUISITIONS],
            });
            setMode("view");
          },
        },
      );
    } else if (isAdd) {
      // ปิด guard ก่อนยิง mutation → sentinel ถูก teardown ลบระหว่างรอ network →
      // navigate(replace) กิน /new จริง → stack เหลือ [list, /:id] → back = list
      setIsSubmitting(true);
      createSr.mutate(
        { stage_role: "create", details },
        {
          onSuccess: (res) => {
            const { id } = (res as { data: { id: string } }).data;
            toast.success(tt("createSuccess", { entity: t("entity") }));
            // ไม่ setMode("view") — route /:id mount SrForm view mode เอง (เลี่ยง churn)
            navigate(`${SR_LIST_PATH}/${id}`, {
              replace: true,
              ...returnState,
            });
          },
          onError: () => setIsSubmitting(false),
        },
      );
    }
  };

  /**
   * ยิง workflow action แล้วรับ error เอง (mutation ปิด toast กลางไว้ — ดู `useSrAction`)
   *
   * รหัสที่ขอให้เลือกวันที่จะเปิด dialog แทน toast แล้ว `retry` ยิงซ้ำด้วย payload
   * เดิมบวกฟิลด์คำตอบ — doc_version ตัวเดิมใช้ต่อได้ เพราะรอบที่ถูกตีกลับไม่ได้
   * แก้อะไรในใบเลย
   */
  const runWorkflow = async (
    mutation: typeof submitSr,
    payload: SrActionPayload,
    successMsg: string,
    options?: { onDone?: () => void },
  ) => {
    if (!storeRequisition) return;
    const fresh = await fetchFreshSr();
    const body = { ...payload, doc_version: resolveDocVersion(fresh) };

    const fire = (extra?: Partial<SrActionPayload>) => {
      // ปิด guard ก่อนยิง mutation — ผู้อนุมัติ/ผู้จ่ายที่เพิ่งติ๊กแถวคือฟอร์ม dirty
      // ถ้าไม่ปิดก่อน navigate ตอนสำเร็จจะไปโผล่ dialog ถามว่าจะทิ้งการแก้ไขไหม
      setIsSubmitting(true);
      mutation.mutate(
        { ...body, ...extra },
        {
          onSuccess: () => {
            setDatePattern(null);
            toast.success(successMsg);
            options?.onDone?.();
            goList();
          },
          onError: (err) => {
            setIsSubmitting(false);
            const field = datePatternField(err);
            if (field) {
              setDatePattern({
                field,
                retry: (pattern) => fire({ [field]: pattern }),
              });
              return;
            }
            setDatePattern(null);
            reportApiError(err);
          },
        },
      );
    };

    fire();
  };

  const buildStageDetails = (
    fallbackStatus: string,
    message?: string,
    usePerItemStatus = false,
  ): SrStageDetail[] => {
    const formItems = form.getValues("items");
    return formItems
      .filter((item) => !!item.id)
      .map((item) => ({
        id: item.id ?? "",
        stage_status:
          usePerItemStatus && item.stage_status
            ? item.stage_status
            : fallbackStatus,
        stage_message: item.stage_message || message || null,
      }));
  };

  /**
   * ยิง submit จริง แยกจากขั้น save เพราะมันคือขั้นเดียวที่อาจถูกถามเรื่องวันที่กลับมา
   *
   * ยิงซ้ำด้วย id/doc_version/details ชุดเดิมได้ — รอบที่ถูกตีกลับด้วย 422 ไม่ได้
   * แก้อะไรในใบ doc_version จึงยังตรง
   */
  const fireSubmit = (
    srId: string,
    docVersion: number,
    details: SrStageDetail[],
    pattern?: SrDatePattern,
  ) => {
    setIsSubmitting(true);
    submitSr.mutate(
      {
        id: srId,
        stage_role: "create",
        doc_version: docVersion,
        details,
        ...(pattern ? { sr_date_pattern: pattern } : {}),
      },
      {
        onSuccess: () => {
          setDatePattern(null);
          setShowSubmit(false);
          toast.success(t("submitted"));
          goList();
        },
        onError: (err) => {
          setIsSubmitting(false);
          if (datePatternField(err) === "sr_date_pattern") {
            // ปิด dialog ยืนยันการส่งก่อน — ไม่งั้นซ้อนกันสองชั้น ชั้นบนถามวันที่
            // ชั้นล่างยังถามว่าจะส่งไหม
            setShowSubmit(false);
            setDatePattern({
              field: "sr_date_pattern",
              retry: (p) => fireSubmit(srId, docVersion, details, p),
            });
            return;
          }
          setDatePattern(null);
          reportApiError(err);
        },
      },
    );
  };

  /**
   * กด Submit ได้ตั้งแต่ยังไม่เคย save — save ให้เองก่อนแล้วค่อยยิง submit
   *
   * ใบใหม่ = create → submit, ใบเดิมที่แก้ค้าง = update → submit, ใบที่ไม่มีอะไรค้าง
   * = submit ตรง ๆ (แบบเดียวกับ PR) คนหน้างานไม่ต้องรู้ว่าต้องกด Save ก่อนถึงจะ
   * ส่งได้ ดึง detail id + doc_version จากใบสดหลัง save เพราะ id ของแถวเพิ่งเกิด
   */
  const handleSubmitSr = async (values: SrFormValues) => {
    // ปิด guard ก่อนยิง mutation → sentinel ถูกลบทันการ navigate(list) ตอนสำเร็จ
    setIsSubmitting(true);
    let srId = storeRequisition?.id;
    try {
      if (!srId) {
        const res = await createSr.mutateAsync({
          stage_role: "create",
          details: buildSaveDetails(values, null),
        });
        srId = (res as { data?: { id?: string } })?.data?.id;
      } else if (isEdit && form.formState.isDirty) {
        await updateSr.mutateAsync({
          id: srId,
          stage_role: "create",
          details: buildSaveDetails(values, await fetchFreshSr()),
        });
      }
    } catch {
      // create/update ยังใช้ toast กลาง — แค่เปิด guard กลับให้กรอกต่อได้
      setIsSubmitting(false);
      return;
    }
    if (!srId) {
      setIsSubmitting(false);
      return;
    }

    const saved = await fetchSrById(srId);
    const details: SrStageDetail[] = (
      saved?.store_requisition_detail ?? []
    ).map((d) => ({ id: d.id, stage_status: "submit", stage_message: null }));
    fireSubmit(
      srId,
      saved?.doc_version ?? 0,
      details,
      submitDatePatternPeriod ? (submitDatePattern ?? undefined) : undefined,
    );
  };

  const revealInvalid = (errors: FieldErrors<SrFormValues>) => {
    scrollToFirstInvalidField();
    const count = countInvalidItems(errors as Record<string, unknown>);
    toast.warning(
      count > 0 ? tv("incompleteItems", { count }) : tv("incompleteDocument"),
    );
  };

  // ตรวจก่อนเปิด dialog — ไม่เอาใบที่กรอกไม่ครบมาถามว่า "จะส่งไหม"
  // ล้างคำตอบเรื่องวันที่ทุกครั้งที่เปิด ให้ผู้ใช้เลือกใหม่ ไม่พาค่ารอบก่อนมาเงียบ ๆ
  const openSubmitDialog = () =>
    form.handleSubmit(() => {
      setSubmitDatePattern(null);
      setShowSubmit(true);
    }, revealInvalid)();

  const confirmSubmitSr = () => form.handleSubmit(handleSubmitSr)();

  const handleApprove = () => {
    if (!storeRequisition) return;
    const details: SrStageDetail[] = form
      .getValues("items")
      .filter((item) => !!item.id)
      .map((item) => ({
        id: item.id ?? "",
        stage_status: item.stage_status || "approve",
        stage_message: item.stage_message || null,
        approved_qty: Number(item.approved_qty) || 0,
      }));
    runWorkflow(
      approveSr,
      { id: storeRequisition.id, stage_role: STAGE_ROLE.APPROVE, details },
      t("approved"),
    );
  };

  const handleIssue = () => {
    if (!storeRequisition) return;
    const details: SrStageDetail[] = form
      .getValues("items")
      .filter((item) => !!item.id)
      .map((item) => ({
        id: item.id ?? "",
        stage_status: "issue",
        stage_message: null,
        issued_qty: Number(item.issued_qty) || 0,
      }));
    runWorkflow(
      issueSr,
      { id: storeRequisition.id, stage_role: STAGE_ROLE.ISSUE, details },
      t("issued"),
    );
  };

  const handleReject = (message?: string) => {
    if (!storeRequisition) return;
    runWorkflow(
      rejectSr,
      {
        id: storeRequisition.id,
        stage_role: currentRole,
        details: buildStageDetails("reject", message),
      },
      t("rejected"),
    );
  };

  const handleReview = (message?: string, desStage?: string) => {
    if (!storeRequisition) return;
    runWorkflow(
      reviewSr,
      {
        id: storeRequisition.id,
        stage_role: currentRole,
        details: buildStageDetails("review", message, true),
        ...(desStage ? { des_stage: desStage } : {}),
      },
      t("sentBack"),
    );
  };

  const handleCancel = () => {
    discard.confirm(() => {
      if (isEdit && storeRequisition) {
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

  const handleConfirmDelete = () => {
    if (!storeRequisition) return;
    deleteSr.mutate(storeRequisition.id, {
      onSuccess: () => {
        toast.success(tt("deleteSuccess", { entity: t("entity") }));
        toList();
      },
    });
  };

  return {
    // pending
    isPending,
    isWorkflowActionPending,
    deleteIsPending: deleteSr.isPending,
    // submit อาจพ่วง create/update มาก่อน — นับรวมด้วย ไม่งั้น dialog ดูเหมือนค้าง
    submitIsPending:
      submitSr.isPending || createSr.isPending || updateSr.isPending,
    approveIsPending: approveSr.isPending,
    issueIsPending: issueSr.isPending,
    rejectIsPending: rejectSr.isPending,
    reviewIsPending: reviewSr.isPending,
    // dialog state
    showDelete,
    setShowDelete,
    showSubmit,
    setShowSubmit,
    showComment,
    setShowComment,
    actionDialog,
    setActionDialog,
    submitDatePatternPeriod,
    submitDatePattern,
    setSubmitDatePattern,
    datePattern,
    closeDatePattern: () => setDatePattern(null),
    // discard
    discardDialogProps: discard.dialogProps,
    navDiscardDialogProps,
    // handlers
    onSubmit,
    revealInvalid,
    openSubmitDialog,
    confirmSubmitSr,
    handleApprove,
    handleIssue,
    handleReject,
    handleReview,
    handleCancel,
    handleBack,
    handleConfirmDelete,
  };
}

export type UseSrFormActionsReturn = ReturnType<typeof useSrFormActions>;
