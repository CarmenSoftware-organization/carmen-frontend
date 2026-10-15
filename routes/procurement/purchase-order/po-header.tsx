import { useState } from "react";
import { useTranslations } from "use-intl";
import { Building2, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocActionsMenu } from "@/components/share/doc-actions-menu";
import { WorkflowTrack } from "@/components/share/workflow-track";
import { WorkflowStepButton } from "@/components/share/workflow-step-button";
import { usePurchaseOrderComments } from "../shared/use-purchase-order";
import { PO_STATUS, type PurchaseOrder } from "@/types/purchase-order";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { PO_STATUS_CONFIG, PO_TYPE_CONFIG } from "@/constant/purchase-order";
import type { FormMode } from "@/types/form";
import { FormToolbar } from "@/components/share/form-toolbar";
import { PoSendEmailDialog } from "./po-send-email-dialog";

const SEND_EMAIL_STATUSES: readonly PO_STATUS[] = [
  PO_STATUS.APPROVED,
  PO_STATUS.SENT_OR_PRINT,
  PO_STATUS.PARTIAL,
  PO_STATUS.CLOSED,
  PO_STATUS.COMPLETED,
];

interface PoHeaderProps {
  readonly purchaseOrder?: PurchaseOrder;
  readonly mode: FormMode;
  readonly canEdit: boolean;
  readonly canClose: boolean;
  readonly terminalStatus: boolean;
  readonly isPending: boolean;
  readonly deletePoIsPending: boolean;
  readonly departmentName: string;
  readonly buyerName: string;
  readonly onBack: () => void;
  readonly onCancel: () => void;
  readonly onEnterEdit: () => void;
  readonly onShowClose: () => void;
  readonly onShowComment: () => void;
  readonly onShowDelete: () => void;
  readonly hasHistory?: boolean;
  readonly onShowHistory?: () => void;
}

export function PoHeader({
  purchaseOrder,
  mode,
  canEdit,
  canClose,
  terminalStatus,
  isPending,
  deletePoIsPending,
  departmentName,
  buyerName,
  onBack,
  onCancel,
  onEnterEdit,
  onShowClose,
  onShowComment,
  onShowDelete,
  hasHistory,
  onShowHistory,
}: PoHeaderProps) {
  const t = useTranslations("procurement.purchaseOrder");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const tf = useTranslations("form");
  const { total: commentCount } = usePurchaseOrderComments(purchaseOrder?.id);
  const [showSendEmail, setShowSendEmail] = useState(false);

  const isView = mode === "view";
  // ไม่ผูกกับโหมด view/edit — สถานะ partial ยังแก้ไขได้ (ไม่ใช่ terminalStatus) แต่
  // ต้องส่งอีเมลได้เหมือนกัน เอกสารที่ส่งจริงมาจาก DB ที่ persist แล้วเสมอ ไม่ใช่
  // ฟอร์มที่ยังไม่ได้บันทึก
  const canSendEmail =
    !!purchaseOrder && SEND_EMAIL_STATUSES.includes(purchaseOrder.po_status);
  const poStatusConfig = purchaseOrder
    ? PO_STATUS_CONFIG[purchaseOrder.po_status]
    : null;
  const poTypeConfig = purchaseOrder
    ? PO_TYPE_CONFIG[purchaseOrder.po_type]
    : null;

  // แยกเป็นคนละกลุ่มกับเลขที่ใบด้วยเส้นคั่น + ระยะห่าง — เลขที่ใบคือตัวตนของ
  // เอกสาร ส่วนสถานะ/ประเภท/รุ่นคือ "ตอนนี้มันอยู่ตรงไหน" คนละคำถามกัน
  const badges = (
    <div className="border-border/60 ms-1 flex items-center gap-2 border-s ps-3">
      {poStatusConfig && purchaseOrder && (
        <StatusIconLabel
          status={purchaseOrder.po_status}
          label={poStatusConfig.label}
          // เบากว่าในตาราง: ตัวเอกของแถบนี้คือเลขที่ใบ สถานะเป็นข้อมูลประกอบ
          // เหลือสีไว้ที่ไอคอนจุดเดียวซึ่งเป็นสัญญาณที่ต้องเห็นจริง ๆ
          className="text-muted-foreground text-micro [&>svg]:size-3"
        />
      )}
      {poTypeConfig && purchaseOrder && (
        <StatusIconLabel
          status={purchaseOrder.po_type}
          label={poTypeConfig.label}
          className="text-muted-foreground text-micro [&>svg]:size-3"
        />
      )}
      {/* รุ่นเอกสารย้ายมาอยู่แถวเดียวกับเลขที่ใบ เพื่อคืนบรรทัด subtitle
          ให้แถบขั้นตอน — เลขที่ใบ · สถานะ · รุ่น คือตัวตนของเอกสารชุดเดียวกัน */}
      {purchaseOrder?.doc_version != null && (
        <span className="text-muted-foreground text-micro">
          {tfl("version")} {purchaseOrder.doc_version}
        </span>
      )}
    </div>
  );

  /**
   * ผู้ซื้อ + แผนก อยู่ใต้เลขที่ใบเป็นข้อความ ไม่ใช่ช่องกรอกที่จางทั้งแถว (ทรง
   * เดียวกับใบลดหนี้และใบรับสินค้า) — สองค่านี้อ่านอย่างเดียว ไม่เข้า payload
   * การทำเป็นช่อง disabled กินพื้นที่เท่าช่องที่กรอกได้จริงและชวนให้เข้าใจผิด
   *
   * วันที่ย้ายไปเป็นช่องกรอกในฟอร์มแล้ว (ก่อนวันที่ส่งของ) จึงไม่โชว์ซ้ำที่นี่
   */
  const docMeta =
    buyerName || departmentName ? (
      <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
        {buyerName && (
          <span className="flex items-center gap-1">
            <User className="size-3 shrink-0" aria-hidden="true" />
            {buyerName}
          </span>
        )}
        {departmentName && (
          <span className="flex items-center gap-1">
            <Building2 className="size-3 shrink-0" aria-hidden="true" />
            {departmentName}
          </span>
        )}
      </span>
    ) : null;

  const workflowStepEl = purchaseOrder?.workflow_current_stage ? (
    <WorkflowTrack
      previousStage={purchaseOrder.workflow_previous_stage ?? undefined}
      currentStage={purchaseOrder.workflow_current_stage}
      nextStage={
        purchaseOrder.po_status === "completed"
          ? undefined
          : (purchaseOrder.workflow_next_stage ?? undefined)
      }
    />
  ) : undefined;

  const workflowStep = workflowStepEl ? (
    <WorkflowStepButton onShowHistory={hasHistory ? onShowHistory : undefined}>
      {workflowStepEl}
    </WorkflowStepButton>
  ) : undefined;

  return (
    <>
      <FormToolbar
        mode={mode}
        formId="po-form"
        isPending={isPending}
        title={purchaseOrder?.po_no ?? t("entity")}
        subtitle={
          docMeta || workflowStep ? (
            <span className="flex flex-col gap-1">
              {docMeta}
              {workflowStep}
            </span>
          ) : undefined
        }
        badges={badges}
        onBack={onBack}
        onCancel={onCancel}
        onEdit={purchaseOrder && canEdit ? onEnterEdit : undefined}
        // view + edit เหมือนเดิม — PO ลบได้ทั้งสองโหมดตราบที่ยังไม่ถึงสถานะปลายทาง
        onDelete={
          purchaseOrder && canEdit && !terminalStatus ? onShowDelete : undefined
        }
        deleteIsPending={deletePoIsPending}
        // เดิมป้าย Save ทุกโหมด — ไม่ให้โหมด add กลายเป็น "Create"
        submitLabel={tc("save")}
        pendingLabel={tf("saving")}
      >
        {/* Close/Send email ต่อท้าย Delete (เดิม Close อยู่หน้าสุด — spec §3 ยอมรับ)
            comment / activity / print ยุบอยู่ในเมนู ⋯ — ไม่ส่ง activity ให้ toolbar ซ้ำ */}
        {purchaseOrder && (
          <>
            {canClose &&
              (purchaseOrder.po_status === PO_STATUS.APPROVED ||
                purchaseOrder.po_status === PO_STATUS.SENT_OR_PRINT) && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={onShowClose}
                >
                  <Lock aria-hidden="true" />
                  {tc("close")}
                </Button>
              )}
            {canSendEmail && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => setShowSendEmail(true)}
              >
                <Mail aria-hidden="true" />
                {t("sendEmail.button")}
              </Button>
            )}
            <DocActionsMenu
              onComment={onShowComment}
              commentCount={commentCount}
              activity={{ id: purchaseOrder.id, label: purchaseOrder.po_no }}
              print={
                isView
                  ? {
                      documentType: "PO",
                      documentId: purchaseOrder.id,
                      filters: purchaseOrder.po_no
                        ? { DocumentNo: purchaseOrder.po_no }
                        : undefined,
                    }
                  : undefined
              }
            />
          </>
        )}
      </FormToolbar>
      {/* mount เฉพาะตอน dialog เปิดจริง (ไม่ใช่แค่เช็คสถานะ PO) — ใบที่ส่งได้แล้ว
          (sent/partial/closed/completed) คือใบส่วนใหญ่ที่คนเปิดดู เช็คแค่ canSendEmail
          จะทำให้ useEmailProfiles/useVendorById ยิงทุกครั้งที่เปิดหน้า PO เหล่านี้
          ทั้งที่ยังไม่ได้กดปุ่ม — unmount/remount ทุกรอบตั้งใจ: EmailChipField กับ
          state ในตัว dialog reset เองผ่าน lifecycle ของ component (initializedRef
          ออกแบบมารองรับ mount ใหม่ทุกครั้งที่เปิดอยู่แล้ว) */}
      {canSendEmail && showSendEmail && purchaseOrder && (
        <PoSendEmailDialog
          open={showSendEmail}
          onOpenChange={setShowSendEmail}
          purchaseOrder={purchaseOrder}
        />
      )}
    </>
  );
}
