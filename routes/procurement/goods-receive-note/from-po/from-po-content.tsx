import { useState } from "react";
import { useListReturn } from "@/hooks/use-list-return";
import { useTranslations } from "use-intl";
import { DocFormHeader } from "@/components/share/doc-form-header";
import { toast } from "sonner";
import { ArrowRight, Check, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { setSessionItem } from "@/lib/safe-storage";
import { usePurchaseOrderForGrnByVendor } from "../../shared/use-purchase-order";
import type { VendorForGrn } from "@/types/purchase-order";
import { mapPoDetailToItems } from "../grn-item-table";
import { GrnPoSelectList } from "../grn-po-select-list";
import { pickSelectedPos } from "../grn-po-usable";
import { StepSelectVendor } from "./step-select-vendor";

type Step = 1 | 2;

const LAST_STEP: Step = 2;

const STEPS: ReadonlyArray<{
  readonly step: Step;
  readonly labelKey: "wizardVendorTitle" | "wizardPoTitle";
}> = [
  { step: 1, labelKey: "wizardVendorTitle" },
  { step: 2, labelKey: "wizardPoTitle" },
];

const GRN_LIST_PATH = "/procurement/goods-receive-note";
const GRN_NEW_PATH = `${GRN_LIST_PATH}/new?doc_type=purchase_order`;
const COMPLETED_INDICATOR = <Check className="size-3" aria-hidden="true" />;

/**
 * สร้างใบรับสินค้าจากใบสั่งซื้อ — หน้าเต็ม 2 ขั้น (ทรงเดียวกับ wizard ของใบสั่งซื้อ)
 *
 * หน้านี้ไม่สร้างเอกสารเอง แค่ประกอบของที่เลือกไว้ส่งต่อให้ฟอร์มใบรับสินค้าผ่าน
 * sessionStorage แล้วพาไปหน้า `/new` — เหตุผลที่ไม่ส่งผ่าน state ของ router คือ
 * ฟอร์มต้องรอดจากการรีเฟรชหน้าด้วย (ดู grn-form.tsx ที่เคลียร์คีย์นี้ตอน unmount)
 */
export function FromPoContent() {
  const { toList, returnState } = useListReturn(GRN_LIST_PATH);
  const t = useTranslations("procurement.goodsReceiveNote");
  const tc = useTranslations("common");

  const [step, setStep] = useState<Step>(1);
  const [vendor, setVendor] = useState<VendorForGrn | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = usePurchaseOrderForGrnByVendor(
    vendor?.vendor_id ?? "",
  );
  const poList = data?.data ?? [];

  // "ของค้าง" = เลือกอะไรไปแล้วก็นับ ตั้งแต่ผู้ขาย — ไม่ใช่รอจนติ๊กรายการ
  const isDirty = !!vendor || selected.size > 0;
  const discard = useDiscardConfirm({ isDirty });
  // ปุ่มยกเลิกกับลูกศรย้อนกลับเรียก navigate() ตรง ๆ ซึ่ง useNavigationGuard
  // ดักไม่ได้ (ดักแค่คลิกลิงก์กับปุ่ม Back ของเบราว์เซอร์)
  const handleCancel = () => discard.confirm(() => toList());
  const navGuard = useNavigationGuard(isDirty);

  const handleSelectVendor = (next: VendorForGrn) => {
    // เปลี่ยนผู้ขาย = รายการที่ติ๊กไว้เป็นของผู้ขายเดิมทั้งหมด ล้างทิ้ง
    if (next.vendor_id !== vendor?.vendor_id) setSelected(new Set());
    setVendor(next);
  };

  const handleStepChange = (value: number) => {
    // ถอยกลับได้เสมอ ส่วนเดินหน้าต้องมีผู้ขายก่อน
    if (value <= step || vendor)
      setStep(Math.min(LAST_STEP, Math.max(1, value)) as Step);
  };

  const handleConfirm = () => {
    const result = pickSelectedPos(poList, selected);
    if (result.length === 0 || !vendor) return;

    const first = result[0];
    // กัน PO ต่างสกุลเงินถูกยัดเข้าใบเดียวด้วยเรตของ PO ใบแรก (พังเงียบ)
    if (result.some((po) => po.currency_id !== first.currency_id)) {
      // เลือกได้แต่ทำต่อไม่ได้ = เตือนให้เลือกใหม่ ไม่ใช่ระบบพัง → warning
      toast.warning(t("mixedCurrencyError"));
      return;
    }

    setSessionItem("grn-wizard-data", {
      vendorId: vendor.vendor_id,
      vendorName: vendor.vendor_name,
      currencyId: first.currency_id,
      currencyCode: first.currency_code,
      exchangeRate: first.exchange_rate,
      items: result.flatMap(
        (po) =>
          po.po_detail?.flatMap((d) =>
            mapPoDetailToItems(d, po.id, po.po_no),
          ) ?? [],
      ),
    });
    // ไปหน้าฟอร์มด้วย leave() ไม่ใช่ navigate() — guard ยังถืออยู่และ sentinel
    // ของมันอยู่บนสุด push ทับแล้วจะโดน history.back() ของ teardown ดึงกลับมา
    // ที่ wizard ทันที (= กด confirm แล้วหน้าไม่ไปไหน)
    navGuard.leave(GRN_NEW_PATH, returnState?.state);
  };

  return (
    <div className="flex flex-col gap-4 p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <DocFormHeader
        flush
        title={t("fromPo")}
        subtitle={t("fromPoDesc")}
        onBack={handleCancel}
        badges={
          selected.size > 0 && (
            <Badge className="tabular-nums">
              {t("nSelected", { count: selected.size })}
            </Badge>
          )
        }
      />

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
          <StepperContent value={1}>
            <StepSelectVendor
              vendorId={vendor?.vendor_id ?? ""}
              onSelect={handleSelectVendor}
            />
          </StepperContent>
          <StepperContent value={2}>
            <GrnPoSelectList
              poList={poList}
              isLoading={isLoading}
              selected={selected}
              onChange={setSelected}
            />
          </StepperContent>
        </StepperPanel>
      </Stepper>

      <footer className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky bottom-0 flex items-center justify-between py-3 backdrop-blur">
        <Button variant="outline" size="sm" onClick={handleCancel}>
          {tc("cancel")}
        </Button>
        <div className="flex gap-2">
          {step > 1 && (
            <Button variant="outline" size="sm" onClick={() => setStep(1)}>
              {tc("back")}
            </Button>
          )}
          {step < LAST_STEP && (
            <Button size="sm" onClick={() => setStep(2)} disabled={!vendor}>
              {tc("next")}
              <ArrowRight aria-hidden="true" />
            </Button>
          )}
          {step === LAST_STEP && (
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={selected.size === 0}
            >
              <ClipboardCheck aria-hidden="true" />
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
