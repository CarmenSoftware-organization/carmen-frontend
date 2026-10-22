import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";
import { DocFormHeader } from "@/components/share/doc-form-header";
import { toast } from "sonner";
import {
  useForm,
  useFormState,
  useWatch,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, ClipboardCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@/components/ui/stepper";
import { useDiscardConfirm } from "@/hooks/use-discard-confirm";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { useProfile } from "@/hooks/use-profile";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import { useCreatePurchaseOrder } from "../../shared/use-purchase-order";
import { PO_TYPE } from "@/types/purchase-order";
import { createPoSchema } from "../po-form-schema";
import { buildPoPayload } from "../build-po-payload";
import {
  getDefaultValues,
  type FromPriceListFormValues,
} from "./from-price-list-form-schema";
import { StepOrderDetails } from "./step-order-details";
import { StepSelectVendors } from "./step-select-vendors";
import { StepSelectItems } from "./step-select-items";
import { StepSummary } from "./step-summary";

type Step = 1 | 2 | 3;

const LAST_STEP: Step = 3;

const STEPS: ReadonlyArray<{
  readonly step: Step;
  readonly labelKey:
    "fromPriceListStep1" | "fromPriceListStep2" | "fromPriceListStep3";
  readonly descKey:
    | "fromPriceListStep1Desc"
    | "fromPriceListStep2Desc"
    | "fromPriceListStep3Desc";
}> = [
  {
    step: 1,
    labelKey: "fromPriceListStep1",
    descKey: "fromPriceListStep1Desc",
  },
  {
    step: 2,
    labelKey: "fromPriceListStep2",
    descKey: "fromPriceListStep2Desc",
  },
  {
    step: 3,
    labelKey: "fromPriceListStep3",
    descKey: "fromPriceListStep3Desc",
  },
];

const PO_LIST_PATH = "/procurement/purchase-order";
const COMPLETED_INDICATOR = <Check className="size-3" aria-hidden="true" />;

// Only fields the user can edit on Step 1 — order_date, buyer_*, department_* are
// read-only seeds from useProfile() and never need validation.
// ผู้ขายอยู่ step เดียวกับวันส่งมอบเพราะรายชื่อผู้ขายมาจากวันนั้น — แยกหน้ากันแล้ว
// ต้องเด้งกลับไปกลับมาเมื่อเลือกวันผิด
const STEP_1_FIELDS = ["workflow_id", "delivery_date", "vendor_id"] as const;
const STEP_2_FIELDS = ["items"] as const;

export function FromPriceListContent() {
  const navigate = useNavigate();
  const t = useTranslations("procurement.purchaseOrder");
  const tc = useTranslations("common");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");
  const tf = useTranslations("field");
  const profile = useProfile();

  const [step, setStep] = useState<Step>(1);

  const poSchema = createPoSchema(tv, tf, true);

  const form = useForm<FromPriceListFormValues>({
    resolver: zodResolver(
      poSchema,
    ) as unknown as Resolver<FromPriceListFormValues>,
    defaultValues: getDefaultValues({
      userId: profile.userId,
      fullName: profile.fullName,
      email: profile.data?.email,
    }),
  });

  const profileSeedRef = useRef({
    userId: profile.userId,
    fullName: profile.fullName,
    email: profile.data?.email,
  });

  useEffect(() => {
    profileSeedRef.current = {
      userId: profile.userId,
      fullName: profile.fullName,
      email: profile.data?.email,
    };
  });

  useEffect(() => {
    if (!profile.isProfileReady) return;
    form.reset(getDefaultValues(profileSeedRef.current));
  }, [profile.isProfileReady, form]);

  const handleBack = () => setStep((s) => Math.max(1, s - 1) as Step);

  const validateCurrentStep = async (current: Step) => {
    if (current === 1) {
      const ok = await form.trigger(STEP_1_FIELDS);
      if (!ok) {
        scrollToFirstInvalidField();
        return false;
      }
    }
    if (current === 2) {
      const ok = await form.trigger(STEP_2_FIELDS);
      if (!ok) {
        scrollToFirstInvalidField();
        return false;
      }
    }
    return true;
  };

  // Reactive validity ของ step ปัจจุบัน — ใช้ disable ปุ่ม Next
  // (required field ว่าง หรือมี error ค้างอยู่ → ปิดปุ่ม)
  const watchedWorkflowId = useWatch({
    control: form.control,
    name: "workflow_id",
  });
  const watchedDeliveryDate = useWatch({
    control: form.control,
    name: "delivery_date",
  });
  const watchedVendorId = useWatch({
    control: form.control,
    name: "vendor_id",
  });
  const watchedItems = useWatch({ control: form.control, name: "items" });
  const { errors, isDirty } = useFormState({ control: form.control });

  const createPo = useCreatePurchaseOrder();

  // ทิ้งของที่กรอกไว้ต้องถามก่อน — wizard เป็นหน้าเต็ม ไม่ใช่ dialog เล็ก ๆ ที่ปิด
  // แล้วเปิดใหม่ก็กรอกใหม่ได้ กว่าจะมาถึง step 2 ผู้ใช้ติ๊กสินค้าไปหลายสิบแถวแล้ว
  const discard = useDiscardConfirm({
    isDirty,
    isPending: createPo.isPending,
  });

  // ปุ่ม Cancel กับลูกศรย้อนกลับเรียก navigate() ตรง ๆ ซึ่ง useNavigationGuard
  // ดักไม่ได้ (มันดักแค่คลิกลิงก์กับปุ่ม Back ของเบราว์เซอร์) — สองทางออกนี้จึงต้อง
  // ผ่าน discard.confirm เอง
  const handleCancel = () => discard.confirm(() => navigate(PO_LIST_PATH));

  // ปิด guard ตั้งแต่เริ่มยิง API — sentinel ที่ค้างอยู่จะทำให้ปุ่ม Back จากหน้าใบที่
  // เพิ่งสร้างเด้งกลับมาที่ wizard (กับดักเดียวกับตอน create ของฟอร์มอื่น)
  const navGuard = useNavigationGuard(
    isDirty && !createPo.isPending && !createPo.isSuccess,
  );

  // ทุก item ต้องเลือก delivery location ครบทุกแถวก่อนไปหน้าตรวจสอบ
  // (location id เป็น required ใน schema — ถ้าปล่อยว่างจะ fail ตอน confirm)
  const allItemsHaveLocation =
    (watchedItems?.length ?? 0) > 0 &&
    (watchedItems ?? []).every((it) => !!it.location_id);

  const stepValidity: Record<Step, boolean> = {
    1:
      !!watchedWorkflowId &&
      !!watchedDeliveryDate &&
      !!watchedVendorId &&
      !errors.workflow_id &&
      !errors.delivery_date &&
      !errors.vendor_id,
    2: allItemsHaveLocation && !errors.items,
    3: true,
  };
  const isCurrentStepValid = stepValidity[step];

  const handleNext = async () => {
    const ok = await validateCurrentStep(step);
    if (!ok) return;
    setStep((s) => Math.min(LAST_STEP, s + 1) as Step);
  };

  const handleStepChange = async (v: number) => {
    if (createPo.isPending) return;
    const target = Math.min(LAST_STEP, Math.max(1, v)) as Step;
    if (target <= step) {
      setStep(target);
      return;
    }
    const ok = await validateCurrentStep(step);
    if (!ok) return;
    setStep(target);
  };

  const handleEditStep = (target: 1 | 2) => setStep(target);

  const handleConfirm = async () => {
    if (createPo.isPending) return;
    // Validate all wizard fields ก่อน confirm (Step 1-2); Step 3 = review เฉย ๆ
    const ok = await form.trigger();
    if (!ok) {
      // Jump กลับ step ที่มี field ผิดเพื่อให้ user เห็น + แก้ได้
      // currency_id/order_date/exchange_rate validate เฉพาะตอนนี้ (ไม่อยู่ใน
      // STEP_*_FIELDS) — else ปิดท้ายไป Step 2 กันกรณี error หลุดทุกเงื่อนไข
      // ไม่งั้นปุ่มจะกดแล้วเงียบโดยไม่มีอะไรบอก user
      const errs = form.formState.errors;
      if (
        errs.workflow_id ||
        errs.delivery_date ||
        errs.order_date ||
        errs.vendor_id
      )
        setStep(1);
      else setStep(2);
      // รอ DOM ของ step ปลายทาง mount ก่อนค่อย scroll + focus invalid field
      requestAnimationFrame(() => scrollToFirstInvalidField());
      // warning ไม่ใช่ error — ระบบไม่ได้พัง แค่ยังกรอกไม่ครบ (สีแดงเก็บไว้ให้
      // เรื่องที่ผู้ใช้แก้เองไม่ได้) และใช้ประโยคเดียวกับฟอร์ม PR/PO/GRN/CN/SR
      // ซึ่งบอกด้วยว่าพาไปที่ช่องที่ต้องแก้ให้แล้ว ตรงกับที่ wizard ทำจริง
      toast.warning(tv("incompleteDocument"));
      return;
    }
    // ตารางเลือกสินค้าเป็น 1 แถว = 1 สินค้า 1 คลัง อยู่แล้ว ตรงกับที่ PO นับ —
    // ไม่ต้องกาง/รวมอะไรก่อนสร้าง payload เหมือนตอนที่ยังเป็นการ์ดหลายคลัง
    const payload = buildPoPayload(form.getValues(), [], {
      po_type: PO_TYPE.PL,
    });
    createPo.mutate(payload, {
      onSuccess: (res) => {
        toast.success(tt("createSuccess", { entity: t("entity") }));
        const body = res as { data?: { id?: string } } | undefined;
        const newId = body?.data?.id;
        if (newId) {
          navigate(`${PO_LIST_PATH}/${newId}`);
        } else {
          navigate(PO_LIST_PATH);
        }
      },
    });
  };

  return (
    <div className="flex flex-col gap-4 p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <DocFormHeader
        flush
        title={t("fromPriceList")}
        subtitle={t("fromPriceListDesc")}
        onBack={handleCancel}
      />

      {/* Mobile + Tablet (< lg / 1024px): horizontal stepper on top */}
      <Stepper
        value={step}
        onValueChange={handleStepChange}
        indicators={{ completed: COMPLETED_INDICATOR }}
      >
        {/* แถบขั้นตอนกว้างเท่าที่มันต้องใช้ ไม่กางเต็มจอ — StepperNav บังคับ
            w-full ของตัวเองไว้ด้วย data-variant ซึ่งชนะ class ที่ส่งเข้าไป
            เลยต้องคุมความกว้างจากกล่องข้างนอกแทน · max-w-full กันจอแคบล้น */}
        <div className="mx-auto w-96 max-w-full">
          <StepperNav>
            {STEPS.map(({ step: s, labelKey }, i, arr) => (
              <StepperItem key={s} step={s}>
                <StepperTrigger className="flex-col gap-1">
                  <StepperIndicator>{s}</StepperIndicator>
                  <StepperTitle className="text-micro-legal font-semibold">
                    {t(labelKey)}
                  </StepperTitle>
                </StepperTrigger>
                {i < arr.length - 1 && (
                  <StepperSeparator className="group-data-[state=completed]/step:bg-primary" />
                )}
              </StepperItem>
            ))}
          </StepperNav>
        </div>
        <StepperPanel className="mt-4">
          <StepperContent value={1} className="space-y-4">
            <StepOrderDetails form={form} />
            <StepSelectVendors form={form} />
          </StepperContent>
          <StepperContent value={2}>
            <StepSelectItems form={form} />
          </StepperContent>
          <StepperContent value={3}>
            <StepSummary form={form} onEditStep={handleEditStep} />
          </StepperContent>
        </StepperPanel>
      </Stepper>

      <footer className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky bottom-0 flex items-center justify-between py-3 backdrop-blur">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={createPo.isPending}
        >
          {tc("cancel")}
        </Button>
        <div className="flex gap-2">
          {step > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              disabled={createPo.isPending}
            >
              {tc("back")}
            </Button>
          )}
          {step < LAST_STEP && (
            <Button
              size="sm"
              onClick={handleNext}
              disabled={createPo.isPending || !isCurrentStepValid}
            >
              {tc("next")}
              <ArrowRight aria-hidden="true" />
            </Button>
          )}
          {step === LAST_STEP && (
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={createPo.isPending}
            >
              {createPo.isPending ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <ClipboardCheck aria-hidden="true" />
              )}
              {tc("confirm")}
            </Button>
          )}
        </div>
      </footer>

      <DiscardDialog {...discard.dialogProps} variant="warning" />

      {/* ตัวเดียวกันแต่คนละต้นทาง — อันนี้ของคลิกลิงก์ใน sidebar กับปุ่ม Back
          ของเบราว์เซอร์ ซึ่ง useNavigationGuard ดักไว้ให้ */}
      <DiscardDialog
        open={navGuard.isOpen}
        onOpenChange={(o) => {
          if (!o) navGuard.cancel();
        }}
        onConfirm={navGuard.confirm}
        onCancel={navGuard.cancel}
        variant="warning"
      />
    </div>
  );
}
