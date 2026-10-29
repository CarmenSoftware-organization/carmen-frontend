import { useState } from "react";
import { useNavigate } from "react-router";
import { useListReturn } from "@/hooks/use-list-return";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import type { UseFormReturn } from "react-hook-form";
import {
  useCreateGoodsReceiveNote,
  useUpdateGoodsReceiveNote,
  useDeleteGoodsReceiveNote,
  useSaveGoodsReceiveNote,
  useCommitGoodsReceiveNote,
  useVoidGoodsReceiveNote,
} from "@/hooks/use-goods-receive-note";
import { useDiscardConfirm } from "@/hooks/use-discard-confirm";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import type {
  GoodsReceiveNote,
  CreateGrnDto,
} from "@/types/goods-receive-note";
import type { FormMode } from "@/types/form";
import { buildItemChanges } from "@/lib/form-helpers";
import { pickDocVersion, withFreshDetailVersions } from "@/lib/doc-version";
import { httpClient } from "@/lib/http-client";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { useBuCode } from "@/hooks/use-bu-code";
import { useProfile } from "@/hooks/use-profile";
import {
  resolvePeriodDate,
  type PeriodDateChoice as PeriodDateChoiceValue,
} from "@/components/share/period-date-choice";
import { removeSessionItem } from "@/lib/safe-storage";
import {
  mapDetailToPayload,
  mapExtraCostToPayload,
  pickTouchedLineUpdates,
  type GrnFormValues,
} from "./grn-form-schema";
import { findExpiredLines } from "./grn-expiry";

interface UseGrnFormActionsParams {
  form: UseFormReturn<GrnFormValues>;
  goodsReceiveNote?: GoodsReceiveNote;
  defaultValues: GrnFormValues;
  mode: FormMode;
  setMode: (mode: FormMode) => void;
  revealErrors?: (errors?: Record<string, unknown>) => void;
}

export function useGrnFormActions({
  form,
  goodsReceiveNote,
  defaultValues,
  mode,
  setMode,
  revealErrors,
}: UseGrnFormActionsParams) {
  const navigate = useNavigate();
  const { toList, returnState } = useListReturn(
    "/procurement/goods-receive-note",
  );
  const t = useTranslations("procurement.goodsReceiveNote");
  const tt = useTranslations("toast");

  const isEdit = mode === "edit";
  const isAdd = mode === "add";

  const createGrn = useCreateGoodsReceiveNote();
  const updateGrn = useUpdateGoodsReceiveNote();
  const deleteGrn = useDeleteGoodsReceiveNote();
  const saveGrn = useSaveGoodsReceiveNote();
  const buCode = useBuCode();
  const { currentPeriod } = useProfile();
  const commitGrn = useCommitGoodsReceiveNote();

  /**
   * GET ใบสดจาก DB ก่อนยิง PATCH/commit — GRN เป็นโมดูลเดียวที่ไม่เคยมีตัวนี้เลย
   * PATCH ใช้ `values.doc_version` และ commit ใช้ค่าจาก prop ตอนโหลดหน้า ซึ่งเป็น
   * ค่าที่เก่าที่สุดในบรรดาทั้งหมด บันทึกรอบก่อน bump แล้วรอบถัดไปชน 409 ทันที
   * (ทรงเดียวกับ fetchFreshPr / fetchFreshPo / fetchFreshSr)
   */
  type FreshGrn = {
    doc_version?: number;
    good_received_note_detail?: { id: string; doc_version?: number }[];
  };

  const fetchFreshGrn = async (id: string): Promise<FreshGrn | null> => {
    if (!buCode) return null;
    try {
      const res = await httpClient.get(
        `${API_ENDPOINTS.GOODS_RECEIVE_NOTE(buCode)}/${id}`,
      );
      if (res.ok) {
        const fresh = ((await res.json())?.data ?? null) as FreshGrn | null;
        if (import.meta.env.DEV && fresh?.doc_version == null) {
          console.warn("[GRN] GET คืน 200 แต่ไม่มี doc_version — ใช้ค่าในฟอร์มแทน", id);
        }
        return fresh;
      }
      if (import.meta.env.DEV)
        console.warn("[GRN] ดึง doc_version สดไม่สำเร็จ", res.status, id);
    } catch (err) {
      // ยังคืน null (ไม่ throw) เพราะ GET ล้มไม่ควรทำให้บันทึกไม่ได้เลย — แต่ต้องไม่เงียบ
      if (import.meta.env.DEV) console.warn("[GRN] ดึง doc_version สดไม่สำเร็จ", err);
    }
    return null;
  };
  const voidGrn = useVoidGoodsReceiveNote();

  // วันที่บนใบอยู่นอกงวดที่เปิดอยู่ → dialog commit ถามว่าจะย้ายเข้างวดหรือคงวันเดิม
  // (`PeriodDateChoice` เรนเดอร์เองเฉพาะตอนต้องถาม) default = คงวันเดิม ไม่ไปขยับ
  // วันที่ของเอกสารให้ใครโดยไม่ได้สั่ง
  const [periodDateChoice, setPeriodDateChoice] =
    useState<PeriodDateChoiceValue>("document");
  const [showDelete, setShowDelete] = useState(false);
  const [showCommit, setShowCommit] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  const [showComment, setShowComment] = useState(false);
  // มีบรรทัดที่วันหมดอายุผ่านไปแล้ว → ถามก่อนสร้างใบ / ก่อน commit · ตอบใช่ก็ทำต่อ
  // ไม่บล็อก (เก็บทางไปต่อของแต่ละปุ่มไว้ เพราะสองปุ่มไปต่อคนละทาง)
  const [expiryPrompt, setExpiryPrompt] = useState<{
    lines: GrnFormValues["items"];
    onYes: () => void;
    onNo: () => void;
  } | null>(null);

  const isPending =
    createGrn.isPending || updateGrn.isPending || saveGrn.isPending;
  // ปุ่ม Commit บนใบร่างลากไปทั้งสาย PATCH → /save → /commit — นับทุกขั้น ไม่งั้น
  // ช่วงที่ยังไม่ถึง /commit ปุ่มกับ dialog จะดูว่างเปล่าทั้งที่กำลังยิงอยู่ กดซ้ำได้
  const isActionPending =
    commitGrn.isPending ||
    voidGrn.isPending ||
    saveGrn.isPending ||
    updateGrn.isPending;

  const discard = useDiscardConfirm({
    isDirty: form.formState.isDirty,
    isPending: isPending || isActionPending,
  });

  // ระหว่าง submit (จนกว่าจะ navigate/เข้า view) ปิด nav guard — ไม่งั้น sentinel
  // history entry ที่ guard ดันไว้จะทำให้ navigate(replace) หลัง create ไม่กิน /new
  // จริง → /new ค้างใน stack → back เด้งกลับ /new (ดู finalize ของ create)
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

  /**
   * บันทึกใบ (draft → saved) สำเร็จ → กลับหน้ารายการ เหมือน PR/PO
   *
   * เฉพาะขั้น "ปิดจบ" เท่านั้น — บันทึกร่างเฉย ๆ ยังอยู่หน้าเดิม เพราะคนกรอก
   * มักจะกรอกต่อ ไม่ใช่กรอกเสร็จ
   */
  /**
   * จบรอบของปุ่มที่มี dialog ยืนยัน — ปลด guard แล้วปิด dialog ทุกใบ
   *
   * ใช้ทั้งทางสำเร็จและทางพัง: dialog ที่ค้างอยู่จะบัง toast แจ้ง error ที่เพิ่ง
   * ขึ้นมา คนกดเลยเห็นแต่จอค้าง ๆ ไม่รู้ว่าเกิดอะไร (ทรงเดียวกับ `abortSubmit`
   * ของ CN) · ปิด dialog ที่ไม่ได้เปิดอยู่ไม่มีผลอะไร จึงเรียกรวมได้เลย
   */
  const finishAction = () => {
    setIsSubmitting(false);
    setShowCommit(false);
    setShowVoid(false);
  };

  const onSavedToList = () => {
    toast.success(tt("updateSuccess", { entity: t("entity") }));
    toList();
  };

  /**
   * @param onSaved - แทน `onSavedToList` ตอนขั้น "บันทึกแล้ว" สำเร็จ — ปุ่ม Commit
   *   ใช้ช่องนี้ยิง /commit ต่อ แทนที่จะเด้งกลับหน้ารายการ
   * @param expiryConfirmed - ผู้ใช้ตอบ "ใช่" กับคำถามสินค้าหมดอายุแล้ว (ไม่ต้องถามซ้ำ)
   */
  const onSubmit = async (
    values: GrnFormValues,
    onSaved?: () => void,
    expiryConfirmed = false,
  ) => {
    const isManual = values.doc_type === "manual";
    const finishSave = onSaved ?? onSavedToList;

    const detail = buildItemChanges(
      values.items,
      defaultValues.items,
      (item) => {
        const payload = mapDetailToPayload(item);
        if (isManual) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { purchase_order_detail_id, ...rest } = payload;
          return rest;
        }
        return payload;
      },
    );

    // แถวที่ผู้ใช้ไม่ได้แตะ ห้ามนับเป็น update (เหตุผลอยู่ที่ pickTouchedLineUpdates)
    if (goodsReceiveNote && detail.update) {
      detail.update = pickTouchedLineUpdates(
        detail.update,
        values.items,
        defaultValues.items,
      );
    }

    // PATCH: backend ต้องการ good_received_note_id (parent ref) ต่อ item ใน update
    // เกณฑ์เดียวกับสาขา PATCH ข้างล่าง — ผูกกับ "มีใบอยู่แล้ว" ไม่ใช่โหมด
    if (goodsReceiveNote && detail.update) {
      detail.update = detail.update.map((u) => ({
        ...u,
        good_received_note_id: goodsReceiveNote.id,
      }));
    }

    const extraCostDetail = buildItemChanges(
      values.extra_cost_details,
      defaultValues.extra_cost_details,
      mapExtraCostToPayload,
    );

    const raw: Record<string, unknown> = {
      // doc_version ไม่ได้อยู่ตรงนี้ — สาขา PATCH เซ็ตทับด้วยเลขสดข้างล่างอยู่แล้ว
      // ส่วนใบใหม่ (create) ไม่มีเวอร์ชันให้ส่ง วางไว้ตรงนี้มีแต่จะทำให้คนอ่านคิดว่า
      // ค่าในฟอร์มคือค่าที่ถูกส่งจริง
      note: values.note || undefined,
      grn_date: values.grn_date || undefined,
      invoice_no: values.invoice_no || undefined,
      invoice_date: values.invoice_date || undefined,
      description: values.description || undefined,
      doc_status: values.doc_status ?? "draft",
      doc_type: values.doc_type,
      post_type: values.post_type,
      credit_term_days: values.credit_term_days ?? undefined,
      credit_term_id: values.credit_term_id ?? undefined,
      payment_due_date: values.payment_due_date ?? undefined,
      is_active: values.is_active,
      vendor_id: values.vendor_id,
      currency_id: values.currency_id ?? undefined,
      exchange_rate: values.exchange_rate ?? undefined,
      exchange_rate_date: values.exchange_rate_date ?? undefined,
      good_received_note_detail: detail,
      extra_cost: {
        allocate_extra_cost_type: values.allocate_extra_cost_type || undefined,
        extra_cost_detail: extraCostDetail,
      },
    };

    const payload = Object.fromEntries(
      Object.entries(raw).filter(([, v]) => v !== null && v !== undefined),
    ) as unknown as CreateGrnDto;

    // เงื่อนไขจริงคือ "มีใบอยู่แล้ว" ไม่ใช่ "อยู่โหมดแก้ไข" — ปุ่ม Commit เรียก
    // เส้นนี้จากโหมดอ่าน (ปุ่มโผล่เฉพาะ isView) ถ้าเช็ค isEdit จะตกทั้งสองสาขา
    // แล้วจบเงียบ ๆ ไม่ยิงอะไรเลย · ปุ่ม Save/Save draft อยู่ในบล็อก {!isView}
    // ของหัวใบอยู่แล้ว การปลดเงื่อนไขนี้จึงไม่เปิดทางใหม่ให้ใคร
    if (goodsReceiveNote) {
      const headerKeys = [
        "note",
        "grn_date",
        "invoice_no",
        "invoice_date",
        "description",
        "doc_status",
        "doc_type",
        "post_type",
        "credit_term_days",
        "credit_term_id",
        "payment_due_date",
        "is_active",
        "vendor_id",
        "currency_id",
        "exchange_rate",
        "exchange_rate_date",
      ] as const;

      const patchPayload: Record<string, unknown> = {};
      const defaultRecord = defaultValues as unknown as Record<string, unknown>;
      const valueRecord = values as unknown as Record<string, unknown>;
      const payloadRecord = payload as unknown as Record<string, unknown>;
      for (const key of headerKeys) {
        if (valueRecord[key] !== defaultRecord[key]) {
          patchPayload[key] = payloadRecord[key];
        }
      }

      // ขั้น "ร่าง → บันทึกแล้ว" เป็นหน้าที่ของ /save เท่านั้น — มันไม่ได้แค่เปลี่ยน
      // ป้ายสถานะ แต่ลงรายการสต๊อกกับตัดยอดรับของ PO ด้วย · ถ้าปล่อยให้ PATCH
      // เขียน doc_status ไปก่อน ใบจะขึ้นเป็น "บันทึกแล้ว" โดยของไม่เคยเข้าสต๊อก
      // แล้ว /save ที่ยิงตามก็เจอว่าไม่ใช่ร่างแล้ว ตอบ "Only draft GRN can be saved"
      const willCallSave =
        values.doc_status === "saved" &&
        goodsReceiveNote.doc_status === "draft";
      if (willCallSave) delete patchPayload.doc_status;

      // ใบ committed แก้ได้แค่หัวใบ — รายการกับ extra cost ล็อกอยู่ในหน้าจอแล้ว แต่กัน
      // ซ้ำตรงนี้ด้วย ไม่งั้นค่าคำนวณที่คลาดในฟอร์มจะหลุดไปแล้วหลังบ้านตอบ
      // GRN_COMMITTED_HEADER_ONLY ทุกครั้งที่กดบันทึก
      const linesLocked = goodsReceiveNote.doc_status === "committed";
      const hasItemChanges =
        !linesLocked && !!(detail.add || detail.update || detail.remove);
      // เปลี่ยนแค่วิธีกระจายก็นับเป็นการแก้ — เดิมดูเฉพาะบรรทัด เลือกวิธีใหม่แล้วกดบันทึก
      // ค่าจึงหายเงียบ ๆ
      const hasExtraCostChanges =
        !linesLocked &&
        (!!(
          extraCostDetail.add ||
          extraCostDetail.update ||
          extraCostDetail.remove
        ) ||
          values.allocate_extra_cost_type !==
            defaultValues.allocate_extra_cost_type);

      if (hasItemChanges) {
        patchPayload.good_received_note_detail = detail;
      }
      if (hasExtraCostChanges) {
        patchPayload.extra_cost = {
          // ใบหนึ่งมีหัวค่าใช้จ่ายเดียว — ส่ง id ของหัวเดิมไปด้วย ไม่งั้นหลังบ้านรุ่นก่อน
          // สร้างหัวเปล่าหัวที่สอง แล้วบรรทัดใหม่ไม่มี extra_cost_id จนตอบ 400
          id: goodsReceiveNote.extra_cost?.id,
          allocate_extra_cost_type:
            values.allocate_extra_cost_type || undefined,
          extra_cost_detail: extraCostDetail,
        };
      }

      // ไม่มีอะไรเปลี่ยนเลย — ข้าม PATCH ไปทำขั้นบันทึกต่อได้เลย (ถ้ามี)
      if (Object.keys(patchPayload).length === 0) {
        if (willCallSave) {
          saveGrn.mutate(goodsReceiveNote.id, {
            onSuccess: finishSave,
            onError: finishAction,
          });
          return;
        }
        setIsSubmitting(false);
        setMode("view");
        return;
      }

      // backend ต้องการ doc_version ทุกครั้งตอน PATCH (optimistic lock) — เอาเลขสด
      // จาก DB ไม่ใช่ค่าในฟอร์ม ซึ่งค้างเก่าได้ถ้า response รอบก่อนไม่ได้ส่งกลับมา
      const fresh = await fetchFreshGrn(goodsReceiveNote.id);
      patchPayload.doc_version = pickDocVersion(
        fresh?.doc_version,
        values.doc_version,
        goodsReceiveNote.doc_version,
      );
      // lock ของ backend เช็ค tb_good_received_note_detail แยกอีกชั้น — ส่งเลข
      // ราย row เก่าไปก็ 409 เหมือนกัน (grn-form-schema.ts:273 เขียนเตือนไว้แล้ว)
      if (patchPayload.good_received_note_detail) {
        const detail = patchPayload.good_received_note_detail as {
          update?: { id: string }[];
        };
        detail.update = withFreshDetailVersions(
          detail.update,
          fresh?.good_received_note_detail,
        );
      }

      updateGrn.mutate(
        {
          id: goodsReceiveNote.id,
          ...(patchPayload as unknown as CreateGrnDto),
        },
        {
          onSuccess: () => {
            const finalize = () => {
              toast.success(tt("updateSuccess", { entity: t("entity") }));
              setIsSubmitting(false);
              setMode("view");
              // ล้าง dirty ให้ baseline = ค่าที่เพิ่งบันทึก — ไม่งั้นฟอร์มยังนับว่า
              // มีของค้าง แล้ว rebase จากข้อมูลสด (ที่มี doc_version ใหม่) จะไม่ทำงาน
              form.reset(form.getValues());
            };
            if (willCallSave) {
              saveGrn.mutate(goodsReceiveNote.id, {
                onSuccess: finishSave,
                onError: finishAction,
              });
            } else {
              finalize();
            }
          },
          onError: finishAction,
        },
      );
    } else if (isAdd) {
      // ถามตรงนี้ (หลังผ่าน validation แล้ว) ไม่ใช่ตอนกดปุ่ม — ไม่งั้นตอบใช่แล้วไปติด
      // ช่องบังคับ แก้เสร็จกดใหม่ก็โดนถามซ้ำ · ครอบทั้งปุ่ม Save draft / Save และ
      // การกด Enter ในฟอร์ม (draftSaveHandler) ที่เข้ามาทาง onSubmit ตรง ๆ
      const expiredLines = findExpiredLines(values.items);
      if (!expiryConfirmed && expiredLines.length > 0) {
        setExpiryPrompt({
          lines: expiredLines,
          onYes: () => void onSubmit(values, onSaved, true),
          onNo: finishAction,
        });
        return;
      }
      createGrn.mutate(payload, {
        onSuccess: (res) => {
          removeSessionItem("grn-wizard-data");
          const body = res as { data?: { id?: string } } | undefined;
          const newId = body?.data?.id;
          const finalize = () => {
            toast.success(tt("createSuccess", { entity: t("entity") }));
            if (newId) {
              // guard ถูกปิดตั้งแต่กด submit (isSubmitting) → sentinel ที่เคยดันไว้ที่
              // /new ถูก teardown ลบไปแล้ว → replace แทน /new จริง ไม่ใช่ sentinel →
              // stack เหลือ [list, /:id] → back ที่หน้า detail = กลับ list. route /:id
              // mount GrnForm เป็น view mode เอง (ไม่ setMode ที่นี่ เลี่ยง churn)
              navigate(`/procurement/goods-receive-note/${newId}`, {
                replace: true,
                ...returnState,
              });
            }
          };
          // สร้างแล้วปิดจบเลย → กลับหน้ารายการ · สร้างเป็นร่าง → เข้าหน้าใบที่
          // เพิ่งสร้างเพื่อกรอกต่อ
          if (values.doc_status === "saved" && newId) {
            saveGrn.mutate(newId, {
              onSuccess: finishSave,
              onError: finishAction,
            });
          } else {
            finalize();
          }
        },
        onError: finishAction,
      });
    }
  };

  const handleSubmitWithStatus = (status: string, onSaved?: () => void) => {
    form.setValue("doc_status", status, { shouldDirty: true });
    // ปิด guard ตั้งแต่ก่อนยิง mutation → sentinel ถูกลบระหว่างรอ network → พอ
    // create สำเร็จแล้ว navigate จะ replace /new จริง ไม่ใช่ sentinel
    setIsSubmitting(true);

    // เก็บร่างไม่บังคับกรอกครบ — คนรับของอาจยังไม่รู้ราคา ยังไม่มีเลขใบกำกับ
    // แล้วอยากเก็บที่กรอกไว้ก่อน บังคับให้ครบ = ต้องกรอกมั่วให้ผ่านหรือทิ้งทั้งใบ
    //
    // "บันทึก" (saved) กับปุ่ม Commit ที่ยืมทางนี้ไปยังบังคับครบตามเดิม เพราะขั้น
    // นั้น /save ลงรายการสต๊อกกับตัดยอดรับของ PO จริง ของที่กรอกไม่ครบเข้าสต๊อก
    // ไปแล้วแก้ทีหลังไม่ได้ · ค่าที่ส่งเป็น getValues() ดิบ ไม่ผ่าน z.coerce
    // (เหตุผลเดียวกับ `draftSaveHandler` ใน lib/form-helpers)
    if (status === "draft") {
      void onSubmit(form.getValues(), onSaved);
      return;
    }

    // ใบ committed แก้ได้แค่หัวใบ ตรวจเฉพาะช่องที่แก้ได้ — รายการถูกล็อก ถ้าให้กฎของ
    // รายการ (เช่น ต้องมีราคา) ตัดสินด้วย ผู้ใช้จะติดอยู่กับ error ที่ไม่มีทางแก้
    if (status === "committed") {
      void form
        .trigger([
          "invoice_no",
          "invoice_date",
          "payment_due_date",
          "post_type",
          "credit_term_id",
          "description",
        ])
        .then((ok) => {
          if (ok) {
            void onSubmit(form.getValues(), onSaved);
            return;
          }
          finishAction();
          revealErrors?.(form.formState.errors as Record<string, unknown>);
        });
      return;
    }

    form.handleSubmit((values) => onSubmit(values, onSaved), (errs) => {
      finishAction(); // validation ไม่ผ่าน → guard กลับมาเฝ้า + ปิด dialog ยืนยัน
      // location/received_qty/discount/tax อยู่ใน group expand → เผย + scroll +
      // บอกว่าขาดกี่รายการ (revealErrors พูดคนเดียว ไม่ต้อง toast ซ้อน)
      revealErrors?.(errs as Record<string, unknown>);
    })();
  };

  const handleCancel = () => {
    discard.confirm(() => {
      if (isEdit && goodsReceiveNote) {
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
    if (!goodsReceiveNote) return;
    deleteGrn.mutate(goodsReceiveNote.id, {
      onSuccess: () => {
        toast.success(tt("deleteSuccess", { entity: t("entity") }));
        toList();
      },
      onError: () => setShowDelete(false),
    });
  };

  /** ยิง /commit จริง — ใช้เลข doc_version สด เพราะ PATCH/save ข้างหน้า bump ให้แล้ว */
  const runCommit = async () => {
    if (!goodsReceiveNote) return;
    // commit ตัดของเข้าสต๊อกจริงและย้อนไม่ได้ — ยิ่งต้องใช้เลขสด ของเดิมใช้ค่าจาก
    // prop ตอนโหลดหน้า ซึ่งเก่ากว่าค่าในฟอร์มเสียอีก
    const fresh = await fetchFreshGrn(goodsReceiveNote.id);
    commitGrn.mutate(
      {
        id: goodsReceiveNote.id,
        doc_version: pickDocVersion(
          fresh?.doc_version,
          form.getValues("doc_version"),
          goodsReceiveNote.doc_version,
        ),
      },
      {
        onSuccess: () => {
          // commit ตัดของเข้าสต๊อกจริงและย้อนไม่ได้ — dialog เตือนไว้ก่อนกด แล้ว
          // ตอนสำเร็จต้องบอกด้วยว่าสต๊อกขยับแล้ว ไม่ใช่ "อัปเดตใบรับสินค้าสำเร็จ"
          // ซึ่งเป็นข้อความเดียวกับตอนกดเซฟเฉย ๆ คนกดแยกไม่ออกว่าของเข้าหรือยัง
          toast.success(t("committed"));
          finishAction();
        },
        onError: finishAction,
      },
    );
  };

  /**
   * ใบร่างกด Commit ได้เลย ไม่ต้องกด Save ก่อน
   *
   * หลังบ้านรับ commit เฉพาะใบ `saved` (good-received-note.logic —
   * `GRN_ONLY_SAVED_COMMITTABLE`) ใบร่างจึงต้องเดินทั้งสาย **PATCH → /save →
   * /commit** โดยยืมเส้นทางของปุ่ม Save มาทั้งดุ้น (`handleSubmitWithStatus`)
   * ไม่ได้เขียน payload ใหม่ — ได้ทั้งการส่งเฉพาะ field ที่เปลี่ยน, doc_version
   * สดทั้งหัวเอกสารและราย row, และการข้าม PATCH เองเมื่อไม่มีอะไรเปลี่ยน
   *
   * `/save` ไม่ได้แค่เปลี่ยนป้ายสถานะ มันลงรายการสต๊อกกับตัดยอดรับของ PO ด้วย
   * ลำดับจึงสลับไม่ได้ · ขั้นไหนพังก็หยุดตรงนั้น ไม่เดินต่อ
   */
  const handleConfirmCommit = async () => {
    if (!goodsReceiveNote) return;
    if (goodsReceiveNote.doc_status === "draft") {
      // เลือก "ย้ายเข้างวด" → เขียน grn_date ลงฟอร์มก่อน แล้วปล่อยให้สาย
      // PATCH → /save เดิมพามันขึ้นไปเอง (PATCH ส่งเฉพาะ field ที่ต่างจาก
      // baseline อยู่แล้ว) ไม่ต้องมี payload พิเศษของตัวเอง
      const periodDate = resolvePeriodDate(
        periodDateChoice,
        form.getValues("grn_date"),
        currentPeriod,
      );
      if (periodDate) {
        form.setValue("grn_date", periodDate, { shouldDirty: true });
      }
      handleSubmitWithStatus("saved", () => void runCommit());
      return;
    }
    // ใบ `saved` อยู่แล้ว — ไม่มีอะไรให้บันทึก ยิง commit ตรง ๆ
    await runCommit();
  };

  /**
   * ปุ่ม Commit — มีบรรทัดที่หมดอายุแล้วถามก่อน ตอบใช่จึงเปิด dialog ยืนยัน commit เดิม
   *
   * อ่านจากฟอร์ม ไม่ใช่จากใบที่โหลดมา: ใบร่างกด Commit แล้ว PATCH ค่าในฟอร์มขึ้นไปก่อน
   */
  const requestCommit = () => {
    const expiredLines = findExpiredLines(form.getValues("items"));
    if (expiredLines.length === 0) {
      setShowCommit(true);
      return;
    }
    setExpiryPrompt({
      lines: expiredLines,
      onYes: () => setShowCommit(true),
      onNo: () => {},
    });
  };

  const expiryDialogProps = {
    open: !!expiryPrompt,
    lines: expiryPrompt?.lines ?? [],
    onConfirm: () => {
      const prompt = expiryPrompt;
      setExpiryPrompt(null);
      prompt?.onYes();
    },
    onCancel: () => {
      const prompt = expiryPrompt;
      setExpiryPrompt(null);
      prompt?.onNo();
    },
  };

  const handleConfirmVoid = () => {
    if (!goodsReceiveNote) return;
    voidGrn.mutate(goodsReceiveNote.id, {
      onSuccess: () => {
        toast.success(tt("voidSuccess", { entity: t("entity") }));
        finishAction();
      },
      onError: finishAction,
    });
  };

  return {
    deleteGrn,
    commitGrn,
    voidGrn,
    isPending,
    isActionPending,
    periodDateChoice,
    setPeriodDateChoice,
    showDelete,
    setShowDelete,
    showCommit,
    setShowCommit,
    showVoid,
    setShowVoid,
    showComment,
    setShowComment,
    onSubmit,
    handleSubmitWithStatus,
    handleCancel,
    handleBack,
    handleConfirmDelete,
    handleConfirmCommit,
    requestCommit,
    handleConfirmVoid,
    expiryDialogProps,
    discardDialogProps: discard.dialogProps,
    navDiscardDialogProps,
  };
}
