import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";
import { DocFormHeader } from "@/components/share/doc-form-header";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { RowSelectionState } from "@tanstack/react-table";
import { ArrowRight, Check, ClipboardCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { useBuCode } from "@/hooks/use-bu-code";
import { useDiscardConfirm } from "@/hooks/use-discard-confirm";
import { useErrorToast } from "@/hooks/use-error-toast";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { useProfile } from "@/hooks/use-profile";
import { httpClient } from "@/lib/http-client";
import { ApiError } from "@/lib/api-error";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type { GroupPrPo } from "@/types/purchase-order";
import { StepSelectPr } from "./step-select-pr";
import { StepReviewGroup } from "./step-review-group";
import { StepResult, type ConfirmPrResult } from "./step-result";

type Step = 1 | 2;

const LAST_STEP: Step = 2;

const STEPS: ReadonlyArray<{
  readonly step: Step;
  readonly labelKey: "stepSelectPr" | "stepReviewPo";
}> = [
  { step: 1, labelKey: "stepSelectPr" },
  { step: 2, labelKey: "stepReviewPo" },
];

const PO_LIST_PATH = "/procurement/purchase-order";
const COMPLETED_INDICATOR = <Check className="size-3" aria-hidden="true" />;

export function FromPrContent() {
  const navigate = useNavigate();
  const t = useTranslations("procurement.purchaseOrder");
  const tc = useTranslations("common");
  const tt = useTranslations("toast");
  const buCode = useBuCode();
  const { userId, data: profile } = useProfile();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();

  const [step, setStep] = useState<Step>(1);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [groupedData, setGroupedData] = useState<GroupPrPo[]>([]);
  const [groupWorkflowName, setGroupWorkflowName] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [isGrouping, setIsGrouping] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<ConfirmPrResult | null>(null);

  const isPending = isGrouping || isConfirming;
  const selectedPrIds = Object.keys(rowSelection).filter(
    (id) => rowSelection[id],
  );
  const selectedCount = selectedPrIds.length;
  const isDirty = (!!workflowId || selectedCount > 0) && !isConfirming;
  const discard = useDiscardConfirm({ isDirty, isPending });
  const handleCancel = () => discard.confirm(() => navigate(PO_LIST_PATH));
  const navGuard = useNavigationGuard(isDirty && !isPending);

  const handleBack = () => setStep(1);

  const handleNext = async () => {
    if (selectedCount === 0 || !buCode) return;

    setIsGrouping(true);
    try {
      const res = await httpClient.post(
        API_ENDPOINTS.PURCHASE_ORDER_GROUP_PR(buCode),
        { pr_ids: selectedPrIds },
      );
      if (!res.ok) throw await ApiError.from(res, "Failed to group PRs");
      const json = await res.json();
      setGroupedData(json.data.groups);
      setGroupWorkflowName(json.data.workflow?.name ?? "");
      setStep(2);
    } catch (err) {
      errorToast(err);
    } finally {
      setIsGrouping(false);
    }
  };

  const handleStepChange = (value: number) => {
    if (isPending) return;
    if (value <= step) setStep(Math.max(1, value) as Step);
  };

  const handleConfirm = async () => {
    if (selectedCount === 0 || !buCode) return;

    setIsConfirming(true);
    try {
      const buyerName = [
        profile?.user_info.firstname,
        profile?.user_info.lastname,
      ]
        .filter(Boolean)
        .join(" ");
      const res = await httpClient.post(
        API_ENDPOINTS.PURCHASE_ORDER_CONFIRM_PR(buCode),
        {
          workflow_id: workflowId,
          pr_ids: selectedPrIds,
          buyer_id: userId,
          buyer_name: buyerName,
        },
      );
      if (!res.ok) throw await ApiError.from(res, "Failed to confirm PRs");
      const json = await res.json();
      toast.success(tt("createSuccess", { entity: t("entity") }));
      await queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.PURCHASE_ORDERS],
      });
      // ไม่เด้งกลับ list — backend ส่งใบที่สร้างมาให้ครบแล้ว โชว์ให้เห็นว่าได้
      // อะไรมาบ้างพร้อมลิงก์เข้าใบ ดีกว่าให้ไปไล่หาเองในรายการพันใบ
      setConfirmOpen(false);
      setResult(json.data as ConfirmPrResult);
    } catch (err) {
      errorToast(err);
      setIsConfirming(false);
    }
  };

  // สร้างเสร็จแล้ว = จบงาน หน้าสรุปทับทั้งหน้า ไม่เหลือ stepper/ปุ่มของขั้นตอนเดิม
  // ให้กดย้อนกลับไปสร้างซ้ำจากชุดเดิม (PR ที่ใช้ไปแล้วเลือกซ้ำไม่ได้)
  if (result) return <StepResult result={result} />;

  return (
    <div className="flex flex-col gap-4 p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <DocFormHeader
        flush
        title={t("fromPr")}
        subtitle={t("fromPrDesc")}
        onBack={handleCancel}
        actions={
          step === LAST_STEP && (
            <Button
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={isConfirming}
            >
              {isConfirming ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <ClipboardCheck aria-hidden="true" />
              )}
              {tc("confirm")}
            </Button>
          )
        }
      />

      <Stepper
        value={step}
        onValueChange={handleStepChange}
        indicators={{ completed: COMPLETED_INDICATOR }}
      >
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
            <StepSelectPr
              workflowId={workflowId}
              onWorkflowChange={setWorkflowId}
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
              disabled={isGrouping}
            />
          </StepperContent>
          <StepperContent value={2}>
            <StepReviewGroup
              data={groupedData}
              workflowName={groupWorkflowName}
            />
          </StepperContent>
        </StepperPanel>
      </Stepper>

      <footer className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky bottom-0 flex items-center justify-between py-3 backdrop-blur">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={isPending}
        >
          {tc("cancel")}
        </Button>
        <div className="flex gap-2">
          {step > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              disabled={isPending}
            >
              {tc("back")}
            </Button>
          )}
          {step < LAST_STEP && (
            <Button
              size="sm"
              onClick={handleNext}
              disabled={selectedCount === 0 || !workflowId || isGrouping}
            >
              {isGrouping ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <ArrowRight aria-hidden="true" />
              )}
              {tc("next")}
            </Button>
          )}
        </div>
      </footer>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("confirmCreateTitle")}
        description={t("confirmCreateDesc", {
          poCount: groupedData.length,
          prCount: selectedCount,
        })}
        isPending={isConfirming}
        onConfirm={handleConfirm}
        confirmText={tc("confirm")}
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
    </div>
  );
}
