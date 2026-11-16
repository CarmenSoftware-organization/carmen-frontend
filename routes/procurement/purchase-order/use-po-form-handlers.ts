import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useNavigate } from "react-router";
import { useListReturn } from "@/hooks/use-list-return";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import type { UseFormReturn } from "react-hook-form";
import {
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
  useDeletePurchaseOrder,
  useSubmitPurchaseOrder,
  useApprovePurchaseOrder,
  useRejectPurchaseOrder,
  useReviewPurchaseOrder,
  useClosePurchaseOrder,
} from "../shared/use-purchase-order";
import { useDiscardConfirm } from "@/hooks/use-discard-confirm";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { useBuCode } from "@/hooks/use-bu-code";
import { httpClient } from "@/lib/http-client";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import type { PurchaseOrder } from "@/types/purchase-order";
import { PO_TYPE } from "@/types/purchase-order";
import type { FormMode } from "@/types/form";
import { pickDocVersion } from "@/lib/doc-version";
import { useLineDimensionsEnabled } from "@/hooks/use-line-dimensions-enabled";
import { buildPoPayload } from "./build-po-payload";
import type { PoFormValues } from "./po-form-schema";

interface UsePoFormHandlersOptions {
  purchaseOrder: PurchaseOrder | undefined;
  form: UseFormReturn<PoFormValues>;
  defaultValues: PoFormValues;
  mode: FormMode;
  setMode: Dispatch<SetStateAction<FormMode>>;
  role: string | undefined;
  setShowReject: Dispatch<SetStateAction<boolean>>;
  setShowClose: Dispatch<SetStateAction<boolean>>;
  revealErrors: (errors?: Record<string, unknown>) => void;
}

export function usePoFormHandlers({
  purchaseOrder,
  form,
  defaultValues,
  mode,
  setMode,
  role,
  setShowReject,
  setShowClose,
  revealErrors,
}: UsePoFormHandlersOptions) {
  const navigate = useNavigate();
  const { toList, returnState } = useListReturn("/procurement/purchase-order");
  const t = useTranslations("procurement.purchaseOrder");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");
  const tfl = useTranslations("field");
  const buCode = useBuCode();
  const dimensionsEnabled = useLineDimensionsEnabled();

  const createPo = useCreatePurchaseOrder();
  const updatePo = useUpdatePurchaseOrder();
  const deletePo = useDeletePurchaseOrder();
  const submitPo = useSubmitPurchaseOrder();
  const approvePo = useApprovePurchaseOrder();
  const rejectPo = useRejectPurchaseOrder();
  const reviewPo = useReviewPurchaseOrder();
  const closePo = useClosePurchaseOrder();

  const isPending =
    createPo.isPending ||
    updatePo.isPending ||
    submitPo.isPending ||
    approvePo.isPending ||
    rejectPo.isPending ||
    reviewPo.isPending ||
    closePo.isPending;

  const discard = useDiscardConfirm({
    isDirty: form.formState.isDirty,
    isPending,
  });

  // ระหว่าง submit ตอน create ปิด nav guard — sentinel history entry ที่ guard ดัน
  // ไว้ที่ /new จะทำให้ navigate(replace) หลัง create ไม่กิน /new จริง → /new ค้างใน
  // stack → back เด้งกลับ /new (ดู create path ใน onSubmit)
  const [isSubmitting, setIsSubmitting] = useState(false);

  // guard เฉพาะตอน add/edit และมีการกรอกค้าง (dirty) — view/ยังไม่กรอก = ผ่านได้เลย
  // ครอบคลุมคลิกลิงก์ในแอป + กด browser back (ปุ่ม Back/Cancel ใช้ discard เอง)
  const navGuard = useNavigationGuard(
    (mode === "add" || mode === "edit") &&
      form.formState.isDirty &&
      !isSubmitting,
  );
  const navDiscardDialogProps = {
    open: navGuard.isOpen,
    onOpenChange: (o: boolean) => {
      if (!o) navGuard.cancel();
    },
    onConfirm: navGuard.confirm,
    onCancel: navGuard.cancel,
  };

  const buildDetailsFromForm = () =>
    form.getValues("items").map((item, i) => ({
      id: item.id ?? purchaseOrder?.purchase_order_detail?.[i]?.id ?? "",
      stage_status: item.stage_status || "approve",
      stage_message: item.stage_message || null,
    }));

  // ส่ง po_type ชัดเจนทั้งตอน create (POST) และ edit/save (PATCH)
  // - add: PO ใหม่ผ่านฟอร์มนี้เป็น manual เสมอ
  // - edit: คงค่าเดิมของ PO (manual→manual, ไม่ทับ PL/PR)
  // กัน backend default เป็น PR (ทำให้แก้ไขทีหลังไม่ได้: PO_FROM_PR_NOT_UPDATABLE)
  const poTypeOption = {
    ...(mode === "add"
      ? { po_type: PO_TYPE.MANUAL }
      : purchaseOrder?.po_type
        ? { po_type: purchaseOrder.po_type as PO_TYPE }
        : {}),
    dimensionsEnabled,
  };

  // หลัง /save: ดึง doc_version ล่าสุดจาก response กลับเข้า form (header + ราย
  // detail จับคู่ด้วย id) — กัน save/submit ครั้งถัดไปส่ง doc_version เก่า → 409
  // optimistic lock (tb_purchase_order_detail)
  const syncDocVersions = (saved: unknown) => {
    const data = (
      saved as {
        data?: {
          doc_version?: number;
          purchase_order_detail?: { id: string; doc_version?: number }[];
        };
      }
    )?.data;
    if (!data) return;
    if (data.doc_version != null) {
      form.setValue("doc_version", data.doc_version);
    }
    const items = form.getValues("items");
    for (const d of data.purchase_order_detail ?? []) {
      const idx = items.findIndex((it) => it.id === d.id);
      if (idx >= 0 && d.doc_version != null) {
        form.setValue(`items.${idx}.doc_version`, d.doc_version);
      }
    }
  };

  const onSubmit = async (values: PoFormValues) => {
    if (mode === "edit" && purchaseOrder) {
      // /save ต้องใช้เลขสดเหมือน workflow action — ค่าในฟอร์มค้างเก่าได้เสมอ
      // ถ้า response ของ save รอบก่อนไม่ได้ส่ง doc_version กลับมา
      const fresh = await fetchFreshPo();
      const payload = buildPoPayload(values, defaultValues.items, {
        ...poTypeOption,
        docVersion: resolveDocVersion(fresh),
        freshDetails: fresh?.purchase_order_detail,
      });
      updatePo.mutate(
        { id: purchaseOrder.id, ...payload },
        {
          onSuccess: (res) => {
            syncDocVersions(res);
            toast.success(tt("updateSuccess", { entity: t("entity") }));
            setMode("view");
            // ล้าง dirty ให้ baseline = ค่าที่เพิ่งบันทึก — ต้องมาหลัง
            // syncDocVersions เพื่อเก็บ doc_version ใหม่เข้า baseline ไปด้วย
            // ไม่งั้นฟอร์มยังนับว่ามีของค้าง กด Back หลังเซฟก็เจอ discard dialog
            // และ nav guard ยังดักลิงก์อยู่ทั้งที่บันทึกไปแล้ว
            form.reset(form.getValues());
          },
        },
      );
    } else if (mode === "add") {
      // ปิด guard ก่อนยิง mutation → sentinel ที่ /new ถูก teardown ลบระหว่างรอ
      // network → navigate(replace) ตอนสำเร็จเลยกิน /new จริง ไม่ใช่ sentinel →
      // stack เหลือ [list, /:id] → back ที่หน้า detail = กลับ list
      setIsSubmitting(true);
      // ใบใหม่ยังไม่มี id ให้ GET — doc_version ในฟอร์มเป็น undefined อยู่แล้ว
      // และถูกตัดออกจาก payload เอง
      createPo.mutate(buildPoPayload(values, defaultValues.items, poTypeOption), {
        onSuccess: (res) => {
          toast.success(tt("createSuccess", { entity: t("entity") }));
          const body = res as { data?: { id?: string } } | undefined;
          const newId = body?.data?.id;
          if (newId) {
            // ไม่เรียก setMode("view") — ปล่อยให้ route /:id mount PoForm ใหม่เป็น
            // view mode เอง (setMode จะ re-render + churn item table โดยไม่จำเป็น)
            navigate(`/procurement/purchase-order/${newId}`, {
              replace: true,
              ...returnState,
            });
          } else {
            toList();
          }
        },
        onError: () => setIsSubmitting(false), // create fail → guard กลับมาเฝ้า
      });
    }
  };

  const handleCancel = () => {
    discard.confirm(() => {
      if (mode === "edit" && purchaseOrder) {
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
    if (mode === "edit" || mode === "add") {
      discard.confirm(goBack);
    } else {
      goBack();
    }
  };

  // GET PO สดจาก DB ก่อนยิง workflow event ทุกตัว — /save bump doc_version
  // ระหว่างทาง ทำให้ค่าใน form/prop ค้างเก่า → 409 optimistic lock
  // (tb_purchase_order / tb_purchase_order_detail)
  const fetchFreshPo = async (
    id?: string,
  ): Promise<{
    doc_version?: number;
    // doc_version ราย row ต้องมีด้วย — lock ของ backend เช็ค tb_purchase_order_detail
    // แยกจากหัวเอกสาร ของเดิมประกาศแค่ `{ id }` เลยเอาเลขราย row มาใช้ไม่ได้
    purchase_order_detail?: { id: string; doc_version?: number }[];
  } | null> => {
    const poId = id ?? purchaseOrder?.id;
    if (!poId || !buCode) return null;
    try {
      const res = await httpClient.get(
        `${API_ENDPOINTS.PURCHASE_ORDER(buCode)}/${poId}`,
      );
      if (res.ok) {
        const fresh = (await res.json())?.data ?? null;
        if (import.meta.env.DEV && fresh?.doc_version == null) {
          console.warn("[PO] GET คืน 200 แต่ไม่มี doc_version — ใช้ค่าในฟอร์มแทน");
        }
        return fresh;
      }
      if (import.meta.env.DEV)
        console.warn("[PO] ดึง doc_version สดไม่สำเร็จ", res.status);
    } catch (err) {
      // ยังคืน null (ไม่ throw) เพราะ GET ล้มไม่ควรทำให้บันทึกไม่ได้เลย — แต่ต้อง
      // ไม่เงียบ ผลของ fallback คือส่งเลขเก่า ซึ่งจบที่ 409 ปลายทาง
      if (import.meta.env.DEV) console.warn("[PO] ดึง doc_version สดไม่สำเร็จ", err);
    }
    return null;
  };

  const resolveDocVersion = (fresh: { doc_version?: number } | null): number =>
    pickDocVersion(
      fresh?.doc_version,
      form.getValues("doc_version"),
      purchaseOrder?.doc_version,
    );

  /**
   * ส่ง/อนุมัติสำเร็จ → กลับหน้ารายการ (กติกาเดียวกับ PR)
   *
   * ต้อง `setIsSubmitting(true)` ก่อนยิง mutation ไม่ใช่ตอนสำเร็จ — nav guard
   * เฝ้าอยู่เมื่อ mode เป็น add/edit และฟอร์ม dirty ซึ่งเป็นสถานะปกติของผู้อนุมัติ
   * ที่เพิ่งติ๊กแถว (ติ๊กแล้ว setValue ทำให้ dirty) ถ้าไม่ปิด guard ก่อน การ
   * navigate ตอนสำเร็จจะไปโผล่ dialog ถามว่าจะทิ้งการแก้ไขไหม ทั้งที่บันทึกไปแล้ว
   */
  const onSuccessList = (msg: string) => () => {
    toast.success(msg);
    toList();
  };

  const runSubmitPo = async () => {
    if (!purchaseOrder) return;
    setIsSubmitting(true);
    const fresh = await fetchFreshPo();
    const detailRows: { id: string }[] = Array.isArray(
      fresh?.purchase_order_detail,
    )
      ? fresh.purchase_order_detail
      : (purchaseOrder.purchase_order_detail ?? []);
    submitPo.mutate(
      {
        id: purchaseOrder.id,
        stage_role: "create",
        doc_version: resolveDocVersion(fresh),
        details: detailRows.map((d) => ({
          id: d.id,
          stage_status: "submit",
          stage_message: null,
        })),
      },
      {
        onSuccess: onSuccessList(t("submitted")),
        onError: () => setIsSubmitting(false),
      },
    );
  };

  /**
   * "บันทึก" กับ "ส่ง" คนละมาตรฐานกันเรื่องจำนวนและราคา
   *
   * ร่างที่ยังไม่รู้ยอด/ยังไม่ได้ราคาจากผู้ขายต้องเซฟไว้ก่อนได้ schema จึงเป็น
   * `min(0)` ทั้งคู่ — แต่ใบที่ส่งเข้าลำดับอนุมัติแล้วมีแถวจำนวน 0 หรือราคา 0
   * คือใบที่ให้คนอนุมัติเซ็นของที่ไม่มีจำนวนหรือไม่มีมูลค่า เช็คเพิ่มเป็นชั้นที่สอง
   * ตรงนี้ ไม่ยัดเข้า schema เพราะ schema ตัวเดียวกันถูกใช้ทั้งสองปุ่ม
   *
   * ขั้นต่ำจริงของจำนวนขึ้นกับทศนิยมของหน่วย (2 ตำแหน่ง = 0.01) ซึ่ง "มากกว่า 0"
   * ครอบให้อยู่แล้ว ไม่ต้องไปคำนวณขั้นต่ำรายหน่วยซ้ำ
   *
   * @returns ผ่านไหม — ไม่ผ่านจะ setError ไว้ที่ช่องที่ผิดของแถวนั้นให้เลย
   */
  const validateSubmitItems = (): boolean => {
    let ok = true;
    form.getValues("items").forEach((item, index) => {
      // แถวที่มีของแถมเกิดขึ้นจริง = บรรทัดนั้นมีของเข้ามาแล้ว ไม่ต้องมีทั้งจำนวน
      // สั่งและราคา (ผู้ขายแถมมาให้เฉย ๆ สั่ง 0 จ่าย 0 แต่ได้ของ) ข้ามทั้งแถว
      if (Number(item.foc_qty) > 0) return;
      if (!(Number(item.order_qty) > 0)) {
        form.setError(`items.${index}.order_qty`, {
          type: "manual",
          message: tv("positive", { field: tfl("qty") }),
        });
        ok = false;
      }
      // ทั้งบรรทัดเป็นของแถม (is_foc) ก็ไม่มีราคาเหมือนกัน — แต่ยังต้องมีจำนวนสั่ง
      // เพราะมันคือ "ของที่สั่งแล้วไม่คิดเงิน" ไม่ใช่ "ของที่แถมมาโดยไม่ได้สั่ง"
      if (!item.is_foc && !(Number(item.price) > 0)) {
        form.setError(`items.${index}.price`, {
          type: "manual",
          message: tv("positive", { field: tfl("unitPrice") }),
        });
        ok = false;
      }
    });
    return ok;
  };

  /**
   * ตรวจก่อนเปิดกล่องยืนยันส่งใบ — ติดตรงไหนต้องรู้**ก่อน**ตอบว่า "ส่ง"
   *
   * ของเดิมเปิดกล่องยืนยันทันที แล้วค่อย validate ข้างใน `handleSubmitPo` ผู้ใช้จึง
   * ต้องกดยืนยันเสร็จก่อนถึงจะรู้ว่ากรอกไม่ครบ — ถามแล้วตอบแล้วค่อยบอกว่าทำไม่ได้
   * (ทรงเดียวกับ PR: `validateSubmitPr`)
   *
   * toast/scroll ทำในนี้ที่เดียว ผู้เรียกแค่ return เฉย ๆ เมื่อได้ false
   * — อย่าไปเติม toast ซ้ำที่ปุ่ม ไม่งั้นเด้งสองใบ
   */
  const validateSubmitPo = async (): Promise<boolean> => {
    const valid = await form.trigger();
    // เรียกหลัง trigger เสมอ — trigger เขียน errors ทั้งชุดใหม่จาก resolver
    // เรียกก่อนหน้าจะโดนล้างทิ้ง
    const itemsOk = validateSubmitItems();
    if (!valid || !itemsOk) {
      // เด้งเข้าโหมดแก้ไขให้เลย — ในโหมดอ่านทุกเซลล์เป็นตัวหนังสือ ช่องที่ผิดจึง
      // ไม่มีขอบแดงให้เห็นและกดแก้ไม่ได้ ผู้ใช้จะได้แค่ toast แล้วไม่รู้จะทำอะไรต่อ
      // (setMode ซ้ำค่าเดิมตอนอยู่โหมดแก้อยู่แล้ว React bail ให้เอง)
      setMode("edit");
      revealErrors(form.formState.errors as Record<string, unknown>);
      return false;
    }
    return true;
  };

  /**
   * ใบที่ยังไม่เคยเซฟ — สร้างแล้วส่งต่อในคลิกเดียว (ทรงเดียวกับ `doCreateAndSubmitPr`)
   *
   * ของเดิมปุ่มส่งไม่โผล่เลยจนกว่าจะกด Save ก่อน ซึ่งเป็นสองสเต็ปที่ไม่มีเหตุผล —
   * คนกดส่งย่อมตั้งใจให้ใบถูกบันทึกอยู่แล้ว
   */
  const createThenSubmitPo = async () => {
    setIsSubmitting(true);
    const values = form.getValues();
    try {
      const res = await createPo.mutateAsync(
        buildPoPayload(values, defaultValues.items, poTypeOption),
      );
      const body = res as {
        data?: { id?: string; doc_version?: number };
      } | null;
      const newId = body?.data?.id;
      if (!newId) {
        setIsSubmitting(false);
        return;
      }
      // ต้อง GET ใบสดหลังสร้าง — id ของ detail แต่ละแถวเพิ่งเกิดตอนนี้ ฟอร์มยัง
      // ไม่รู้จัก และ submit ต้องอ้าง id พวกนั้น
      const fresh = await fetchFreshPo(newId);
      submitPo.mutate(
        {
          id: newId,
          stage_role: "create",
          doc_version: pickDocVersion(
            fresh?.doc_version,
            body?.data?.doc_version,
          ),
          details: (fresh?.purchase_order_detail ?? []).map((d) => ({
            id: d.id,
            stage_status: "submit",
            stage_message: null,
          })),
        },
        {
          onSuccess: onSuccessList(t("submitted")),
          onError: () => setIsSubmitting(false),
        },
      );
    } catch {
      // toast ขึ้นจาก MutationCache กลางแล้ว
      setIsSubmitting(false);
    }
  };

  const handleSubmitPo = async () => {
    if (!purchaseOrder) {
      await createThenSubmitPo();
      return;
    }
    if (form.formState.isDirty) {
      const valid = await form.trigger();
      const itemsOk = validateSubmitItems();
      if (!valid || !itemsOk) {
        // เหตุผลเดียวกับใน validateSubmitPo — ติดตรงไหนต้องแก้ได้ทันที
        setMode("edit");
        // revealErrors บอกเองแล้วว่าขาดกี่รายการ — toast ซ้ำสองใบไม่ได้ช่วยอะไร
        revealErrors(form.formState.errors as Record<string, unknown>);
        return;
      }
      const values = form.getValues();
      const fresh = await fetchFreshPo();
      const payload = buildPoPayload(values, defaultValues.items, {
        ...poTypeOption,
        docVersion: resolveDocVersion(fresh),
        freshDetails: fresh?.purchase_order_detail,
      });
      try {
        const saved = await updatePo.mutateAsync({
          id: purchaseOrder.id,
          ...payload,
        });
        syncDocVersions(saved);
        // ไม่ toast ตรงนี้ — เดี๋ยว runSubmitPo บอกว่า "ส่งแล้ว" ซึ่งกินความหมาย
        // ของ "บันทึกแล้ว" อยู่ในตัว สองใบซ้อนกันใบแรกก็โดนใบหลังทับอยู่ดี
        // (CN/PR เดินทางเดียวกันแต่ยิงใบเดียวมาตั้งแต่แรก)
        setMode("view");
        // เหตุผลเดียวกับใน onSubmit — บันทึกแล้วต้องไม่เหลือของค้าง
        form.reset(form.getValues());
        await runSubmitPo();
        return;
      } catch {
        // toast ขึ้นจาก MutationCache กลางแล้ว — แค่หยุดไม่ยิง action ต่อ
        return;
      }
    }

    await runSubmitPo();
  };

  const handleApprovePo = async () => {
    if (!purchaseOrder) return;
    setIsSubmitting(true);
    const fresh = await fetchFreshPo();
    approvePo.mutate(
      {
        id: purchaseOrder.id,
        stage_role: role ?? "",
        doc_version: resolveDocVersion(fresh),
        details: buildDetailsFromForm(),
      },
      {
        onSuccess: onSuccessList(t("approved")),
        onError: () => setIsSubmitting(false),
      },
    );
  };

  const handleRejectConfirm = async (messages: Record<number, string>) => {
    if (!purchaseOrder) return;
    const message = messages[0] ?? "";
    const fresh = await fetchFreshPo();
    rejectPo.mutate(
      {
        id: purchaseOrder.id,
        stage_role: role ?? "",
        doc_version: resolveDocVersion(fresh),
        details: buildDetailsFromForm().map((d) => ({
          ...d,
          stage_status: d.stage_status || "reject",
          stage_message: d.stage_message || message || null,
        })),
      },
      {
        onSuccess: () => {
          toast.success(t("rejected"));
          setShowReject(false);
          setMode("view");
        },
      },
    );
  };

  // PR pattern: per-item messages keyed by item index, footer manages dialog state
  const handleReviewConfirm = async (
    messages: Record<number, string>,
    desStage: string,
  ) => {
    if (!purchaseOrder) return;
    const fresh = await fetchFreshPo();
    reviewPo.mutate(
      {
        id: purchaseOrder.id,
        stage_role: role ?? "",
        doc_version: resolveDocVersion(fresh),
        des_stage: desStage || undefined,
        details: buildDetailsFromForm().map((d, i) => ({
          ...d,
          stage_status: d.stage_status || "review",
          stage_message: messages[i] || d.stage_message || null,
        })),
      },
      {
        onSuccess: () => {
          toast.success(t("sentBack"));
          setMode("view");
        },
      },
    );
  };

  const handleClosePo = () => {
    if (!purchaseOrder) return;
    closePo.mutate(purchaseOrder.id, {
      onSuccess: () => {
        toast.success(t("closed"));
        setShowClose(false);
      },
    });
  };

  const handleDeleteConfirm = () => {
    if (!purchaseOrder) return;
    deletePo.mutate(purchaseOrder.id, {
      onSuccess: () => {
        toast.success(tt("deleteSuccess", { entity: t("entity") }));
        toList();
      },
    });
  };

  return {
    createPo,
    updatePo,
    deletePo,
    submitPo,
    approvePo,
    rejectPo,
    reviewPo,
    closePo,
    isPending,
    onSubmit,
    handleCancel,
    handleBack,
    validateSubmitPo,
    handleSubmitPo,
    handleApprovePo,
    handleRejectConfirm,
    handleReviewConfirm,
    handleClosePo,
    handleDeleteConfirm,
    discardDialogProps: discard.dialogProps,
    navDiscardDialogProps,
  };
}
