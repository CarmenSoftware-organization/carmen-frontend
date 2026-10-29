import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { GoodsReceiveNote } from "@/types/goods-receive-note";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import type { FormMode } from "@/types/form";
import { GrnExtraCostFields } from "./grn-extra-cost-fields";
import { GrnStockTable } from "./grn-stock-table";
import {
  createGrnSchema,
  type GrnFormValues,
  getDefaultValues,
} from "./grn-form-schema";
import {
  countInvalidItems,
  scrollToFirstInvalidField,
  draftSaveHandler,
} from "@/lib/form-helpers";
import { getSessionItem, removeSessionItem } from "@/lib/safe-storage";
import { GrnItemTable } from "./grn-item-table";
import { GrnFormDialogs } from "./grn-form-dialogs";
import { GrnExpiredItemsDialog } from "./grn-expired-items-dialog";
import { useGrnFormActions } from "./use-grn-form-actions";
import { useProfile } from "@/hooks/use-profile";
import { FormPageShell } from "@/components/share/form-page-shell";
import { GrnHeader } from "./grn-header";
import { GrnSummaryFooter } from "./grn-summary-footer";
import { GrnFormHeader } from "./grn-form-header";

interface GrnFormProps {
  readonly goodsReceiveNote?: GoodsReceiveNote;
}

export function GrnForm({ goodsReceiveNote }: GrnFormProps) {
  "use no memo";
  const t = useTranslations("procurement.goodsReceiveNote");
  const tv = useTranslations("validation");
  const tfl = useTranslations("field");
  const [mode, setMode] = useState<FormMode>(goodsReceiveNote ? "view" : "add");
  const isView = mode === "view";

  const isCommitted = goodsReceiveNote?.doc_status === "committed";
  const isVoid = goodsReceiveNote?.doc_status === "voided";

  // ใบ saved แก้ได้เหมือนร่าง ยกเว้นบรรทัดที่เอกสารอื่นอ้างอิงแล้ว (lot ถูกตัด / มีใบลดหนี้อ้าง)
  // หลังบ้านบอกมาต่อบรรทัด · มีสักบรรทัดเมื่อไร ค่าใช้จ่ายเพิ่มเติม สกุลเงิน และอัตรา
  // ก็ล็อกทั้งใบด้วย เพราะสามอย่างนี้ตีมูลค่าบรรทัดที่ถูกล็อกใหม่
  const lockedLines = useMemo(
    () =>
      new Map(
        (goodsReceiveNote?.good_received_note_detail ?? [])
          .filter((detail) => detail.stock_lock_reasons?.length)
          .map((detail) => [detail.id, detail.stock_lock_reasons ?? []]),
      ),
    [goodsReceiveNote],
  );
  const hasStockLock = !!goodsReceiveNote?.has_stock_lock;

  const [searchParams] = useSearchParams();
  const docTypeParam = searchParams.get("doc_type");

  const [wizardData] = useState(() =>
    goodsReceiveNote
      ? null
      : (getSessionItem<{
          vendorId: string;
          vendorName: string;
          currencyId: string;
          currencyCode: string;
          exchangeRate: number;
          items?: GrnFormValues["items"];
        }>("grn-wizard-data") ?? null),
  );
  const fromWizard = !!wizardData;

  // ผู้รับ + แผนก โชว์ใต้เลขที่ใบอย่างเดียว ไม่เข้า payload · grn_date เป็นช่อง
  // กรอกจริงในฟอร์มแล้ว · defaultCurrency* ใช้เป็น currency เริ่มต้นของ GRN ใหม่
  const {
    defaultBu,
    data: profileData,
    defaultCurrencyId,
    defaultCurrencyCode,
  } = useProfile();

  const defaultValues = useMemo(() => {
    // currency default ของ BU set ตั้งแต่ getDefaultValues (mirror PO) — profile
    // โหลดตั้งแต่ boot จึงพร้อมตอน mount; wizard override ทับทีหลังถ้ามา from wizard
    const base = getDefaultValues(goodsReceiveNote, {
      defaultCurrencyId,
      defaultCurrencyCode,
    });
    if (goodsReceiveNote) return base;

    if (docTypeParam) base.doc_type = docTypeParam;

    if (!wizardData) return base;

    base.vendor_id = wizardData.vendorId;
    base.vendor_name = wizardData.vendorName;
    base.currency_id = wizardData.currencyId;
    base.currency_name = wizardData.currencyCode;
    base.exchange_rate = wizardData.exchangeRate;
    if (Array.isArray(wizardData.items) && wizardData.items.length > 0) {
      base.items = wizardData.items;
    }
    return base;
  }, [
    goodsReceiveNote,
    docTypeParam,
    wizardData,
    defaultCurrencyId,
    defaultCurrencyCode,
  ]);

  const form = useForm<GrnFormValues>({
    resolver: zodResolver(createGrnSchema(tv, tfl)) as Resolver<GrnFormValues>,
    defaultValues,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  // validation ไม่ผ่าน → บอกว่าติดกี่รายการ แล้วพาไปที่ช่องแรกที่ผิด · ไม่ต้อง
  // กางอะไรก่อนแล้ว ทุกช่องอยู่บนแถวเดียวกันตั้งแต่ตารางเลิกจัดกลุ่มสินค้า
  const revealErrors = (errors?: Record<string, unknown>) => {
    const count = countInvalidItems(errors);
    toast.warning(
      count > 0 ? tv("incompleteItems", { count }) : tv("incompleteDocument"),
    );
    scrollToFirstInvalidField();
  };

  const actions = useGrnFormActions({
    form,
    goodsReceiveNote,
    defaultValues,
    mode,
    setMode,
    revealErrors,
  });

  const isDisabled = isView || actions.isPending;

  // Rebaseline dirty state หลัง compute-sync ของ location (discount/tax/net/total)
  // settle. RHF คิด isDirty จาก !deepEqual(getValues(), defaultValues) → setValue
  // ค่า derived ที่ต่างจาก default ทำให้ dirty ค้าง → back/cancel ติด discard dialog
  // เกินจริง. reset(getValues, keepDirtyValues) ทำให้ค่า derived เป็น baseline
  // (ไม่นับ dirty) แต่คงค่าที่ผู้ใช้แก้ไว้ — ทำครั้งเดียวหลัง data พร้อม (mirror PO)
  const didRebaseline = useRef(false);
  useEffect(() => {
    if (didRebaseline.current) return;
    if (!goodsReceiveNote && !profileData) return;
    didRebaseline.current = true;
    form.reset(form.getValues(), { keepDirtyValues: true });
    // reset() re-validate ทั้งฟอร์ม → required field ที่ยังว่าง (เช่น currency
    // default ที่ header เพิ่งจะตั้งทีหลัง) โชว์ error แดงทั้งที่ user ยังไม่แตะ →
    // clear ทิ้ง (mode onChange จะ validate ใหม่เองเมื่อ user แก้จริง)
    form.clearErrors();
  }, [form, goodsReceiveNote, profileData]);

  // ข้อมูลที่ refetch มาหลังบันทึก (PATCH แล้วตามด้วย /save — หลังบ้านเดิน
  // doc_version ทั้งของใบและของแต่ละแถว) ต้อง rebase เข้าฟอร์มด้วย ไม่งั้นฟอร์ม
  // ถือ doc_version ของรอบก่อน แล้วการแก้รอบถัดไปชน 409 "มีคนอื่นแก้เอกสารนี้"
  // ทุกครั้งจนกว่าจะ refresh หน้า · เงื่อนไขคือ "ไม่มีของค้าง" ไม่ใช่ "โหมดอ่าน" —
  // ระหว่างผู้ใช้กรอกค้างห้ามทับ แต่หลังบันทึกเสร็จ (dirty ถูกล้าง) ต้อง rebase
  // ให้ได้แม้ยังอยู่หน้าเดิม
  useEffect(() => {
    if (!goodsReceiveNote || form.formState.isDirty) return;
    form.reset(defaultValues);
  }, [goodsReceiveNote, defaultValues, form]);

  const receivedByName =
    goodsReceiveNote?.received_by?.name ||
    [profileData?.user_info?.firstname, profileData?.user_info?.lastname]
      .filter(Boolean)
      .join(" ");
  const departmentName = defaultBu?.department?.name ?? "";

  const extraCostCount =
    useWatch({
      control: form.control,
      name: "extra_cost_details",
    })?.length ?? 0;

  // Clear wizard data on SPA navigation (unmount) but keep on browser refresh
  useEffect(() => {
    let isRefresh = false;
    const onBeforeUnload = () => {
      isRefresh = true;
    };
    globalThis.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      globalThis.removeEventListener("beforeunload", onBeforeUnload);
      if (!isRefresh) removeSessionItem("grn-wizard-data");
    };
  }, []);

  return (
    <FormPageShell
      width="wide"
      header={
        <GrnHeader
          goodsReceiveNote={goodsReceiveNote}
          mode={mode}
          isPending={actions.isPending}
          isCommitted={isCommitted}
          isVoid={isVoid}
          deleteIsPending={actions.deleteGrn.isPending}
          receivedByName={receivedByName}
          departmentName={departmentName}
          onBack={actions.handleBack}
          onEnterEdit={() => setMode("edit")}
          onCancel={actions.handleCancel}
          onShowComment={() => actions.setShowComment(true)}
          onShowDelete={() => actions.setShowDelete(true)}
          onSaveDraft={() => actions.handleSubmitWithStatus("draft")}
          // ใบ committed ต้องส่งสถานะเดิม — ส่ง "saved" จะทำให้ doc_status นับเป็นค่าที่เปลี่ยน
          // แล้วหลังบ้านปฏิเสธด้วย GRN_COMMITTED_HEADER_ONLY
          onSave={() =>
            actions.handleSubmitWithStatus(isCommitted ? "committed" : "saved")
          }
        />
      }
      footer={
        <GrnSummaryFooter
          form={form}
          isActionPending={actions.isActionPending}
          hasRecord={!!goodsReceiveNote}
          isView={mode === "view"}
          isCommitted={isCommitted}
          isVoid={isVoid}
          onCommit={actions.requestCommit}
          onVoid={() => actions.setShowVoid(true)}
        />
      }
    >
      <form
        id="grn-form"
        onSubmit={draftSaveHandler(form, actions.onSubmit)}
        className="space-y-3"
      >
        <GrnFormHeader
          form={form}
          disabled={isDisabled || isView}
          fromWizard={fromWizard}
          lockIdentity={goodsReceiveNote?.doc_status === "saved" || isCommitted}
          lockCommercial={isCommitted || hasStockLock}
        />

        {/* เส้นคั่นเต็มความกว้าง แยกข้อมูลหัวใบออกจากตารางรายการ (เหมือน PO)
            สองก้อนนี้อ่านคนละจังหวะ ก้อนบนอ่านทีเดียวจบ ก้อนล่างกวาดตาทีละแถว */}
        <hr className="border-border" />

        <Tabs defaultValue="general">
          <TabsList variant="line">
            <TabsTrigger value="general">{t("tabItems")}</TabsTrigger>
            <TabsTrigger value="extra-cost">
              {t("tabExtraCost")}
              {extraCostCount > 0 && (
                <Badge
                  variant="secondary"
                  size="xs"
                  className="ml-1.5 tabular-nums"
                >
                  {extraCostCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="stock">{t("tabStock")}</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <GrnItemTable
              form={form}
              disabled={isDisabled || isCommitted}
              lockedLines={lockedLines}
            />
          </TabsContent>
          <TabsContent value="extra-cost">
            {hasStockLock && !isView && !isCommitted && (
              <p className="text-muted-foreground pt-2 text-xs">
                {t("extraCostStockLocked")}
              </p>
            )}
            <GrnExtraCostFields
              form={form}
              disabled={isDisabled || isCommitted || hasStockLock}
            />
          </TabsContent>
          <TabsContent value="stock">
            <GrnStockTable
              grnId={goodsReceiveNote?.id}
              docStatus={goodsReceiveNote?.doc_status}
            />
          </TabsContent>
        </Tabs>
      </form>

      <DiscardDialog {...actions.discardDialogProps} variant="warning" />
      <DiscardDialog {...actions.navDiscardDialogProps} variant="warning" />
      {/* อยู่นอก GrnFormDialogs เพราะต้องขึ้นตอนสร้างใบใหม่ด้วย (ยังไม่มี goodsReceiveNote) */}
      <GrnExpiredItemsDialog {...actions.expiryDialogProps} />

      {goodsReceiveNote && (
        <GrnFormDialogs
          goodsReceiveNote={goodsReceiveNote}
          showDelete={actions.showDelete}
          setShowDelete={actions.setShowDelete}
          isDeletePending={actions.deleteGrn.isPending}
          onConfirmDelete={actions.handleConfirmDelete}
          showCommit={actions.showCommit}
          setShowCommit={actions.setShowCommit}
          isCommitPending={actions.isActionPending}
          isDraft={goodsReceiveNote?.doc_status === "draft"}
          grnDate={form.getValues("grn_date")}
          periodDateChoice={actions.periodDateChoice}
          onPeriodDateChoiceChange={actions.setPeriodDateChoice}
          onConfirmCommit={actions.handleConfirmCommit}
          showVoid={actions.showVoid}
          setShowVoid={actions.setShowVoid}
          isVoidPending={actions.voidGrn.isPending}
          onConfirmVoid={actions.handleConfirmVoid}
          showComment={actions.showComment}
          setShowComment={actions.setShowComment}
        />
      )}
    </FormPageShell>
  );
}
